import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text } from './ui';
import { targetsForWeekday } from '../lib/day-targets';
import { listPlan, type PlanEntry } from '../lib/diet';
import { sumMacros } from '../lib/diet-math';
import { WEEKDAY_LONG } from '../lib/labels';
import { listRoutines } from '../lib/training';
import { useFocusData } from '../lib/use-focus-data';
import { useAuth } from '../providers/AuthProvider';
import { spacing, useTheme } from '../theme';

const WEEK = [1, 2, 3, 4, 5, 6, 7];

/** La semana de un vistazo: kcal planificadas frente al objetivo de cada día y la rutina que toca. Tocar un día abre el planificador en ese día. */
export function WeekPlan() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const { data, loading } = useFocusData(async () => {
    const [plan, routines] = await Promise.all([listPlan().catch(() => [] as PlanEntry[]), listRoutines().catch(() => [])]);
    return { plan, routines };
  });
  const plan = data?.plan ?? [];
  const routines = data?.routines ?? [];
  return (
    <View>
      {WEEK.map((d) => {
        const kcal = Math.round(sumMacros(plan.filter((p) => p.weekday === d)).kcal);
        const target = targetsForWeekday(profile, d).kcal;
        const trains = routines.filter((r) => r.schedule.includes(d));
        const share = target ? Math.min(1, kcal / target) : kcal ? 1 : 0;
        return (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={`Planificador del ${WEEKDAY_LONG[d]}`}
            onPress={() => router.push({ pathname: '/plan', params: { day: String(d) } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, borderBottomWidth: 1, borderBottomColor: colors.border }}
          >
            <Text variant="heading" style={{ width: 44 }}>
              {WEEKDAY_LONG[d].slice(0, 3)}
            </Text>
            <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: colors.surfaceAlt }}>
              <View style={{ height: 10, borderRadius: 5, backgroundColor: colors.ink, width: `${share * 100}%` }} />
            </View>
            <Text variant="heading" style={{ minWidth: 52, textAlign: 'right' }}>
              {kcal ? kcal.toLocaleString('es-ES') : '—'}
            </Text>
            <View style={{ width: 84, alignItems: 'center', paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: colors.surfaceAlt }}>
              <Text variant="caption" numberOfLines={1} style={{ fontWeight: '800', fontSize: 11 }}>
                {trains.length ? trains[0].name : 'Descanso'}
              </Text>
            </View>
          </Pressable>
        );
      })}
      {loading && !data ? <Text muted>Cargando…</Text> : null}
    </View>
  );
}
