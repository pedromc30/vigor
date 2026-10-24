import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BarChart, ChartFrame, LineChart } from '../../src/components/charts';
import { Button, Card, ChipSingle, ErrorText, Screen, Text } from '../../src/components/ui';
import { addDays, fromISODate, toISODate } from '../../src/lib/diet-math';
import { loadPref, savePref } from '../../src/lib/local-prefs';
import { MIN_KCAL } from '../../src/lib/nutrition';
import { getExerciseSets, getKcalRows, getSessionDates, listMetrics, listTrainedExercises } from '../../src/lib/progress';
import {
  daysBetween,
  kcalByDay,
  macrosForNewKcal,
  movingAverage,
  sessionBests,
  suggestAdjustment,
  weeklyAdherence,
  type DatedValue,
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

export default function Progreso() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile, saveProfile } = useAuth();
  const today = toISODate(new Date());
  const since = addDays(today, -8 * 7 - 6);

  const { data, error, loading, reload } = useFocusData(async () => {
    const [metrics, kcalRows, sessionDates, exercises, lastDecision] = await Promise.all([
      listMetrics(),
      getKcalRows(since),
      getSessionDates(since),
      listTrainedExercises(),
      loadPref<string | null>(DECISION_KEY, null),
    ]);
    return { metrics, kcalRows, sessionDates, exercises, lastDecision };
  });

  const [range, setRange] = useState<Range>('90');
  const [weightSel, setWeightSel] = useState<number | null>(null);
  const [kcalSel, setKcalSel] = useState<number | null>(null);
  const [weekSel, setWeekSel] = useState<number | null>(null);
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const [loadSel, setLoadSel] = useState<number | null>(null);
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

  // ----- Cargas
  const bests = useMemo(() => (exSets ? sessionBests(exSets) : []), [exSets]);

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
      <Text variant="title">Progreso</Text>
      <ErrorText>{error ?? actionError}</ErrorText>
      {loading ? <Text muted>Cargando…</Text> : null}

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

      <Card>
        <Text variant="caption" muted>
          Peso actual
        </Text>
        {latest ? (
          <>
            <Text style={{ fontSize: 48, fontWeight: '700', lineHeight: 54 }}>{formatKg(latest.value)} kg</Text>
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
        {bests.length ? (
          <ChartFrame
            title="Mejor carga por sesión"
            readout={
              loadSel != null && bests[loadSel]
                ? `${short(bests[loadSel].date)} · ${formatKg(bests[loadSel].topWeightKg)} kg${bests[loadSel].est1RM ? ` · 1RM estimado ${formatKg(bests[loadSel].est1RM!)} kg` : ''}`
                : 'Toca un punto para ver el detalle'
            }
            table={{ headers: ['Fecha', 'Mejor carga', '1RM est.'], rows: bests.map((b) => [short(b.date), `${formatKg(b.topWeightKg)} kg`, b.est1RM ? `${formatKg(b.est1RM)} kg` : '—']) }}
          >
            <LineChart
              ariaLabel={`Mejor carga por sesión: de ${formatKg(bests[0].topWeightKg)} a ${formatKg(bests[bests.length - 1].topWeightKg)} kilos`}
              series={[{ label: 'Carga', color: colors.chart1, points: bests.map((b) => ({ t: daysBetween(bests[0].date, b.date), v: b.topWeightKg })) }]}
              xLabels={[
                { t: 0, label: short(bests[0].date) },
                { t: daysBetween(bests[0].date, bests[bests.length - 1].date), label: short(bests[bests.length - 1].date) },
              ]}
              format={(v) => String(Math.round(v * 10) / 10).replace('.', ',')}
              selected={loadSel}
              onSelect={setLoadSel}
            />
          </ChartFrame>
        ) : exerciseId && exSets ? (
          <Text muted>Aún no hay sesiones de este ejercicio.</Text>
        ) : null}
      </Card>
    </Screen>
  );
}
