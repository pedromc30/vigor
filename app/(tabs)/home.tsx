import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { MacroRow } from '../../src/components/plan-summary';
import { Button, Card, ErrorText, Screen, Text } from '../../src/components/ui';
import { addWater, getLogs, getWaterMl } from '../../src/lib/diet';
import { addDays, formatMl, isoWeekday, sumMacros, toISODate, type Meal } from '../../src/lib/diet-math';
import { getKcalRows, getSessionDates } from '../../src/lib/progress';
import { computeStreak, kcalByDay } from '../../src/lib/progress-math';
import { getActiveSession, getRoutine, listRoutines, planForDay, startSession } from '../../src/lib/training';
import { useFocusData } from '../../src/lib/use-focus-data';
import { useAuth } from '../../src/providers/AuthProvider';
import { spacing, useTheme } from '../../src/theme';

const mealByHour = (h: number): Meal => (h < 11 ? 'desayuno' : h < 16 ? 'comida' : h < 19 ? 'merienda' : 'cena');

export default function Inicio() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, profile } = useAuth();
  const today = toISODate(new Date());
  const weekday = isoWeekday(today);

  const { data, error, loading, reload } = useFocusData(async () => {
    const since = addDays(today, -90);
    const [logs, water, routines, active, kcalRows, sessionDates] = await Promise.all([
      getLogs(today),
      getWaterMl(today),
      listRoutines(),
      getActiveSession(),
      getKcalRows(since),
      getSessionDates(since),
    ]);
    return { logs, water, routines, active, kcalRows, sessionDates };
  });
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const total = sumMacros(data?.logs ?? []);
  const kcalTarget = profile?.target_kcal ?? null;
  const waterGoal = profile?.water_goal_ml ?? 2500;
  const left = (target: number | null | undefined, used: number) => (target != null ? Math.round(target - used) : null);
  const kcalLeft = left(kcalTarget, total.kcal);

  const scheduledToday = (data?.routines ?? []).flatMap((r) =>
    r.schedule.map((d, i) => (d === weekday ? { routine: r, dayIndex: i, name: r.day_names[i] } : null)).filter(Boolean),
  ) as { routine: NonNullable<typeof data>['routines'][number]; dayIndex: number; name: string }[];
  const doneToday = !!data?.sessionDates.includes(today);

  const streak = data
    ? computeStreak({
        today,
        kcalByDay: kcalByDay(data.kcalRows),
        target: kcalTarget,
        sessionDates: new Set(data.sessionDates),
        scheduledWeekdays: new Set(data.routines.flatMap((r) => r.schedule.filter((d) => d > 0))),
      })
    : 0;

  const startScheduled = async (routineId: string, dayIndex: number) => {
    if (!session) return;
    setBusy(true);
    setActionError(null);
    try {
      const routine = await getRoutine(routineId);
      if (!routine) throw new Error('missing');
      const id = await startSession(session.user.id, routine.id, `${routine.name} · ${routine.day_names[dayIndex]}`, planForDay(routine, dayIndex));
      router.push({ pathname: '/workout/[id]', params: { id } });
    } catch {
      setActionError('No se pudo iniciar el entreno. Comprueba tu conexión.');
    } finally {
      setBusy(false);
    }
  };

  const startWorkout = () => {
    if (data?.active) return router.push({ pathname: '/workout/[id]', params: { id: data.active.id } });
    if (scheduledToday.length) return void startScheduled(scheduledToday[0].routine.id, scheduledToday[0].dayIndex);
    router.push('/entreno');
  };

  const drink = async () => {
    if (!session) return;
    try {
      await addWater(session.user.id, today, 250);
      await reload();
    } catch {
      setActionError('No se pudo registrar el agua.');
    }
  };

  return (
    <Screen>
      <View>
        <Text variant="title">Inicio</Text>
        <Text muted>{new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
      </View>
      <ErrorText>{error ?? actionError}</ErrorText>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Empezar entreno" onPress={startWorkout} loading={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="Añadir comida"
            variant="secondary"
            onPress={() => router.push({ pathname: '/food-add', params: { target: 'diary', meal: mealByHour(new Date().getHours()), date: today } })}
          />
        </View>
      </View>
      <Button title="Registrar peso" variant="secondary" onPress={() => router.push('/weight')} />

      <Card>
        <Text variant="caption" muted>
          Te quedan hoy
        </Text>
        {kcalLeft != null ? (
          <Text style={{ fontSize: 48, fontWeight: '700', lineHeight: 54, color: kcalLeft < 0 ? colors.danger : colors.text }}>
            {Math.abs(kcalLeft).toLocaleString('es-ES')} kcal
          </Text>
        ) : (
          <Text muted>Sin objetivo calórico</Text>
        )}
        {kcalLeft != null && kcalLeft < 0 ? <Text variant="caption" style={{ color: colors.danger }}>Te has pasado de tu objetivo.</Text> : null}
        <Text variant="caption" muted>
          Has tomado {Math.round(total.kcal).toLocaleString('es-ES')} de {kcalTarget?.toLocaleString('es-ES') ?? '—'} kcal
        </Text>
        <MacroRow
          proteinG={Math.max(0, left(profile?.target_protein_g, total.protein_g) ?? 0)}
          carbsG={Math.max(0, left(profile?.target_carbs_g, total.carbs_g) ?? 0)}
          fatG={Math.max(0, left(profile?.target_fat_g, total.fat_g) ?? 0)}
        />
        <Text variant="caption" muted>
          Gramos que te quedan de cada macro.
        </Text>
      </Card>

      <Card>
        <Text variant="heading">Entreno de hoy</Text>
        {data?.active ? (
          <>
            <Text muted>Tienes una sesión en curso: {data.active.routine_name}.</Text>
            <Button title="Continuar sesión" onPress={() => router.push({ pathname: '/workout/[id]', params: { id: data.active!.id } })} />
          </>
        ) : doneToday ? (
          <Text style={{ fontWeight: '600' }}>Entreno completado hoy ✓</Text>
        ) : scheduledToday.length ? (
          scheduledToday.map((s) => (
            <View key={`${s.routine.id}-${s.dayIndex}`} style={{ gap: spacing.sm }}>
              <Text>
                {s.routine.name} · {s.name}
              </Text>
              <Button title="Empezar" onPress={() => void startScheduled(s.routine.id, s.dayIndex)} loading={busy} />
            </View>
          ))
        ) : (
          <Text muted>{loading ? 'Cargando…' : 'No tienes entreno programado hoy. Asigna un día de la semana a tus rutinas para verlo aquí.'}</Text>
        )}
      </Card>

      <Card>
        <Text variant="heading">Agua</Text>
        <Text>
          {formatMl(data?.water ?? 0)} <Text muted>de {formatMl(waterGoal)}</Text>
        </Text>
        <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt }}>
          <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.protein, width: `${Math.min(100, ((data?.water ?? 0) / waterGoal) * 100)}%` }} />
        </View>
        <Button title="+ 250 ml" variant="secondary" onPress={() => void drink()} />
      </Card>

      <Card>
        <Text variant="heading">Racha</Text>
        <Text style={{ fontSize: 32, fontWeight: '700' }}>
          {streak} {streak === 1 ? 'día' : 'días'}
        </Text>
        <Text variant="caption" muted>
          Días seguidos con tus calorías dentro de ±10 % del objetivo y, si tenías entreno programado, entrenado. El día de hoy no rompe la racha hasta que termina.
        </Text>
      </Card>
    </Screen>
  );
}
