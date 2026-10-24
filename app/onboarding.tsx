import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useAuth } from '../src/providers/AuthProvider';
import { CONSENT_VERSION } from '../src/lib/profile';
import {
  BodySection,
  DietSection,
  GoalSection,
  draftFromProfile,
  planFromDraft,
  profileValuesFromDraft,
  useDraft,
  validateBody,
  validateGoal,
  type DraftErrors,
} from '../src/components/profile-form';
import { PlanSummary } from '../src/components/plan-summary';
import { Button, Disclaimer, ErrorText, Screen, Text } from '../src/components/ui';
import { spacing, useTheme } from '../src/theme';

const STEPS = ['Privacidad', 'Tus datos', 'Tu objetivo', 'Alimentación', 'Tu plan'] as const;

export default function Onboarding() {
  const { colors } = useTheme();
  const { profile, saveProfile, signOut } = useAuth();
  const { draft, set } = useDraft(draftFromProfile(profile));
  const [step, setStep] = useState(0);
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const plan = step === 4 ? planFromDraft(draft) : null;

  const next = () => {
    if (step === 1) {
      const e = validateBody(draft);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    if (step === 2) {
      const e = validateGoal(draft);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    setErrors({});
    setStep((s) => s + 1);
  };

  const finish = async () => {
    if (!plan) return;
    setSaving(true);
    setSaveError(null);
    try {
      const now = new Date().toISOString();
      await saveProfile({
        ...profileValuesFromDraft(draft),
        target_kcal: plan.kcal,
        target_protein_g: plan.proteinG,
        target_fat_g: plan.fatG,
        target_carbs_g: plan.carbsG,
        targets_manual: false,
        health_consent_at: now,
        consent_version: CONSENT_VERSION,
        onboarding_completed_at: now,
      });
      // El guard de rutas del layout redirige a las pestañas al actualizarse el perfil.
    } catch {
      setSaveError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" muted>
          Paso {step + 1} de {STEPS.length}
        </Text>
        <Text variant="title">{STEPS[step]}</Text>
      </View>

      {step === 0 && (
        <>
          <Text>
            Para calcular tus objetivos necesitamos datos de salud (peso, altura, edad, alergias…). Los usamos solo para
            ofrecerte la app, se transmiten por conexión cifrada, solo tú puedes acceder a ellos y puedes borrarlos junto
            con tu cuenta en cualquier momento desde Perfil, donde también tienes el detalle en «Privacidad y datos».
          </Text>
          <Disclaimer />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((c) => !c)}
            style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}
          >
            <View
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                borderWidth: 2,
                borderColor: colors.primary,
                backgroundColor: consent ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {consent ? <Text style={{ color: colors.onPrimary, fontWeight: '700' }}>✓</Text> : null}
            </View>
            <Text style={{ flex: 1 }}>
              Doy mi consentimiento explícito para que Vigor trate mis datos de salud con la finalidad descrita y
              entiendo que puedo retirarlo borrando mi cuenta.
            </Text>
          </Pressable>
        </>
      )}
      {step === 1 && <BodySection draft={draft} set={set} errors={errors} />}
      {step === 2 && <GoalSection draft={draft} set={set} errors={errors} />}
      {step === 3 && <DietSection draft={draft} set={set} />}
      {step === 4 && plan && (
        <>
          <Text muted>Estos son tus objetivos de partida. Podrás editarlos cuando quieras desde Perfil.</Text>
          <PlanSummary plan={plan} />
          <Disclaimer />
          <ErrorText>{saveError}</ErrorText>
        </>
      )}

      <View style={{ gap: spacing.sm }}>
        {step < 4 ? (
          <Button title="Continuar" onPress={next} disabled={step === 0 && !consent} />
        ) : (
          <Button title="Empezar" onPress={finish} loading={saving} />
        )}
        {step > 0 && <Button title="Atrás" variant="secondary" onPress={() => setStep((s) => s - 1)} />}
        {step === 0 && <Button title="Cerrar sesión" variant="ghost" onPress={() => void signOut()} />}
      </View>
    </Screen>
  );
}
