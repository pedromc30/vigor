import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorText, Screen, Text } from '../../src/components/ui';
import { MUSCLE_LABELS, WEEKDAY_LONG } from '../../src/lib/labels';
import { getActiveSession, getSetsSince, listRoutines, startSession } from '../../src/lib/training';
import { formatKg, volumeByMuscleGroup, weekStart } from '../../src/lib/training-math';
import { useFocusData } from '../../src/lib/use-focus-data';
import { useAuth } from '../../src/providers/AuthProvider';
import { spacing, useTheme } from '../../src/theme';

export default function Entreno() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const { data, error, loading } = useFocusData(async () => {
    const [active, routines, weekSets] = await Promise.all([
      getActiveSession(),
      listRoutines(),
      getSetsSince(weekStart(new Date())),
    ]);
    return { active, routines, volume: volumeByMuscleGroup(weekSets) };
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const startFree = async () => {
    if (!session) return;
    setBusy(true);
    setActionError(null);
    try {
      const id = await startSession(session.user.id, null, 'Sesión libre', []);
      router.push({ pathname: '/workout/[id]', params: { id } });
    } catch {
      setActionError('No se pudo iniciar la sesión. Comprueba tu conexión.');
    } finally {
      setBusy(false);
    }
  };

  const maxSets = Math.max(1, ...(data?.volume.map((v) => v.sets) ?? [1]));

  return (
    <Screen>
      <Text variant="title">Entreno</Text>
      <ErrorText>{error}</ErrorText>
      <ErrorText>{actionError}</ErrorText>

      {data?.active ? (
        <Card>
          <Text variant="label">Sesión en curso</Text>
          <Text muted>{data.active.routine_name}</Text>
          <Button
            title="Continuar sesión"
            onPress={() => router.push({ pathname: '/workout/[id]', params: { id: data.active!.id } })}
          />
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <Text variant="heading">Mis rutinas</Text>
        {loading ? <Text muted>Cargando…</Text> : null}
        {data && !data.routines.length ? (
          <Text muted>Aún no tienes rutinas. Crea la primera o empieza una sesión libre.</Text>
        ) : null}
        {data?.routines.map((r) => {
          const scheduled = r.schedule.filter((d) => d > 0).map((d) => WEEKDAY_LONG[d].slice(0, 3));
          return (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
            >
              <Card>
                <Text variant="label">{r.name}</Text>
                <Text variant="caption" muted>
                  {r.day_names.length} {r.day_names.length === 1 ? 'día' : 'días'} ·{' '}
                  {r.routine_exercises?.length ?? 0} {r.routine_exercises?.length === 1 ? 'ejercicio' : 'ejercicios'}
                  {scheduled.length ? ` · ${scheduled.join(', ')}` : ''}
                </Text>
              </Card>
            </Pressable>
          );
        })}
        <Button title="Nueva rutina" onPress={() => router.push('/routine-edit')} />
        <Button title="Sesión libre" variant="secondary" onPress={() => void startFree()} loading={busy} />
      </View>

      <Card>
        <Text variant="heading">Volumen de esta semana</Text>
        <Text variant="caption" muted>
          Series y kg totales por grupo muscular (desde el lunes).
        </Text>
        {data && !data.volume.length ? <Text muted>Sin series registradas esta semana.</Text> : null}
        {data?.volume.map((v) => (
          <View key={v.muscleGroup} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="label">{MUSCLE_LABELS[v.muscleGroup as keyof typeof MUSCLE_LABELS] ?? v.muscleGroup}</Text>
              <Text variant="caption" muted>
                {v.sets} {v.sets === 1 ? 'serie' : 'series'} · {formatKg(Math.round(v.volumeKg))} kg
              </Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: colors.surfaceAlt }}>
              <View
                style={{ height: 6, borderRadius: 3, backgroundColor: colors.primary, width: `${(v.sets / maxSets) * 100}%` }}
              />
            </View>
          </View>
        ))}
      </Card>

      <Button title="Historial de sesiones" variant="secondary" onPress={() => router.push('/history')} />
      <Button title="Biblioteca de ejercicios" variant="secondary" onPress={() => router.push('/exercises')} />
    </Screen>
  );
}
