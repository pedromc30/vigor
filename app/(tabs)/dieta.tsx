import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CopyMealModal, SaveFavoriteModal } from '../../src/components/meal-modals';
import { QuantitySheet } from '../../src/components/quantity-sheet';
import { Button, Card, ErrorText, LinkButton, Screen, Text } from '../../src/components/ui';
import { addWater, deleteLog, getLogs, getWaterMl, undoWater, updateLog, type LogEntry } from '../../src/lib/diet';
import {
  MEALS,
  MEAL_LABELS,
  addDays,
  dayLabel,
  formatMl,
  progress,
  rescaleEntry,
  sumMacros,
  toISODate,
  type Meal,
} from '../../src/lib/diet-math';
import { formatKg } from '../../src/lib/training-math';
import { useFocusData } from '../../src/lib/use-focus-data';
import { useAuth } from '../../src/providers/AuthProvider';
import { radius, spacing, useTheme } from '../../src/theme';

const quantityText = (e: LogEntry) =>
  e.quantity_g != null ? `${formatKg(e.quantity_g)} g` : `${formatKg(e.servings ?? 0)} ${e.servings === 1 ? 'ración' : 'raciones'}`;

function Bar({ value, color, over }: { value: number; color: string; over?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={{ height: 8, borderRadius: 4, backgroundColor: colors.surfaceAlt }}>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: over ? colors.danger : color, width: `${value * 100}%` }} />
    </View>
  );
}

function MacroBar({ label, consumed, target, color, unit = 'g' }: { label: string; consumed: number; target: number | null; color: string; unit?: string }) {
  const over = !!target && consumed > target;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="label">{label}</Text>
        <Text variant="caption" muted>
          {Math.round(consumed)} / {target ?? '—'} {unit}
        </Text>
      </View>
      <Bar value={progress(consumed, target)} color={color} over={over} />
    </View>
  );
}

