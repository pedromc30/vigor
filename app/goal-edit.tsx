import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ExercisePicker } from '../src/components/exercise-picker';
import { Button, ChipSingle, ErrorText, LinkButton, Screen, Text, TextField } from '../src/components/ui';
import { goalBestLabel, goalProgress } from '../src/lib/achievements';
import { createGoal, deleteGoal, listGoals, updateGoal, type Goal } from '../src/lib/achievements-data';
import { confirm } from '../src/lib/confirm';
import { parseGoalForm } from '../src/lib/goal-form';
import { getExerciseSets } from '../src/lib/progress';
import { listExercises, type Exercise } from '../src/lib/training';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing } from '../src/theme';
import type { GoalKind } from '../src/lib/achievements';

const KIND_OPTIONS: { key: GoalKind; label: string }[] = [
  { key: 'weight', label: 'Peso (carga)' },
  { key: 'reps', label: 'Repeticiones' },
];

const show = (n: number) => String(n).replace('.', ',');

export default function GoalEdit() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();

  const [loading, setLoading] = useState(!!id);
  const [exercise, setExercise] = useState<Pick<Exercise, 'id' | 'name'> | null>(null);
  const [kind, setKind] = useState<GoalKind>('weight');
  const [weight, setWeight] = useState('');
  const [reps, setReps] = useState('1');
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [goals, catalog] = await Promise.all([listGoals(), listExercises()]);
        const g: Goal | undefined = goals.find((x) => x.id === id);
        if (!g) return setError('No se encontró el objetivo.');
        setExercise(catalog.find((e) => e.id === g.exercise_id) ?? { id: g.exercise_id, name: 'Ejercicio' });
        setKind(g.kind);
        setWeight(g.target_weight_kg > 0 ? show(g.target_weight_kg) : '');
        setReps(String(g.target_reps));
      } catch {
        setError('No se pudo cargar el objetivo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const changeKind = (k: GoalKind) => {
    setKind(k);
    if (k === 'weight' && reps === '') setReps('1');
  };

  const save = async () => {
    if (!session) return;
    if (!exercise) return setError('Elige un ejercicio.');
    const parsed = parseGoalForm({ kind, weight, reps });
    if ('error' in parsed) return setError(parsed.error);
    setSaving(true);
    setError(null);
    try {
      // Un objetivo ya cumplido con lo registrado no tendría sentido: se pide uno mayor.
      const sets = await getExerciseSets(exercise.id).catch(() => []);
      const progress = goalProgress(parsed.values, sets.map((s) => ({ weightKg: s.weight_kg, reps: s.reps })));
      if (progress.met) {
        setError(`Ya lo has conseguido con tus series registradas (mejor marca: ${goalBestLabel(parsed.values, progress.best)}). Elige un objetivo mayor.`);
        return setSaving(false);
      }
      const input = { exercise_id: exercise.id, ...parsed.values };
      if (id) await updateGoal(id, input);
      else await createGoal(session.user.id, input);
      router.back();
    } catch {
      setError('No se pudo guardar el objetivo. Comprueba tu conexión e inténtalo de nuevo.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    if (!(await confirm('Eliminar objetivo', 'Los logros que ya conseguiste se conservan en tu historial.', 'Eliminar', true))) return;
    try {
      await deleteGoal(id);
      router.back();
    } catch {
      setError('No se pudo eliminar el objetivo.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <Text muted>Cargando…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{id ? 'Editar objetivo' : 'Nuevo objetivo'}</Text>
      <Text muted>Se cumple con una serie normal que alcance a la vez la carga y las repeticiones. Las series de aproximación y los dropsets no cuentan.</Text>

      <View style={{ gap: spacing.sm }}>
        <Text variant="label">Ejercicio</Text>
        <Button title={exercise ? exercise.name : 'Elegir ejercicio'} variant="secondary" onPress={() => setPicker(true)} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="label">Tipo de objetivo</Text>
        <ChipSingle options={KIND_OPTIONS} value={kind} onChange={(k) => changeKind(k ?? 'weight')} />
        <Text variant="caption" muted>
          {kind === 'weight'
            ? 'Ejemplo: sentadilla 100 kg × 1.'
            : 'Ejemplo: dominadas 12 repeticiones con peso corporal, o press de banca 80 kg × 8.'}
        </Text>
      </View>

      <TextField
        label={kind === 'weight' ? 'Peso (kg)' : 'Peso (kg) · vacío o 0 = peso corporal'}
        value={weight}
        onChangeText={setWeight}
        keyboardType="decimal-pad"
        maxLength={7}
      />
      <TextField
        label={kind === 'weight' ? 'Repeticiones mínimas' : 'Repeticiones'}
        value={reps}
        onChangeText={setReps}
        keyboardType="number-pad"
        maxLength={3}
      />

      <ErrorText>{error}</ErrorText>
      <Button title="Guardar objetivo" onPress={() => void save()} loading={saving} />
      {id ? <LinkButton title="Eliminar objetivo" danger onPress={() => void remove()} /> : null}
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />

      <ExercisePicker
        visible={picker}
        onClose={() => setPicker(false)}
        onPick={(e) => {
          setExercise(e);
          setPicker(false);
        }}
      />
    </Screen>
  );
}
