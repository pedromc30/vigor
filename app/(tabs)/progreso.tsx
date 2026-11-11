import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TopTabs } from '../../src/components/top-tabs';
import { BarChart, ChartFrame, LineChart } from '../../src/components/charts';
import { Button, Card, ChipSingle, ErrorText, Screen, Text } from '../../src/components/ui';
import { PR_LABELS, achievementDetail, achievementTitle, prKindsBySession, type PRKind } from '../../src/lib/achievements';
import { ensureAchievementsBackfill, listAchievements, listGoals } from '../../src/lib/achievements-data';
import { addDays, fromISODate, toISODate } from '../../src/lib/diet-math';
import { loadPref, savePref } from '../../src/lib/local-prefs';
import { MIN_KCAL } from '../../src/lib/nutrition';
import { getExerciseSets, getKcalRows, getSessionDates, listMetrics, listTrainedExercises } from '../../src/lib/progress';
import { listExercises } from '../../src/lib/training';
import {
  daysBetween,
  filterByRange,
  kcalByDay,
  macrosForNewKcal,
  metricValue,
  movingAverage,
  sessionBests,
  suggestAdjustment,
  weeklyAdherence,
  type DatedValue,
  type EvolutionMetric,
  type EvolutionRange,
} from '../../src/lib/progress-math';
import { formatKg } from '../../src/lib/training-math';
import { useFocusData } from '../../src/lib/use-focus-data';
import { useAuth } from '../../src/providers/AuthProvider';
import { spacing, useTheme } from '../../src/theme';

