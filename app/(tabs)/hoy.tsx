import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ActionSheet } from '../../src/components/action-sheet';
import { TopTabs } from '../../src/components/top-tabs';
import { ErrorText, LinkButton, Screen, Text } from '../../src/components/ui';
import { targetsForWeekday } from '../../src/lib/day-targets';
import { addLogs, addWater, getLogs, getWaterMl, listPlan, type EntryDraft, type PlanEntry } from '../../src/lib/diet';
import { MEALS, MEAL_LABELS, addDays, formatMl, isoWeekday, sumMacros, toISODate } from '../../src/lib/diet-math';
import { DEFAULT_TRAINING_SLOT, TRAINING_SLOTS, TRAINING_SLOT_KEY, dayEvents, isTrainingSlot, slotLabel, type TrainingSlot } from '../../src/lib/day-order';
import { tap } from '../../src/lib/haptics';
import { loadPref, savePref } from '../../src/lib/local-prefs';
import { getKcalRows, getSessionDates } from '../../src/lib/progress';
import { computeStreak, kcalByDay } from '../../src/lib/progress-math';
import { getActiveSession, getRoutine, listRoutines, planForDay, startSession } from '../../src/lib/training';
import { useFocusData } from '../../src/lib/use-focus-data';
import { useAuth } from '../../src/providers/AuthProvider';
import { radius, spacing, useTheme } from '../../src/theme';

const draftOf = (p: PlanEntry): EntryDraft => ({
  meal: p.meal,
  food_id: p.food_id,
  recipe_id: p.recipe_id,
  name: p.name,
  quantity_g: p.quantity_g,
  servings: p.servings,
  kcal: p.kcal,
  protein_g: p.protein_g,
  carbs_g: p.carbs_g,
  fat_g: p.fat_g,
});

/** Contenedor de una entrada: pulsable solo si lleva acción (un botón no puede contener otros botones). */
function Wrapper({ onPress, children }: { onPress?: () => void; children: React.ReactNode }) {
  if (!onPress) return <View style={{ marginBottom: spacing.lg }}>{children}</View>;
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={{ marginBottom: spacing.lg }}>
      {children}
    </Pressable>
  );
}

/** Una entrada de la línea del día: punto (relleno si está hecha), título y cifra a la derecha. */
function Event({
  title,
  value,
  detail,
  done,
  children,
  onPress,
}: {
  title: string;
  value?: string;
  detail?: string;
  done: boolean;
  children?: React.ReactNode;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Wrapper onPress={onPress}>
      <View
        style={{
          position: 'absolute',
          left: -28,
          top: 5,
          width: 12,
          height: 12,
          borderRadius: 6,
          backgroundColor: done ? colors.primary : colors.background,
          borderWidth: 2,
          borderColor: done ? colors.primary : colors.textMuted,
        }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md }}>
        <Text variant="body" style={{ fontWeight: '800', color: done ? colors.text : colors.textMuted }}>
          {title}
        </Text>
        {value ? (
          <Text variant="heading" style={{ color: done ? colors.text : colors.textMuted }}>
            {value}
          </Text>
        ) : null}
      </View>
      {detail ? (
        <Text variant="caption" muted numberOfLines={2}>
          {detail}
        </Text>
      ) : null}
      {children}
    </Wrapper>
  );
}

function Chip({ title, onPress, dark, disabled }: { title: string; onPress: () => void; dark?: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={{ alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: 14, minHeight: 32, justifyContent: 'center', borderRadius: 999, backgroundColor: dark ? colors.ink : colors.primary, opacity: disabled ? 0.5 : 1 }}
    >
      <Text variant="label" style={{ color: dark ? colors.onInk : colors.onPrimary, fontWeight: '700', fontSize: 13 }}>
        {title}
      </Text>
    </Pressable>
  );
}