export default function Dieta() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, profile } = useAuth();
  const today = toISODate(new Date());
  const [date, setDate] = useState(today);
  const { data, error, loading, reload } = useFocusData(
    async () => {
      const [logs, water] = await Promise.all([getLogs(date), getWaterMl(date)]);
      return { logs, water };
    },
    [date],
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [editing, setEditing] = useState<LogEntry | null>(null);
  const [copyFor, setCopyFor] = useState<Meal | null>(null);
  const [favFor, setFavFor] = useState<Meal | null>(null);

  const logs = data?.logs ?? [];
  const total = sumMacros(logs);
  const kcalTarget = profile?.target_kcal ?? null;
  const waterGoal = profile?.water_goal_ml ?? 2500;
  const water = data?.water ?? 0;
  const remaining = kcalTarget != null ? kcalTarget - total.kcal : null;

  const run = async (fn: () => Promise<void>, msg: string) => {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch {
      setActionError(msg);
    }
  };

  const drink = (ml: number) =>
    run(async () => {
      if (session) await addWater(session.user.id, date, ml);
    }, 'No se pudo registrar el agua. Comprueba tu conexión.');

  return (
    <Screen>
      <Text variant="title">Dieta</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <LinkButton title="◀ Anterior" onPress={() => setDate(addDays(date, -1))} />
        <Text variant="label" accessibilityLiveRegion="polite">
          {dayLabel(date, today)}
        </Text>
        <LinkButton title="Siguiente ▶" onPress={() => setDate(addDays(date, 1))} />
      </View>
      {date !== today ? <LinkButton title="Volver a hoy" onPress={() => setDate(today)} /> : null}
      <ErrorText>{error ?? actionError}</ErrorText>

      <Card>
        <Text variant="caption" muted>
          Calorías
        </Text>
        <Text variant="title">
          {Math.round(total.kcal)}
          <Text muted> / {kcalTarget ?? '—'} kcal</Text>
        </Text>
        <Bar value={progress(total.kcal, kcalTarget)} color={colors.primary} over={remaining != null && remaining < 0} />
        {remaining != null ? (
          <Text variant="caption" style={{ color: remaining < 0 ? colors.danger : colors.textMuted }}>
            {remaining >= 0 ? `Te quedan ${Math.round(remaining)} kcal` : `Te has pasado ${Math.round(-remaining)} kcal`}
          </Text>
        ) : null}
        <View style={{ height: spacing.xs }} />
        <MacroBar label="Proteína" consumed={total.protein_g} target={profile?.target_protein_g ?? null} color={colors.protein} />
        <MacroBar label="Carbohidratos" consumed={total.carbs_g} target={profile?.target_carbs_g ?? null} color={colors.carbs} />
        <MacroBar label="Grasa" consumed={total.fat_g} target={profile?.target_fat_g ?? null} color={colors.fat} />
      </Card>

      <Card>
        <MacroBar label="Agua" consumed={water} target={waterGoal} color={colors.protein} unit="ml" />
        <Text variant="caption" muted>
          {formatMl(water)} de {formatMl(waterGoal)}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <View style={{ flex: 1 }}>
            <Button title="+ 250 ml" variant="secondary" onPress={() => void drink(250)} />
          </View>
          <View style={{ flex: 1 }}>
            <Button title="+ 500 ml" variant="secondary" onPress={() => void drink(500)} />
          </View>
        </View>
        {water > 0 ? (
          <LinkButton title="Deshacer el último" onPress={() => void run(() => undoWater(date), 'No se pudo deshacer.')} />
        ) : null}
      </Card>

      {loading ? <Text muted>Cargando…</Text> : null}

      {MEALS.map((meal) => {
        const entries = logs.filter((l) => l.meal === meal);
        const sub = sumMacros(entries);
        return (
          <Card key={meal}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Text variant="heading">{MEAL_LABELS[meal]}</Text>
              <Text variant="caption" muted>
                {Math.round(sub.kcal)} kcal
              </Text>
            </View>

            {entries.map((e) => (
              <Pressable
                key={e.id}
                accessibilityRole="button"
                accessibilityLabel={`Editar ${e.name}`}
                onPress={() => setEditing(e)}
                style={{ paddingVertical: spacing.xs, borderRadius: radius.sm }}
              >
                <Text>{e.name}</Text>
                <Text variant="caption" muted>
                  {quantityText(e)} · {Math.round(e.kcal)} kcal · P {Math.round(e.protein_g)} · C {Math.round(e.carbs_g)} · G{' '}
                  {Math.round(e.fat_g)}
                </Text>
              </Pressable>
            ))}
            {!entries.length ? (
              <Text variant="caption" muted>
                Sin alimentos
              </Text>
            ) : null}

            <Button
              title={`Añadir a ${MEAL_LABELS[meal].toLowerCase()}`}
              variant="secondary"
              onPress={() => router.push({ pathname: '/food-add', params: { target: 'diary', meal, date } })}
            />
            <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
              <LinkButton title="Copiar de otro día" onPress={() => setCopyFor(meal)} />
              {entries.length ? <LinkButton title="Guardar como favorita" onPress={() => setFavFor(meal)} /> : null}
            </View>
          </Card>
        );
      })}

      <Button title="Planificador semanal" variant="secondary" onPress={() => router.push('/plan')} />
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Nuevo alimento" variant="secondary" onPress={() => router.push('/food-create')} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Nueva receta" variant="secondary" onPress={() => router.push('/recipe-edit')} />
        </View>
      </View>

      {editing ? (
        <QuantitySheet
          visible
          title={editing.name}
          subtitle={`${MEAL_LABELS[editing.meal]} · ${dayLabel(date, today).toLowerCase()}`}
          unit={editing.quantity_g != null ? 'g' : 'raciones'}
          initial={editing.quantity_g ?? editing.servings ?? 1}
          macrosFor={(q) => rescaleEntry(editing, q)}
          confirmLabel="Guardar cambios"
          onConfirm={async (q) => {
            const r = rescaleEntry(editing, q);
            await updateLog(editing.id, {
              quantity_g: r.quantity_g,
              servings: r.servings,
              kcal: r.kcal,
              protein_g: r.protein_g,
              carbs_g: r.carbs_g,
              fat_g: r.fat_g,
            });
            setEditing(null);
            await reload();
          }}
          onDelete={async () => {
            await deleteLog(editing.id);
            setEditing(null);
            await reload();
          }}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <CopyMealModal
        visible={copyFor !== null}
        meal={copyFor ?? 'desayuno'}
        date={date}
        onClose={() => setCopyFor(null)}
        onCopied={() => {
          setCopyFor(null);
          void reload();
        }}
      />
      <SaveFavoriteModal
        visible={favFor !== null}
        meal={favFor ?? 'desayuno'}
        entries={logs.filter((l) => l.meal === favFor)}
        onClose={() => setFavFor(null)}
        onSaved={() => setFavFor(null)}
      />
    </Screen>
  );
}
