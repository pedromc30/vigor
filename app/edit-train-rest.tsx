import { useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorText, Screen, Text, TextField } from '../src/components/ui';
import { averageOfDays, trainRestTargets, type DayTarget } from '../src/lib/day-targets';
import { macrosKcal } from '../src/lib/nutrition';
import { listRoutines } from '../src/lib/training';
import { LIMITS, parseDecimal, rangeError } from '../src/lib/validation';
import { useAuth } from '../src/providers/AuthProvider';

const int = (t: string) => {
  const n = parseDecimal(t);
  return n !== null && Number.isInteger(n) ? n : null;
};

type Fields = { kcal: string; protein: string; carbs: string; fat: string };

function TargetFields({ title, value, onChange, errors }: { title: string; value: Fields; onChange: (v: Fields) => void; errors: Partial<Record<keyof Fields, string | null>> }) {
  const sum = Math.round(macrosKcal({ proteinG: int(value.protein) ?? 0, fatG: int(value.fat) ?? 0, carbsG: int(value.carbs) ?? 0 }));
  return (
    <Card>
      <Text variant="heading">{title}</Text>
      <TextField label="Calorías" suffix="kcal" keyboardType="number-pad" value={value.kcal} onChangeText={(kcal) => onChange({ ...value, kcal })} error={errors.kcal} />
      <TextField label="Proteína" suffix="g" keyboardType="number-pad" value={value.protein} onChangeText={(protein) => onChange({ ...value, protein })} error={errors.protein} />
      <TextField label="Carbohidratos" suffix="g" keyboardType="number-pad" value={value.carbs} onChangeText={(carbs) => onChange({ ...value, carbs })} error={errors.carbs} />
      <TextField label="Grasa" suffix="g" keyboardType="number-pad" value={value.fat} onChangeText={(fat) => onChange({ ...value, fat })} error={errors.fat} />
      <Text variant="caption" muted>
        Los macros suman {sum} kcal
      </Text>
    </Card>
  );
}

/** Atajo: un objetivo para los días de entreno y otro para los de descanso; se reparte por los 7 días según tus rutinas programadas. */
export default function EditTrainRest() {
  const router = useRouter();
  const { profile, saveProfile } = useAuth();
  const base: Fields = {
    kcal: String(profile?.target_kcal ?? ''),
    protein: String(profile?.target_protein_g ?? ''),
    carbs: String(profile?.target_carbs_g ?? ''),
    fat: String(profile?.target_fat_g ?? ''),
  };
  const [train, setTrain] = useState<Fields>(base);
  const [rest, setRest] = useState<Fields>(base);
  const [days, setDays] = useState<number[] | null>(null);
  const [errA, setErrA] = useState<Partial<Record<keyof Fields, string | null>>>({});
  const [errB, setErrB] = useState<Partial<Record<keyof Fields, string | null>>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    listRoutines()
      .then((rs) => setDays([...new Set(rs.flatMap((r) => r.schedule.filter((d) => d > 0)))].sort()))
      .catch(() => setDays([]));
  }, []);

  const check = (f: Fields) => ({
    kcal: rangeError(int(f.kcal), LIMITS.kcal.min, LIMITS.kcal.max, 'kcal'),
    protein: rangeError(int(f.protein), 0, 1000, 'g'),
    carbs: rangeError(int(f.carbs), 0, 2000, 'g'),
    fat: rangeError(int(f.fat), 0, 1000, 'g'),
  });
  const toTarget = (f: Fields): DayTarget => ({ kcal: int(f.kcal)!, protein_g: int(f.protein)!, carbs_g: int(f.carbs)!, fat_g: int(f.fat)! });

  const save = async () => {
    const a = check(train);
    const b = check(rest);
    setErrA(a);
    setErrB(b);
    if (Object.values(a).some(Boolean) || Object.values(b).some(Boolean)) return;
    const perDay = trainRestTargets(days ?? [], toTarget(train), toTarget(rest));
    const avg = averageOfDays(perDay);
    setSaving(true);
    setSaveError(null);
    try {
      await saveProfile({ day_targets: perDay, target_kcal: avg.kcal, target_protein_g: avg.protein_g, target_carbs_g: avg.carbs_g, target_fat_g: avg.fat_g, targets_manual: true });
      router.back();
    } catch {
      setSaveError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text variant="title">Entreno y descanso</Text>
      <Text muted>Pon un objetivo para los días que entrenas y otro para los que descansas. Se aplica a cada día de la semana según tus rutinas programadas; después puedes ajustar un día concreto.</Text>
      {days && !days.length ? (
        <Card>
          <Text variant="label">Aún no tienes rutinas programadas en días concretos</Text>
          <Text muted>Sin ellas, todos los días se considerarán de descanso. Programa tus rutinas en Entrenamientos y vuelve aquí.</Text>
        </Card>
      ) : null}
      <TargetFields title="Día de entreno" value={train} onChange={setTrain} errors={errA} />
      <TargetFields title="Día de descanso" value={rest} onChange={setRest} errors={errB} />
      <ErrorText>{saveError}</ErrorText>
      <Button title="Guardar" onPress={save} loading={saving} disabled={days === null} />
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