export default function Hoy() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, profile } = useAuth();
  const today = toISODate(new Date());
  const weekday = isoWeekday(today);

  const { data, error, loading, reload } = useFocusData(async () => {
    const since = addDays(today, -90);
    const [logs, water, routines, active, kcalRows, sessionDates, plan] = await Promise.all([
      getLogs(today),
      getWaterMl(today),
      listRoutines(),
      getActiveSession(),
      getKcalRows(since),
      getSessionDates(since),
      listPlan().catch(() => [] as PlanEntry[]),
    ]);
    return { logs, water, routines, active, kcalRows, sessionDates, plan };
  });
  const [slot, setSlot] = useState<TrainingSlot>(DEFAULT_TRAINING_SLOT);
  const [moving, setMoving] = useState(false);
  useEffect(() => {
    void loadPref<unknown>(TRAINING_SLOT_KEY, DEFAULT_TRAINING_SLOT).then((v) => setSlot(isTrainingSlot(v) ? v : DEFAULT_TRAINING_SLOT));
  }, []);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const logs = data?.logs ?? [];
  const total = sumMacros(logs);
  const todayTargets = targetsForWeekday(profile, weekday);
  const kcalTarget = todayTargets.kcal;
  const waterGoal = profile?.water_goal_ml ?? 2500;
  const kcalLeft = kcalTarget != null ? Math.round(kcalTarget - total.kcal) : null;
  const plannedToday = (data?.plan ?? []).filter((p) => p.weekday === weekday);

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

  const run = async (fn: () => Promise<void>, msg: string) => {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch {
      setActionError(msg);
    }
  };

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

  const addPlanned = (items: PlanEntry[]) =>
    run(async () => {
      if (!session) return;
      await addLogs(session.user.id, today, items.map(draftOf));
      tap();
    }, 'No se pudo añadir al diario. Comprueba tu conexión.');

  const drink = () =>
    run(async () => {
      if (session) await addWater(session.user.id, today, 250);
      tap();
    }, 'No se pudo registrar el agua.');

  // Línea del día: las comidas en su orden y el entreno donde lo haya puesto el usuario
  const events = dayEvents(slot);

  const mealsDone = MEALS.filter((m) => logs.some((l) => l.meal === m)).length;
  const date = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const macros = [
    { label: 'Proteína', value: Math.round(total.protein_g), target: todayTargets.protein_g },
    { label: 'Carbos', value: Math.round(total.carbs_g), target: todayTargets.carbs_g },
    { label: 'Grasa', value: Math.round(total.fat_g), target: todayTargets.fat_g },
  ];

  return (
    <Screen>
      <TopTabs />
      <ErrorText>{error ?? actionError}</ErrorText>

      <View style={{ gap: 2 }}>
        <Text variant="caption" muted style={{ fontWeight: '500' }}>
          {date[0].toUpperCase() + date.slice(1)}
        </Text>
        {kcalLeft != null ? (
          <Text variant="title" style={{ fontSize: 52, lineHeight: 50, color: kcalLeft < 0 ? colors.danger : colors.text }}>
            {kcalLeft >= 0 ? 'Te quedan' : 'Te has pasado'}
            {'\n'}
            {Math.abs(kcalLeft).toLocaleString('es-ES')} kcal
          </Text>
        ) : (
          <Text variant="title" style={{ fontSize: 40, lineHeight: 42 }}>
            Hoy
          </Text>
        )}
      </View>

      <View style={{ gap: spacing.sm, marginTop: -spacing.md }}>
        <View style={{ flexDirection: 'row', gap: 4 }}>
          {MEALS.map((m) => (
            <View key={m} style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: logs.some((l) => l.meal === m) ? colors.primary : colors.surfaceAlt }} />
          ))}
        </View>
        <Text variant="caption" muted>
          {mealsDone} de {MEALS.length} comidas hechas · agua {formatMl(data?.water ?? 0)} / {formatMl(waterGoal)}
        </Text>
      </View>

      <View style={{ paddingLeft: 30, marginTop: -spacing.sm }}>
        <View style={{ position: 'absolute', left: 7, top: 6, bottom: 24, width: 2, backgroundColor: colors.border }} />
        {events.map((e) => {
          if (e.kind === 'training') {
            const active = data?.active;
            return (
              <Event
                key="training"
                title={active ? `Entreno en curso · ${active.routine_name}` : scheduledToday.length ? `Entreno · ${scheduledToday[0].routine.name}` : 'Entreno'}
                value={undefined}
                detail={
                  doneToday && !active
                    ? 'Completado hoy ✓'
                    : scheduledToday.length
                      ? scheduledToday[0].name
                      : loading
                        ? 'Cargando…'
                        : 'Sin entreno programado hoy'
                }
                done={doneToday && !active}
              >
                {active ? (
                  <Chip dark title="Continuar sesión" onPress={() => router.push({ pathname: '/workout/[id]', params: { id: active.id } })} />
                ) : !doneToday && scheduledToday.length ? (
                  <Chip dark title="Empezar" disabled={busy} onPress={() => void startScheduled(scheduledToday[0].routine.id, scheduledToday[0].dayIndex)} />
                ) : !doneToday ? (
                  <Chip dark title="Ver rutinas" onPress={() => router.push('/entreno')} />
                ) : null}
                <LinkButton title={`Mover · ${slotLabel(slot).toLowerCase()}`} onPress={() => setMoving(true)} />
              </Event>
            );
          }
          const entries = logs.filter((l) => l.meal === e.meal);
          const planned = plannedToday.filter((p) => p.meal === e.meal);
          const done = entries.length > 0;
          const shown = done ? entries : planned;
          const kcal = Math.round(sumMacros(shown).kcal);
          return (
            <Event
              key={e.meal}
              title={MEAL_LABELS[e.meal]}
              value={shown.length ? String(kcal) : undefined}
              detail={shown.length ? shown.map((x) => x.name).join(' · ') : 'Sin planificar'}
              done={done}
              onPress={done ? () => router.push('/dieta') : undefined}
            >
              {!done ? (
                planned.length ? (
                  <Chip title="Añadir al diario" onPress={() => void addPlanned(planned)} />
                ) : (
                  <Chip
                    title="Añadir"
                    onPress={() => router.push({ pathname: '/food-add', params: { target: 'diary', meal: e.meal, date: today } })}
                  />
                )
              ) : null}
            </Event>
          );
        })}
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {macros.map((m) => (
          <View key={m.label} style={{ flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: spacing.md, gap: 2 }}>
            <Text variant="title" style={{ fontSize: 32, lineHeight: 32 }}>
              {m.value}
            </Text>
            <Text variant="caption" muted>
              / {m.target ?? '—'} g
            </Text>
            <Text variant="caption" style={{ fontWeight: '700' }}>
              {m.label}
            </Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="caption" muted>
          Racha: {streak} {streak === 1 ? 'día' : 'días'}
        </Text>
        <LinkButton title="+ 250 ml de agua" onPress={() => void drink()} />
      </View>
      <View style={{ height: 70 }} />
      <ActionSheet
        visible={moving}
        title="¿Cuándo entrenas?"
        onClose={() => setMoving(false)}
        actions={TRAINING_SLOTS.map((s) => ({
          label: `${slotLabel(s)}${s === slot ? ' ✓' : ''}`,
          onPress: () => {
            setSlot(s);
            void savePref(TRAINING_SLOT_KEY, s);
          },
        }))}
      />
    </Screen>
  );
}
