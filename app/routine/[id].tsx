import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, ErrorText, Screen, Text } from '../../src/components/ui';
import { useAuth } from '../../src/providers/AuthProvider';
import { confirm } from '../../src/lib/confirm';
import { EQUIPMENT_LABELS, MUSCLE_LABELS, WEEKDAY_LONG } from '../../src/lib/labels';
import { deleteRoutine, getRoutine, planForDay, startSession } from '../../src/lib/training';
import { useFocusData } from '../../src/lib/use-focus-data';

export default function RoutineView() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: routine, error, loading } = useFocusData(() => getRoutine(id), [id]);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const start = async (dayIndex: number) => {
    if (!routine || !session) return;
    setBusy(true);
    setActionError(null);
    try {
      const plan = planForDay(routine, dayIndex);
      const sid = await startSession(session.user.id, routine.id, `${routine.name} · ${routine.day_names[dayIndex]}`, plan);
      router.replace({ pathname: '/workout/[id]', params: { id: sid } });
    } catch {
      setActionError('No se pudo iniciar la sesión. Comprueba tu conexión.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!routine) return;
    const ok = await confirm('Eliminar rutina', 'Tu historial de sesiones se conserva.', 'Eliminar', true);
    if (!ok) return;
    try {
      await deleteRoutine(routine.id);
      router.back();
    } catch {
      setActionError('No se pudo eliminar la rutina.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <Text muted>Cargando…</Text>
      </Screen>
    );
  }
  if (error || !routine) {
    return (
      <Screen>
        <ErrorText>{error ?? 'No se encontró la rutina.'}</ErrorText>
        <Button title="Volver" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{routine.name}</Text>
      {routine.notes ? <Text muted>{routine.notes}</Text> : null}

      {routine.day_names.map((dayName, di) => {
        const items = (routine.routine_exercises ?? []).filter((e) => e.day_index === di);
        const weekday = routine.schedule[di];
        return (
          <Card key={di}>
            <Text variant="heading">{dayName}</Text>
            {weekday ? (
              <Text variant="caption" muted>
                Programado: {WEEKDAY_LONG[weekday]}
              </Text>
            ) : null}
            {items.map((e) => (
              <Text key={e.id}>
                {e.exercises?.name ?? 'Ejercicio'}{' '}
                <Text muted>
                  — {e.sets}×{e.reps_target}, descanso {e.rest_seconds} s
                  {e.exercises ? ` · ${MUSCLE_LABELS[e.exercises.muscle_group]} · ${EQUIPMENT_LABELS[e.exercises.equipment]}` : ''}
                </Text>
                {e.notes ? <Text variant="caption" muted>{`\n${e.notes}`}</Text> : null}
              </Text>
            ))}
            <Button title="Empezar este día" onPress={() => void start(di)} loading={busy} />
          </Card>
        );
      })}

      <ErrorText>{actionError}</ErrorText>
      <Button
        title="Editar rutina"
        variant="secondary"
        onPress={() => router.push({ pathname: '/routine-edit', params: { id: routine.id } })}
      />
      <Button title="Eliminar rutina" variant="danger" onPress={() => void remove()} />
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