const DECISION_KEY = 'vigor.adjustment.lastDecision';
const short = (iso: string) => fromISODate(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
const long = (iso: string) => fromISODate(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const fmtNum = (n: number) => Math.round(n).toLocaleString('es-ES');

type Range = '30' | '90' | 'all';

const METRIC_OPTIONS: { key: EvolutionMetric; label: string }[] = [
  { key: 'weight', label: 'Peso máximo' },
  { key: '1rm', label: '1RM estimado' },
  { key: 'reps', label: 'Repeticiones' },
  { key: 'volume', label: 'Volumen' },
];
const METRIC_TITLES: Record<EvolutionMetric, string> = {
  weight: 'Peso máximo de la sesión',
  '1rm': '1RM estimado (mejor serie)',
  reps: 'Repeticiones totales',
  volume: 'Volumen de la sesión',
};
const LOAD_RANGE_OPTIONS: { key: EvolutionRange; label: string }[] = [
  { key: '1m', label: '1 mes' },
  { key: '3m', label: '3 meses' },
  { key: '6m', label: '6 meses' },
  { key: '1y', label: '1 año' },
  { key: 'all', label: 'Todo' },
];
const oneDecimal = (v: number) => String(Math.round(v * 10) / 10).replace('.', ',');
const formatMetric = (m: EvolutionMetric, v: number) => (m === 'weight' || m === '1rm' ? `${oneDecimal(v)} kg` : m === 'volume' ? `${fmtNum(v)} kg` : `${fmtNum(v)} rep.`);

export default function Progreso() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, profile, saveProfile } = useAuth();
  const today = toISODate(new Date());
  const since = addDays(today, -8 * 7 - 6);

  const { data, error, loading, reload } = useFocusData(async () => {
    // Reconoce una sola vez los récords del historial anterior (sin celebrarlos) antes de leer los logros.
    if (session) await ensureAchievementsBackfill(session.user.id);
    const [metrics, kcalRows, sessionDates, exercises, lastDecision, goals, achievements, catalog] = await Promise.all([
      listMetrics(),
      getKcalRows(since),
      getSessionDates(since),
      listTrainedExercises(),
      loadPref<string | null>(DECISION_KEY, null),
      listGoals().catch(() => []),
      listAchievements(1).catch(() => []),
      listExercises().catch(() => []),
    ]);
    return { metrics, kcalRows, sessionDates, exercises, lastDecision, goals, achievements, catalog };
  });

  const [range, setRange] = useState<Range>('90');
  const [weightSel, setWeightSel] = useState<number | null>(null);
  const [kcalSel, setKcalSel] = useState<number | null>(null);
  const [weekSel, setWeekSel] = useState<number | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [loadSel, setLoadSel] = useState<number | null>(null);
  const [metric, setMetric] = useState<EvolutionMetric>('weight');
  const [loadRange, setLoadRange] = useState<EvolutionRange>('3m');
  const [exSets, setExSets] = useState<Awaited<ReturnType<typeof getExerciseSets>> | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!exerciseId && data?.exercises.length) setExerciseId(data.exercises[0].id);
  }, [data, exerciseId]);

  useEffect(() => {
    if (!exerciseId) return;
    setExSets(null);
    setLoadSel(null);
    getExerciseSets(exerciseId).then(setExSets).catch(() => setActionError('No se pudo cargar la evolución del ejercicio.'));
  }, [exerciseId]);

  const target = profile?.target_kcal ?? null;

  // ----- Peso
  const weights: DatedValue[] = useMemo(
    () => (data?.metrics ?? []).filter((m) => m.weight_kg != null).map((m) => ({ date: m.measured_on, value: m.weight_kg! })),
    [data],
  );
  const averages = useMemo(() => movingAverage(weights), [weights]);
  const shownWeights = useMemo(() => {
    if (range === 'all') return weights;
    const from = addDays(today, -Number(range));
    return weights.filter((w) => w.date >= from);
  }, [weights, range, today]);
  const shownAverages = averages.filter((a) => shownWeights.some((w) => w.date === a.date));
  const t0 = shownWeights[0]?.date;
  const latest = weights[weights.length - 1];
  const latestAvg = averages[averages.length - 1];
  const weekAgo = latest ? averages.filter((a) => daysBetween(a.date, latest.date) >= 7).pop() : undefined;
  const weeklyChange = latestAvg && weekAgo ? latestAvg.value - weekAgo.value : null;

  // ----- Calorías (14 días)
  const kcalDays = useMemo(() => kcalByDay(data?.kcalRows ?? []), [data]);
  const last14 = Array.from({ length: 14 }, (_, i) => addDays(today, -13 + i));

  // ----- Adherencia (8 semanas)
  const adherence = useMemo(
    () =>
      weeklyAdherence({
        weeks: 8,
        today,
        kcalByDay: kcalDays,
        target,
        sessionDates: data?.sessionDates ?? [],
        plannedPerWeek: profile?.training_days_per_week ?? 0,
      }),
    [kcalDays, target, data, profile, today],
  );

  // ----- Cargas: sesiones del ejercicio, dentro del rango y con valor en la métrica elegida
  const allSessions = useMemo(() => (exSets ? sessionBests(exSets) : []), [exSets]);
  const prBySession = useMemo(() => (exSets ? prKindsBySession(exSets) : new Map<string, PRKind[]>()), [exSets]);
  const points = useMemo(
    () =>
      filterByRange(allSessions, loadRange, today)
        .map((b) => ({ b, v: metricValue(b, metric) }))
        .filter((p): p is { b: (typeof allSessions)[number]; v: number } => p.v != null),
    [allSessions, loadRange, metric, today],
  );
  const recordIdx = points.map((p, i) => (prBySession.has(p.b.sessionId) ? i : -1)).filter((i) => i >= 0);
  const selectedPoint = loadSel != null ? points[loadSel] : undefined;
  const exerciseName = data?.exercises.find((e) => e.id === exerciseId)?.name ?? '';

  // ----- Ajuste semanal
  const adjustment = useMemo(() => {
    if (!profile?.goal || !target || !profile.sex || !profile.weight_kg) return null;
    return suggestAdjustment({
      goal: profile.goal,
      today,
      weights,
      kcalDaysLogged: last14.filter((d) => (kcalDays[d] ?? 0) > 0).length,
      currentKcal: target,
      minKcal: MIN_KCAL[profile.sex],
      weightKg: latest?.value ?? profile.weight_kg,
      lastDecisionDate: data?.lastDecision ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, target, weights, kcalDays, data, today]);

  const decide = async (accept: boolean) => {
    if (!profile || !adjustment?.newKcal) return;
    setApplying(true);
    setActionError(null);
    try {
      if (accept) {
        const m = macrosForNewKcal(adjustment.newKcal, profile.target_protein_g ?? 0, profile.target_fat_g ?? 0);
        await saveProfile({ target_kcal: m.kcal, target_carbs_g: m.carbs_g, targets_manual: true });
      }
      await savePref(DECISION_KEY, today);
      await reload();
    } catch {
      setActionError('No se pudo guardar tu decisión. Comprueba tu conexión.');
    } finally {
      setApplying(false);
    }
  };

  // ----- Perímetros
  const girths = [
    { key: 'waist_cm', label: 'Cintura' },
    { key: 'hip_cm', label: 'Cadera' },
    { key: 'arm_cm', label: 'Brazo' },
    { key: 'thigh_cm', label: 'Muslo' },
  ] as const;
  const girthRows = girths.map((g) => {
    const vals = (data?.metrics ?? []).filter((m) => m[g.key] != null);
    const last = vals[vals.length - 1];
    const prev = vals[vals.length - 2];
    return { ...g, last: last?.[g.key] ?? null, date: last?.measured_on, delta: last && prev ? (last[g.key]! - prev[g.key]!) : null };
  });

  const signed = (n: number, d = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toFixed(d).replace('.', ',')}`;

  return (
    <Screen>
      <TopTabs />
      <Text variant="title">Progreso</Text>
      <ErrorText>{error ?? actionError}</ErrorText>
      {loading ? <Text muted>Cargando…</Text> : null}

      <Card>
        <Text variant="caption" muted>
          Peso actual
        </Text>
        {latest ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
              <Text variant="display" style={{ fontSize: 56, lineHeight: 62, fontVariant: ['tabular-nums'] }}>
                {formatKg(latest.value)}
              </Text>
              <Text variant="heading" muted style={{ fontWeight: '400' }}>
                kg
              </Text>
            </View>
            <Text variant="caption" muted>
              {short(latest.date)} · media 7 días {latestAvg ? `${formatKg(latestAvg.value)} kg` : '—'}
              {weeklyChange != null ? ` · ${signed(weeklyChange)} kg en la última semana` : ''}
            </Text>
          </>
        ) : (
          <Text muted>Registra tu peso para ver tu tendencia.</Text>
        )}
      </Card>

      <Card>
        <ChipSingle
          value={range}
          onChange={(v) => {
            setRange(v ?? '90');
            setWeightSel(null);
          }}
          options={[
            { key: '30', label: '30 días' },
            { key: '90', label: '90 días' },
            { key: 'all', label: 'Todo' },
          ]}
        />
        {shownWeights.length ? (
          <ChartFrame
            title="Tendencia de peso"
            readout={
              weightSel != null && shownWeights[weightSel]
                ? `${short(shownWeights[weightSel].date)} · ${formatKg(shownWeights[weightSel].value)} kg · media ${formatKg(shownAverages[weightSel]?.value ?? shownWeights[weightSel].value)} kg`
                : 'Toca un punto para ver el detalle'
            }
            legend={[
              { label: 'Peso diario', color: colors.textMuted, kind: 'dot' },
              { label: 'Media 7 días', color: colors.chart1, kind: 'line' },
            ]}
            table={{ headers: ['Fecha', 'Peso', 'Media 7 d'], rows: shownWeights.map((w, i) => [short(w.date), `${formatKg(w.value)} kg`, `${formatKg(shownAverages[i]?.value ?? w.value)} kg`]) }}
          >
            <LineChart
              ariaLabel={`Peso entre ${short(shownWeights[0].date)} y ${short(shownWeights[shownWeights.length - 1].date)}: de ${formatKg(shownWeights[0].value)} a ${formatKg(shownWeights[shownWeights.length - 1].value)} kilos`}
              series={[
                { label: 'Peso diario', color: colors.textMuted, dotsOnly: true, points: shownWeights.map((w) => ({ t: daysBetween(t0!, w.date), v: w.value })) },
                { label: 'Media 7 días', color: colors.chart1, points: shownAverages.map((a) => ({ t: daysBetween(t0!, a.date), v: a.value })) },
              ]}
              xLabels={[
                { t: 0, label: short(shownWeights[0].date) },
                { t: daysBetween(t0!, shownWeights[shownWeights.length - 1].date), label: short(shownWeights[shownWeights.length - 1].date) },
              ]}
              format={(v) => String(Math.round(v * 10) / 10).replace('.', ',')}
              selected={weightSel}
              onSelect={setWeightSel}
            />
          </ChartFrame>
        ) : (
          <Text muted>No hay pesajes en este periodo.</Text>
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Registrar peso" onPress={() => router.push('/weight')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Fotos" variant="secondary" onPress={() => router.push('/photos')} />
        </View>
      </View>

      {adjustment && adjustment.status !== 'cooldown' ? (
        <Card>
          <Text variant="heading">Ajuste semanal</Text>
          <Text>{adjustment.message}</Text>
          {adjustment.status === 'suggest' ? (
            <>
              <Text variant="caption" muted>
                Orientativo: no sustituye a un dietista-nutricionista ni a un médico. Tú decides. Si aceptas, la proteína y la grasa se mantienen y los carbohidratos absorben el cambio.
              </Text>
              <Button title={`Aplicar ${adjustment.deltaKcal > 0 ? '+' : '−'}${Math.abs(adjustment.deltaKcal)} kcal`} onPress={() => void decide(true)} loading={applying} />
              <Button title="Ahora no" variant="ghost" onPress={() => void decide(false)} disabled={applying} />
            </>
          ) : null}
        </Card>
      ) : null}

      <Card tone="amber">
        <Text variant="heading">Logros</Text>
        {(() => {
          const pending = (data?.goals ?? []).filter((g) => !g.achieved_at).length;
          const last = data?.achievements[0];
          const lastName = last ? (data?.catalog.find((e) => e.id === last.exercise_id)?.name ?? '') : '';
          return (
            <>
              <Text muted>
                {pending === 0 ? 'Sin objetivos pendientes' : pending === 1 ? '1 objetivo pendiente' : `${pending} objetivos pendientes`}
              </Text>
              {last ? (
                <Text variant="caption" muted>
                  Último: {achievementTitle(last.kind)} · {lastName ? `${lastName} · ` : ''}
                  {achievementDetail(last)} ({short(last.achieved_at.slice(0, 10))})
                </Text>
              ) : (
                <Text variant="caption" muted>
                  Tus récords y objetivos conseguidos aparecerán aquí.
                </Text>
              )}
            </>
          );
        })()}
        <Button title="Ver logros y objetivos" variant="secondary" onPress={() => router.push('/achievements')} />
      </Card>

      <Card>
        <Text variant="heading">Perímetros</Text>
        {girthRows.map((g) => (
          <View key={g.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text>{g.label}</Text>
            <Text muted>
              {g.last != null ? `${formatKg(g.last)} cm${g.delta != null ? ` (${signed(g.delta)})` : ''}` : '—'}
            </Text>
          </View>
        ))}
        <Text variant="caption" muted>
          El cambio es respecto a la medición anterior. Regístralas en «Registrar peso».
        </Text>
      </Card>

      <Card>
        <ChartFrame
          title="Calorías vs objetivo"
          subtitle="Últimos 14 días"
          readout={
            kcalSel != null
              ? `${long(last14[kcalSel])} · ${kcalDays[last14[kcalSel]] ? `${fmtNum(kcalDays[last14[kcalSel]])} kcal` : 'sin registro'}${target ? ` (objetivo ${fmtNum(target)})` : ''}`
              : 'Toca una barra para ver el detalle'
          }
          table={{ headers: ['Día', 'Kcal'], rows: last14.map((d) => [short(d), kcalDays[d] ? fmtNum(kcalDays[d]) : '—']) }}
        >
          <BarChart
            ariaLabel={`Calorías de los últimos 14 días frente al objetivo de ${target ?? 'ningún'} kcal`}
            categories={last14.map((d) => String(fromISODate(d).getDate()))}
            series={[{ label: 'Kcal', color: colors.chart1, values: last14.map((d) => kcalDays[d] ?? null) }]}
            target={target ? { value: target, label: `Objetivo ${fmtNum(target)}` } : undefined}
            format={(v) => (v >= 1000 ? `${Math.round(v / 100) / 10}k`.replace('.', ',') : String(v))}
            selected={kcalSel}
            onSelect={setKcalSel}
          />
        </ChartFrame>
      </Card>

      <Card>
        <ChartFrame
          title="Adherencia semanal"
          subtitle="Dieta: días con kcal dentro de ±10 % del objetivo. Entreno: sesiones hechas frente a tus días de entreno por semana."
          legend={[
            { label: 'Dieta', color: colors.chart1, kind: 'bar' },
            { label: 'Entreno', color: colors.chart2, kind: 'bar' },
          ]}
          readout={
            weekSel != null
              ? `Semana del ${short(adherence[weekSel].weekStart)} · dieta ${adherence[weekSel].dietPct} % (${adherence[weekSel].dietDays}/${adherence[weekSel].elapsedDays} días) · entreno ${adherence[weekSel].trainingPct} % (${adherence[weekSel].sessions} sesiones)`
              : 'Toca una semana para ver el detalle'
          }
          table={{ headers: ['Semana', 'Dieta', 'Entreno'], rows: adherence.map((w) => [short(w.weekStart), `${w.dietPct} %`, `${w.trainingPct} %`]) }}
        >
          <BarChart
            ariaLabel="Adherencia a la dieta y al entreno de las últimas 8 semanas"
            categories={adherence.map((w) => short(w.weekStart).replace(' ', ' '))}
            series={[
              { label: 'Dieta', color: colors.chart1, values: adherence.map((w) => w.dietPct) },
              { label: 'Entreno', color: colors.chart2, values: adherence.map((w) => w.trainingPct) },
            ]}
            maxValue={100}
            format={(v) => `${v}%`}
            selected={weekSel}
            onSelect={setWeekSel}
          />
        </ChartFrame>
      </Card>

      <Card>
        <Text variant="heading">Evolución de cargas</Text>
        {data && !data.exercises.length ? <Text muted>Cuando registres series en tus entrenos verás aquí la evolución de cada ejercicio.</Text> : null}
        {data?.exercises.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {data.exercises.map((e) => {
              const on = e.id === exerciseId;
              return (
                <Pressable
                  key={e.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => setExerciseId(e.id)}
                  style={{ paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center', borderRadius: 999, backgroundColor: on ? colors.primary : colors.surface, borderWidth: 1, borderColor: on ? colors.primary : colors.border }}
                >
                  <Text variant="caption" style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '600' }}>
                    {e.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {exerciseId && exSets ? (
          allSessions.length < 2 ? (
            <Text muted>
              {allSessions.length === 0
                ? `Todavía no hay sesiones de «${exerciseName}» con series normales.`
                : `Solo hay 1 sesión de «${exerciseName}». Registra al menos 2 sesiones para ver su evolución.`}
            </Text>
          ) : (
            <>
              <ChipSingle
                value={metric}
                onChange={(v) => {
                  setMetric(v ?? 'weight');
                  setLoadSel(null);
                }}
                options={METRIC_OPTIONS}
              />
              <ChipSingle
                value={loadRange}
                onChange={(v) => {
                  setLoadRange(v ?? '3m');
                  setLoadSel(null);
                }}
                options={LOAD_RANGE_OPTIONS}
              />
              {points.length < 2 ? (
                <Text muted>
                  {points.length === 0 && metric === '1rm'
                    ? 'En este periodo no hay series de hasta 10 repeticiones para estimar el 1RM.'
                    : 'Hay menos de 2 sesiones de este ejercicio en este periodo. Prueba con un rango mayor.'}
                </Text>
              ) : (
                <ChartFrame
                  title={METRIC_TITLES[metric]}
                  subtitle="Solo series normales (sin aproximación ni dropsets)"
                  readout={
                    selectedPoint
                      ? `${long(selectedPoint.b.date)} · ${formatMetric(metric, selectedPoint.v)}${prBySession.has(selectedPoint.b.sessionId) ? ' · récord' : ''}`
                      : 'Toca un punto para ver la sesión'
                  }
                  legend={[
                    { label: METRIC_TITLES[metric], color: colors.chart1, kind: 'line' },
                    ...(recordIdx.length ? [{ label: 'Récord personal', color: colors.chart2, kind: 'dot' as const }] : []),
                  ]}
                  table={{
                    headers: ['Fecha', METRIC_OPTIONS.find((m) => m.key === metric)!.label, 'Récord'],
                    rows: points.map((p) => [short(p.b.date), formatMetric(metric, p.v), prBySession.has(p.b.sessionId) ? 'Sí' : '']),
                  }}
                >
                  <LineChart
                    ariaLabel={`${METRIC_TITLES[metric]} de ${exerciseName}: de ${formatMetric(metric, points[0].v)} a ${formatMetric(metric, points[points.length - 1].v)}`}
                    series={[{ label: METRIC_TITLES[metric], color: colors.chart1, points: points.map((p) => ({ t: daysBetween(points[0].b.date, p.b.date), v: p.v })) }]}
                    xLabels={[
                      { t: 0, label: short(points[0].b.date) },
                      { t: daysBetween(points[0].b.date, points[points.length - 1].b.date), label: short(points[points.length - 1].b.date) },
                    ]}
                    format={(v) => (metric === 'volume' || metric === 'reps' ? fmtNum(v) : oneDecimal(v))}
                    selected={loadSel}
                    onSelect={setLoadSel}
                    highlights={recordIdx}
                    highlightColor={colors.chart2}
                  />
                </ChartFrame>
              )}

              {selectedPoint ? (
                <View style={{ gap: 2, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.sm }}>
                  <Text variant="label">Sesión del {long(selectedPoint.b.date)}</Text>
                  {prBySession.get(selectedPoint.b.sessionId)?.length ? (
                    <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
                      Récords: {prBySession.get(selectedPoint.b.sessionId)!.map((k) => PR_LABELS[k].replace('Récord de ', '')).join(', ')}
                    </Text>
                  ) : null}
                  {selectedPoint.b.sets.map((st, i) => (
                    <Text key={i}>
                      <Text muted>Serie {i + 1}: </Text>
                      {formatKg(st.weightKg)} kg × {st.reps}
                      {st.rpe != null ? <Text muted>{` · RPE ${formatKg(st.rpe)}`}</Text> : null}
                    </Text>
                  ))}
                </View>
              ) : null}
            </>
          )
        ) : null}
      </Card>
    </Screen>
  );
}
