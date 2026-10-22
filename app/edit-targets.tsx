import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';
import { macrosKcal } from '../src/lib/nutrition';
import { LIMITS, parseDecimal, rangeError } from '../src/lib/validation';
import { draftFromProfile, planFromDraft } from '../src/components/profile-form';
import { Button, Card, ErrorText, Screen, Text, TextField } from '../src/components/ui';

const str = (n: number | null) => (n != null ? String(n) : '');

export default function EditTargets() {
  const router = useRouter();
  const { profile, saveProfile } = useAuth();
  const [kcal, setKcal] = useState(str(profile?.target_kcal ?? null));
  const [protein, setProtein] = useState(str(profile?.target_protein_g ?? null));
  const [fat, setFat] = useState(str(profile?.target_fat_g ?? null));
  const [carbs, setCarbs] = useState(str(profile?.target_carbs_g ?? null));
  const [errors, setErrors] = useState<Record<string, string | null>>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const int = (t: string) => {
    const n = parseDecimal(t);
    return n !== null && Number.isInteger(n) ? n : null;
  };
  const macroKcal = macrosKcal({ proteinG: int(protein) ?? 0, fatG: int(fat) ?? 0, carbsG: int(carbs) ?? 0 });
  const kcalValue = int(kcal);
  const diff = kcalValue != null ? macroKcal - kcalValue : null;

  const save = async () => {
    const e = {
      kcal: rangeError(int(kcal), LIMITS.kcal.min, LIMITS.kcal.max, 'kcal'),
      protein: rangeError(int(protein), 0, 1000, 'g'),
      fat: rangeError(int(fat), 0, 1000, 'g'),
      carbs: rangeError(int(carbs), 0, 2000, 'g'),
    };
    setErrors(e);
    if (Object.values(e).some(Boolean)) return;
    await persist({
      target_kcal: int(kcal)!,
      target_protein_g: int(protein)!,
      target_fat_g: int(fat)!,
      target_carbs_g: int(carbs)!,
      targets_manual: true,
    });
  };

  const reset = async () => {
    const plan = profile ? planFromDraft(draftFromProfile(profile)) : null;
    if (!plan) return setSaveError('Faltan datos del perfil para calcular los objetivos.');
    await persist({
      target_kcal: plan.kcal,
      target_protein_g: plan.proteinG,
      target_fat_g: plan.fatG,
      target_carbs_g: plan.carbsG,
      targets_manual: false,
    });
  };

  const persist = async (values: Parameters<typeof saveProfile>[0]) => {
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile(values);
      router.back();
    } catch {
      setSaveError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen padTop={false}>
      <Text variant="title">Objetivos diarios</Text>
      <TextField label="Calorías" suffix="kcal" keyboardType="number-pad" value={kcal} onChangeText={setKcal} error={errors.kcal} />
      <TextField label="Proteína" suffix="g" keyboardType="number-pad" value={protein} onChangeText={setProtein} error={errors.protein} />
      <TextField label="Carbohidratos" suffix="g" keyboardType="number-pad" value={carbs} onChangeText={setCarbs} error={errors.carbs} />
      <TextField label="Grasa" suffix="g" keyboardType="number-pad" value={fat} onChangeText={setFat} error={errors.fat} />
      <Card>
        <Text variant="label">Los macros suman {Math.round(macroKcal)} kcal</Text>
        {diff != null && Math.abs(diff) > 50 ? (
          <Text variant="caption" muted>
            {Math.abs(Math.round(diff))} kcal {diff > 0 ? 'por encima' : 'por debajo'} del objetivo calórico.
          </Text>
        ) : (
          <Text variant="caption" muted>
            Coinciden con el objetivo calórico.
          </Text>
        )}
      </Card>
      <ErrorText>{saveError}</ErrorText>
      <Button title="Guardar" onPress={save} loading={saving} />
      <Button title="Restablecer a los valores recomendados" variant="secondary" onPress={reset} disabled={saving} />
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
