import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TopTabs } from '../../src/components/top-tabs';
import { Button, ChipSingle, LinkRow, Screen, Text } from '../../src/components/ui';
import { targetsForWeekday } from '../../src/lib/day-targets';
import { listPlan, type PlanEntry } from '../../src/lib/diet';
import { sumMacros } from '../../src/lib/diet-math';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../../src/lib/labels';
import { listRoutines } from '../../src/lib/training';
import { useFocusData } from '../../src/lib/use-focus-data';
import { useAuth } from '../../src/providers/AuthProvider';
import { radius, spacing, useTheme } from '../../src/theme';

type Section = 'semana' | 'rutinas' | 'comidas';

const WEEK = [1, 2, 3, 4, 5, 6, 7];

/** Plan: la semana de un vistazo, las rutinas y lo relacionado con las comidas (alimentos, recetas, archivos). */
export default function MiPlan() {
  const router = useRouter();
  const { colors } = useTheme();
  const { profile } = useAuth();
  const [section, setSection] = useState<Section>('semana');
  const { data, loading } = useFocusData(async () => {
    const [plan, routines] = await Promise.all([listPlan().catch(() => [] as PlanEntry[]), listRoutines().catch(() => [])]);
    return { plan, routines };
  });
  const plan = data?.plan ?? [];
  const routines = data?.routines ?? [];

  return (
    <Screen>
      <TopTabs />
      <Text variant="title" style={{ fontSize: 46, lineHeight: 44 }}>
        Plan
      </Text>
      <ChipSingle<Section>
        value={section}
        onChange={(v) => setSection(v ?? 'semana')}
        options={[
          { key: 'semana', label: 'Semana' },
          { key: 'rutinas', label: 'Rutinas' },
          { key: 'comidas', label: 'Comidas' },
        ]}
      />

      {section === 'semana' ? (
        <>
          <Text variant="caption" muted>
            Cada barra son las kcal planificadas frente al objetivo de ese día. Toca un día para cambiar lo planificado.
          </Text>
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
                      {trains.length ? trains[0].name : '—'}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
          {loading && !data ? <Text muted>Cargando…</Text> : null}
          <View style={{ backgroundColor: colors.ink, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }}>
            <Text variant="caption" style={{ color: colors.onInk, opacity: 0.7 }}>
              Lista de la compra
            </Text>
            <Text variant="heading" style={{ color: colors.onInk }}>
              Todo lo planificado, sumado
            </Text>
            <Button title="Abrir lista" onPress={() => router.push('/shopping')} />
          </View>
          <LinkRow title="Planificador semanal" hint="Añadir o quitar comidas de cada día" onPress={() => router.push('/plan')} />
        </>
      ) : null}

      {section === 'rutinas' ? (
        <>
          {routines.map((r) => (
            <Pressable
              key={r.id}
              accessibilityRole="button"
              accessibilityLabel={r.name}
              onPress={() => router.push({ pathname: '/routine/[id]', params: { id: r.id } })}
              style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.lg, gap: 2 }}
            >
              <Text variant="heading">{r.name}</Text>
              <Text variant="caption" muted>
                {r.day_names.length} {r.day_names.length === 1 ? 'día' : 'días'} · {r.routine_exercises?.length ?? 0} ejercicios
                {r.schedule.some((d) => d > 0) ? ` · ${r.schedule.filter((d) => d > 0).map((d) => WEEKDAY_SHORT[d]).join(' ')}` : ''}
              </Text>
            </Pressable>
          ))}
          {!routines.length && !loading ? <Text muted>Todavía no tienes rutinas.</Text> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Nueva rutina"
            onPress={() => router.push('/routine-edit')}
            style={{ borderWidth: 2, borderStyle: 'dashed', borderColor: colors.textMuted, borderRadius: radius.lg, padding: spacing.lg, alignItems: 'center' }}
          >
            <Text variant="label" style={{ color: colors.primary, fontWeight: '800' }}>
              + Nueva rutina
            </Text>
          </Pressable>
          <View style={{ marginTop: spacing.sm }}>
            <LinkRow title="Entreno y volumen de la semana" onPress={() => router.push('/entreno')} />
            <LinkRow title="Historial de sesiones" onPress={() => router.push('/history')} />
            <LinkRow title="Biblioteca de ejercicios" onPress={() => router.push('/exercises')} />
          </View>
        </>
      ) : null}

      {section === 'comidas' ? (
        <View>
          <LinkRow title="Diario de comidas" hint="Lo que has comido, día a día" onPress={() => router.push('/dieta')} />
          <LinkRow title="Planificador semanal" hint="Qué comer cada día de la semana" onPress={() => router.push('/plan')} />
          <LinkRow title="Lista de la compra" hint="Los ingredientes de toda la semana" onPress={() => router.push('/shopping')} />
          <LinkRow title="Archivos de dieta" hint="PDF, Excel o CSV de tu dietista" onPress={() => router.push('/diet-files')} />
          <LinkRow title="Nuevo alimento" onPress={() => router.push('/food-create')} />
          <LinkRow title="Nueva receta" onPress={() => router.push('/recipe-edit')} />
        </View>
      ) : null}
      <View style={{ height: 70 }} />
    </Screen>
  );
}
