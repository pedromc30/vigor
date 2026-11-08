import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';
import { cleanDayTargets, targetsForWeekday, type DayTargets } from '../src/lib/day-targets';
import { WEEKDAY_LONG } from '../src/lib/labels';
import { macrosKcal } from '../src/lib/nutrition';
import { LIMITS, parseDecimal, rangeError } from '../src/lib/validation';
import { Button, Card, ErrorText, Screen, Text, TextField } from '../src/components/ui';

const str = (n: number | null) => (n != null ? String(n) : '');

/** Objetivo de calorías y macros de un día concreto de la semana. */
export default function EditDayTarget() {
  const router = useRouter();
  const { day } = useLocalSearchParams<{ day?: string }>();
  const weekday = Math.min(7, Math.max(1, Number(day) || 1));
  const { profile, saveProfile } = useAuth();
  const current = targetsForWeekday(profile, weekday);
  const [kcal, setKcal] = useState(str(current.kcal));
  const [protein, setProtein] = useState(str(current.protein_g));
  const [carbs, setCarbs] = useState(str(current.carbs_g));
  const [fat, setFat] = useState(str(current.fat_g));
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const name = WEEKDAY_LONG[weekday];

  const int = (t: string) => {
    const n = parseDecimal(t);
    return n !== null && Number.isInteger(n) ? n : null;
  };
  const macroKcal = macrosKcal({ proteinG: int(protein) ?? 0, fatG: int(fat) ?? 0, carbsG: int(carbs) ?? 0 });

  const persist = async (next: DayTargets | null) => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile({ day_targets: next });
      router.back();
    } catch {
      setSaveError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    const e = {
      kcal: rangeError(int(kcal), LIMITS.kcal.min, LIMITS.kcal.max, 'kcal'),
      protein: rangeError(int(protein), 0, 1000, 'g'),
      carbs: rangeError(int(carbs), 0, 2000, 'g'),
      fat: rangeError(int(fat), 0, 1000, 'g'),
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    const all = { ...(cleanDayTargets(profile?.day_targets) ?? {}) };
    all[String(weekday)] = { kcal: int(kcal)!, protein_g: int(protein)!, carbs_g: int(carbs)!, fat_g: int(fat)! };
    await persist(all);
  };

  // Quita el objetivo propio de este día: vuelve a usar el objetivo general.
  const useGeneral = async () => {
    const all = { ...(cleanDayTargets(profile?.day_targets) ?? {}) };
    delete all[String(weekday)];
    await persist(Object.keys(all).length ? all : null);
  };

  return (
    <Screen>
      <Text variant="title">Objetivo del {name}</Text>
      <Text muted>Solo cambia el objetivo de ese día de la semana.</Text>
      <TextField label="Calorías" suffix="kcal" keyboardType="number-pad" value={kcal} onChangeText={setKcal} error={errors.kcal} />
      <TextField label="Proteína" suffix="g" keyboardType="number-pad" value={protein} onChangeText={setProtein} error={errors.protein} />
      <TextField label="Carbohidratos" suffix="g" keyboardType="number-pad" value={carbs} onChangeText={setCarbs} error={errors.carbs} />
      <TextField label="Grasa" suffix="g" keyboardType="number-pad" value={fat} onChangeText={setFat} error={errors.fat} />
      <Card>
        <Text variant="label">Los macros suman {Math.round(macroKcal)} kcal</Text>
      </Card>
      <ErrorText>{saveError}</ErrorText>
      <Button title="Guardar" onPress={save} loading={saving} />
      {current.perDay ? <Button title="Usar el objetivo general" variant="secondary" onPress={useGeneral} disabled={saving} /> : null}
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
