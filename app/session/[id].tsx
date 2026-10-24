import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, ErrorText, Screen, Text } from '../../src/components/ui';
import { confirm } from '../../src/lib/confirm';
import { MUSCLE_LABELS } from '../../src/lib/labels';
import { deleteSession, getSession, getSessionSets } from '../../src/lib/training';
import {
  bestEstimated1RM,
  formatDuration,
  formatKg,
  setVolume,
  suggestNextWeight,
} from '../../src/lib/training-math';
import { useFocusData } from '../../src/lib/use-focus-data';
import { spacing } from '../../src/theme';

export default function SessionDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, error, loading } = useFocusData(
    async () => {
      const session = await getSession(id);
      return session ? { session, sets: await getSessionSets(id) } : null;
    },
    [id],
  );
  const [actionError, setActionError] = useState<string | null>(null);

  const remove = async () => {
    if (!(await confirm('Eliminar sesión', 'Se borrará esta sesión y todas sus series.', 'Eliminar', true))) return;
    try {
      await deleteSession(id);
      if (router.canGoBack()) router.back();
      else router.dismissTo('/entreno');
    } catch {
      setActionError('No se pudo eliminar la sesión.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <Text muted>Cargando…</Text>
      </Screen>
    );
  }
  if (error || !data) {
    return (
      <Screen>
        <ErrorText>{error ?? 'No se encontró la sesión.'}</ErrorText>
        <Button title="Volver" variant="ghost" onPress={() => router.dismissTo('/entreno')} />
      </Screen>
    );
  }

  const { session, sets } = data;
  const totalVolume = sets.reduce((sum, s) => sum + setVolume({ weightKg: s.weight_kg, reps: s.reps }), 0);
  const seconds = session.finished_at
    ? (new Date(session.finished_at).getTime() - new Date(session.started_at).getTime()) / 1000
    : null;

  return (
    <Screen>
      <Text variant="title">{session.routine_name}</Text>
      <Text muted>
        {new Date(session.started_at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
        {seconds != null ? ` · ${formatDuration(seconds)}` : ' · en curso'}
      </Text>

      <Card>
        <View style={{ flexDirection: 'row', gap: spacing.xl }}>
          <View>
            <Text variant="heading">{sets.length}</Text>
            <Text variant="caption" muted>
              Series
            </Text>
          </View>
          <View>
            <Text variant="heading">{formatKg(Math.round(totalVolume))} kg</Text>
            <Text variant="caption" muted>
              Volumen total
            </Text>
          </View>
        </View>
      </Card>

      {session.plan.map((item, pos) => {
        const mine = sets.filter((s) => s.position === pos);
        if (!mine.length) return null;
        const data = mine.map((s) => ({ weightKg: s.weight_kg, reps: s.reps }));
        const oneRm = bestEstimated1RM(data);
        const next = suggestNextWeight(data, item.sets, item.reps_target);
        return (
          <Card key={`${item.exercise_id}-${pos}`}>
            <Text variant="heading">{item.name}</Text>
            <Text variant="caption" muted>
              {MUSCLE_LABELS[item.muscle_group]} · objetivo {item.sets} × {item.reps_target}
            </Text>
            {mine.map((s) => (
              <Text key={s.id}>
                <Text muted>Serie {s.set_index + 1}: </Text>
                {formatKg(s.weight_kg)} kg × {s.reps}
                {s.rpe != null ? <Text muted>{` · RPE ${formatKg(s.rpe)}`}</Text> : null}
              </Text>
            ))}
            {oneRm != null ? (
              <Text variant="caption" muted>
                1RM estimado (Epley): {formatKg(Math.round(oneRm * 10) / 10)} kg
              </Text>
            ) : null}
            {next != null ? (
              <Text variant="caption" style={{ fontWeight: '600' }}>
                Objetivo cumplido: la próxima vez prueba con {formatKg(next)} kg.
              </Text>
            ) : null}
          </Card>
        );
      })}

      <ErrorText>{actionError}</ErrorText>
      <Button title="Volver a Entreno" onPress={() => router.dismissTo('/entreno')} />
      <Button title="Eliminar sesión" variant="danger" onPress={() => void remove()} />
    </Screen>
  );
}
