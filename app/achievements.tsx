import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorText, LinkButton, Screen, Text } from '../src/components/ui';
import {
  achievementDetail,
  achievementTitle,
  goalBestLabel,
  goalProgress,
  goalTitle,
} from '../src/lib/achievements';
import {
  deleteGoal,
  ensureAchievementsBackfill,
  listAchievements,
  listGoals,
  type Achievement,
  type Goal,
} from '../src/lib/achievements-data';
import { confirm } from '../src/lib/confirm';
import { fromISODate } from '../src/lib/diet-math';
import { getExerciseSets } from '../src/lib/progress';
import { listExercises } from '../src/lib/training';
import { useFocusData } from '../src/lib/use-focus-data';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing, useTheme } from '../src/theme';

const dateLabel = (iso: string) => fromISODate(iso.slice(0, 10)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

interface PendingGoal {
  goal: Goal;
  name: string;
  percent: number;
  best: number | null;
}

export default function Achievements() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useTheme();
  const [actionError, setActionError] = useState<string | null>(null);

  const { data, error, loading, reload } = useFocusData(async () => {
    // Reconoce una sola vez los récords del historial anterior (sin celebrarlos).
    if (session) await ensureAchievementsBackfill(session.user.id);
    const [goals, achievements, catalog] = await Promise.all([listGoals(), listAchievements(200), listExercises()]);
    const names = new Map(catalog.map((e) => [e.id, e.name]));
    const pending: PendingGoal[] = await Promise.all(
      goals
        .filter((g) => !g.achieved_at)
        .map(async (goal) => {
          const sets = await getExerciseSets(goal.exercise_id).catch(() => []);
          const p = goalProgress(goal, sets.map((s) => ({ weightKg: s.weight_kg, reps: s.reps })));
          return { goal, name: names.get(goal.exercise_id) ?? 'Ejercicio', percent: p.percent, best: p.best };
        }),
    );
    return { pending, achievements, names };
  });

  const remove = async (g: Goal) => {
    if (!(await confirm('Eliminar objetivo', 'Los logros que ya conseguiste se conservan en tu historial.', 'Eliminar', true))) return;
    setActionError(null);
    try {
      await deleteGoal(g.id);
      await reload();
    } catch {
      setActionError('No se pudo eliminar el objetivo. Comprueba tu conexión.');
    }
  };

  const iconFor = (a: Achievement) => (a.kind === 'goal' ? 'trophy' : 'medal');

  return (
    <Screen>
      <Text variant="title">Logros</Text>
      <ErrorText>{error ?? actionError}</ErrorText>
      {loading ? <Text muted>Cargando…</Text> : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">Objetivos pendientes</Text>
        {data && !data.pending.length ? <Text muted>No tienes objetivos pendientes. Crea uno para tener una meta por ejercicio.</Text> : null}
        {data?.pending.map(({ goal, name, percent, best }) => (
          <Card key={goal.id}>
            <Text variant="label">{name}</Text>
            <Text variant="heading">{goalTitle(goal)}</Text>
            <View
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Progreso: ${percent} %`}
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt, overflow: 'hidden' }}
            >
              <View style={{ height: 8, width: `${percent}%`, backgroundColor: colors.primary, borderRadius: 4 }} />
            </View>
            <Text variant="caption" muted>
              {percent} % · mejor marca: {goalBestLabel(goal, best)}
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <LinkButton title="Editar" onPress={() => router.push({ pathname: '/goal-edit', params: { id: goal.id } })} />
              <LinkButton title="Eliminar" danger onPress={() => void remove(goal)} />
            </View>
          </Card>
        ))}
        <Button title="Nuevo objetivo" variant="secondary" onPress={() => router.push('/goal-edit')} />
      </View>

      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">Historial</Text>
        <Text variant="caption" muted>
          Objetivos conseguidos y récords personales (de peso, de repeticiones y de 1RM estimado). Solo cuentan las series normales.
        </Text>
        {data && !data.achievements.length ? <Text muted>Todavía no hay logros. Se registran solos cuando bates un récord o cumples un objetivo.</Text> : null}
        {data?.achievements.map((a) => (
          <View
            key={a.id}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: colors.border,
              paddingVertical: spacing.md,
            }}
          >
            <Ionicons name={iconFor(a)} size={26} color={a.kind === 'goal' ? colors.warningText : colors.primary} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text variant="label">{achievementTitle(a.kind)}</Text>
              <Text>
                {data.names.get(a.exercise_id) ?? 'Ejercicio'} · {achievementDetail(a)}
              </Text>
              <Text variant="caption" muted>
                {dateLabel(a.achieved_at)}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
