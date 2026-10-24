import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ChipSingle, ErrorText, LinkButton, Screen, Text } from '../src/components/ui';
import { clearPlanDay, deletePlanEntry, listPlan } from '../src/lib/diet';
import { MEALS, MEAL_LABELS, isoWeekday, sumMacros, toISODate } from '../src/lib/diet-math';
import { WEEKDAY_LONG, WEEKDAY_SHORT } from '../src/lib/labels';
import { formatKg } from '../src/lib/training-math';
import { useFocusData } from '../src/lib/use-focus-data';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing } from '../src/theme';

export default function Plan() {
  const router = useRouter();
  const { profile } = useAuth();
  const [weekday, setWeekday] = useState(isoWeekday(toISODate(new Date())));
  const { data, error, loading, reload } = useFocusData(listPlan);
  const [actionError, setActionError] = useState<string | null>(null);

  const dayEntries = (data ?? []).filter((e) => e.weekday === weekday);
  const total = sumMacros(dayEntries);

  const run = async (fn: () => Promise<void>) => {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch {
      setActionError('No se pudo completar la acción. Comprueba tu conexión.');
    }
  };

  return (
    <Screen>
      <Text variant="title">Planificador semanal</Text>
      <Text muted>Organiza tus menús de la semana. La lista de la compra se genera sola con lo que planifiques.</Text>

      <ChipSingle
        value={String(weekday)}
        onChange={(k) => setWeekday(Number(k ?? weekday))}
        options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ key: String(d), label: WEEKDAY_SHORT[d] }))}
      />
      <Text variant="heading">{WEEKDAY_LONG[weekday][0].toUpperCase() + WEEKDAY_LONG[weekday].slice(1)}</Text>
      <ErrorText>{error ?? actionError}</ErrorText>
      {loading ? <Text muted>Cargando…</Text> : null}

      <Card>
        <Text variant="title">
          {Math.round(total.kcal)}
          <Text muted> / {profile?.target_kcal ?? '—'} kcal</Text>
        </Text>
        <Text variant="caption" muted>
          P {Math.round(total.protein_g)} g · C {Math.round(total.carbs_g)} g · G {Math.round(total.fat_g)} g
        </Text>
      </Card>

      {MEALS.map((meal) => {
        const entries = dayEntries.filter((e) => e.meal === meal);
        return (
          <Card key={meal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="heading">{MEAL_LABELS[meal]}</Text>
              <Text variant="caption" muted>
                {Math.round(sumMacros(entries).kcal)} kcal
              </Text>
            </View>
            {entries.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text>{e.name}</Text>
                  <Text variant="caption" muted>
                    {e.quantity_g != null ? `${formatKg(e.quantity_g)} g` : `${formatKg(e.servings ?? 0)} ración(es)`} · {Math.round(e.kcal)} kcal
                  </Text>
                </View>
                <LinkButton title="Quitar" danger onPress={() => void run(() => deletePlanEntry(e.id))} />
              </View>
            ))}
            {!entries.length ? (
              <Text variant="caption" muted>
                Sin planificar
              </Text>
            ) : null}
            <Button
              title={`Añadir a ${MEAL_LABELS[meal].toLowerCase()}`}
              variant="secondary"
              onPress={() => router.push({ pathname: '/food-add', params: { target: 'plan', meal, weekday: String(weekday) } })}
            />
          </Card>
        );
      })}

      {dayEntries.length ? <LinkButton title="Vaciar este día" danger onPress={() => void run(() => clearPlanDay(weekday))} /> : null}
      <Button title="Lista de la compra" onPress={() => router.push('/shopping')} />
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
