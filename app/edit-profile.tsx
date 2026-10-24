import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';
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
import { Button, ErrorText, Screen, Text } from '../src/components/ui';

export default function EditProfile() {
  const router = useRouter();
  const { profile, saveProfile } = useAuth();
  const { draft, set } = useDraft(draftFromProfile(profile));
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const e = { ...validateBody(draft), ...validateGoal(draft) };
    setErrors(e);
    if (Object.keys(e).length) return;
    const plan = planFromDraft(draft);
    if (!plan) return;

    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile({
        ...profileValuesFromDraft(draft),
        // Los objetivos editados a mano se respetan; los automáticos se recalculan con los datos nuevos.
        ...(profile?.targets_manual
          ? {}
          : {
              target_kcal: plan.kcal,
              target_protein_g: plan.proteinG,
              target_fat_g: plan.fatG,
              target_carbs_g: plan.carbsG,
            }),
      });
      router.back();
    } catch {
      setSaveError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text variant="title">Editar datos</Text>
      <BodySection draft={draft} set={set} errors={errors} />
      <GoalSection draft={draft} set={set} errors={errors} />
      <DietSection draft={draft} set={set} />
      {profile?.targets_manual ? (
        <Text variant="caption" muted>
          Tus objetivos diarios están editados a mano y no se recalcularán. Puedes restablecerlos desde «Editar
          objetivos».
        </Text>
      ) : null}
      <ErrorText>{saveError}</ErrorText>
      <Button title="Guardar" onPress={save} loading={saving} />
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
