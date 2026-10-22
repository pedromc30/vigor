import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { computePlan, type ActivityLevel, type Goal, type NutritionPlan, type PlanInput, type Sex } from '../lib/nutrition';
import type { DietPreference, Profile } from '../lib/profile';
import { ACTIVITY_LABELS, ALLERGEN_OPTIONS, DIET_LABELS, GOAL_LABELS, SEX_LABELS, TRAINING_DAYS } from '../lib/labels';
import { LIMITS, parseDecimal, rangeError } from '../lib/validation';
import { ChipMulti, ErrorText, OptionList, SegmentRow, TextField } from './ui';
import { spacing } from '../theme';

const PRESET_KEYS = new Set(ALLERGEN_OPTIONS.map((a) => a.key));

export interface ProfileDraft {
  sex: Sex | null;
  age: string;
  height: string;
  weight: string;
  activity: ActivityLevel | null;
  goal: Goal | null;
  trainingDays: number | null;
  diet: DietPreference | null;
  allergies: string[];
  otherAllergies: string;
}

export function draftFromProfile(p: Profile | null): ProfileDraft {
  const allergies = p?.allergies ?? [];
  return {
    sex: p?.sex ?? null,
    age: p?.age != null ? String(p.age) : '',
    height: p?.height_cm != null ? String(p.height_cm).replace('.', ',') : '',
    weight: p?.weight_kg != null ? String(p.weight_kg).replace('.', ',') : '',
    activity: p?.activity_level ?? null,
    goal: p?.goal ?? null,
    trainingDays: p?.training_days_per_week ?? null,
    diet: p?.diet_preference ?? 'omnivore',
    allergies: allergies.filter((a) => PRESET_KEYS.has(a)),
    otherAllergies: allergies.filter((a) => !PRESET_KEYS.has(a)).join(', '),
  };
}

export type DraftErrors = Partial<Record<'sex' | 'age' | 'height' | 'weight' | 'activity' | 'goal' | 'trainingDays', string>>;

export function validateBody(d: ProfileDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.sex) e.sex = 'Selecciona una opción';
  const age = parseDecimal(d.age);
  e.age = rangeError(age !== null && Number.isInteger(age) ? age : null, LIMITS.age.min, LIMITS.age.max, 'años') ?? undefined;
  e.height = rangeError(parseDecimal(d.height), LIMITS.heightCm.min, LIMITS.heightCm.max, 'cm') ?? undefined;
  e.weight = rangeError(parseDecimal(d.weight), LIMITS.weightKg.min, LIMITS.weightKg.max, 'kg') ?? undefined;
  return Object.fromEntries(Object.entries(e).filter(([, v]) => v)) as DraftErrors;
}

export function validateGoal(d: ProfileDraft): DraftErrors {
  const e: DraftErrors = {};
  if (!d.activity) e.activity = 'Selecciona tu nivel de actividad';
  if (!d.goal) e.goal = 'Selecciona un objetivo';
  if (d.trainingDays === null) e.trainingDays = 'Selecciona los días de entreno';
  return e;
}

export function planFromDraft(d: ProfileDraft): NutritionPlan | null {
  if (Object.keys(validateBody(d)).length || Object.keys(validateGoal(d)).length) return null;
  const input: PlanInput = {
    sex: d.sex!,
    age: parseDecimal(d.age)!,
    heightCm: parseDecimal(d.height)!,
    weightKg: parseDecimal(d.weight)!,
    activityLevel: d.activity!,
    goal: d.goal!,
  };
  return computePlan(input);
}

/** Valores de la tabla `profiles` que salen del formulario (sin objetivos ni consentimiento). */
export function profileValuesFromDraft(d: ProfileDraft) {
  const others = d.otherAllergies
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    sex: d.sex,
    age: parseDecimal(d.age),
    height_cm: parseDecimal(d.height),
    weight_kg: parseDecimal(d.weight),
    activity_level: d.activity,
    goal: d.goal,
    training_days_per_week: d.trainingDays,
    diet_preference: d.diet,
    allergies: [...d.allergies, ...others],
  };
}

export function useDraft(initial: ProfileDraft) {
  const [draft, setDraft] = useState(initial);
  const set = useMemo(
    () =>
      <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
        setDraft((d) => ({ ...d, [key]: value })),
    [],
  );
  return { draft, set };
}

interface SectionProps {
  draft: ProfileDraft;
  set: <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => void;
  errors: DraftErrors;
}

export function BodySection({ draft, set, errors }: SectionProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <SegmentRow
        label="Sexo (para la fórmula de gasto energético)"
        options={(Object.keys(SEX_LABELS) as Sex[]).map((v) => ({ value: v, title: SEX_LABELS[v] }))}
        value={draft.sex}
        onChange={(v) => set('sex', v)}
      />
      {errors.sex ? <ErrorLine text={errors.sex} /> : null}
      <TextField label="Edad" suffix="años" keyboardType="number-pad" value={draft.age} onChangeText={(t) => set('age', t)} error={errors.age} />
      <TextField label="Altura" suffix="cm" keyboardType="decimal-pad" value={draft.height} onChangeText={(t) => set('height', t)} error={errors.height} />
      <TextField label="Peso" suffix="kg" keyboardType="decimal-pad" value={draft.weight} onChangeText={(t) => set('weight', t)} error={errors.weight} />
    </View>
  );
}

export function GoalSection({ draft, set, errors }: SectionProps) {
  return (
    <View style={{ gap: spacing.lg }}>
      <OptionList
        label="Nivel de actividad diaria"
        value={draft.activity}
        onChange={(v) => set('activity', v)}
        options={(Object.keys(ACTIVITY_LABELS) as ActivityLevel[]).map((v) => ({ value: v, ...ACTIVITY_LABELS[v] }))}
      />
      {errors.activity ? <ErrorLine text={errors.activity} /> : null}
      <OptionList
        label="Objetivo"
        value={draft.goal}
        onChange={(v) => set('goal', v)}
        options={(Object.keys(GOAL_LABELS) as Goal[]).map((v) => ({ value: v, ...GOAL_LABELS[v] }))}
      />
      {errors.goal ? <ErrorLine text={errors.goal} /> : null}
      <SegmentRow
        label="Días de entreno por semana"
        options={TRAINING_DAYS.map((d) => ({ value: d, title: String(d) }))}
        value={draft.trainingDays}
        onChange={(v) => set('trainingDays', v)}
      />
      {errors.trainingDays ? <ErrorLine text={errors.trainingDays} /> : null}
    </View>
  );
}

export function DietSection({ draft, set }: Omit<SectionProps, 'errors'>) {
  return (
    <View style={{ gap: spacing.lg }}>
      <OptionList
        label="Preferencia dietética"
        value={draft.diet}
        onChange={(v) => set('diet', v)}
        options={(Object.keys(DIET_LABELS) as DietPreference[]).map((v) => ({ value: v, title: DIET_LABELS[v] }))}
      />
      <ChipMulti
        label="Alergias e intolerancias"
        options={ALLERGEN_OPTIONS}
        selected={draft.allergies}
        onToggle={(k) =>
          set('allergies', draft.allergies.includes(k) ? draft.allergies.filter((a) => a !== k) : [...draft.allergies, k])
        }
      />
      <TextField
        label="Otras (separadas por comas)"
        value={draft.otherAllergies}
        onChangeText={(t) => set('otherAllergies', t)}
        maxLength={200}
      />
    </View>
  );
}

function ErrorLine({ text }: { text: string }) {
  return <ErrorText>{text}</ErrorText>;
}
