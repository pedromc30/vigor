import { useEffect, useMemo, useState } from 'react';
import { Pressable } from 'react-native';
import { useAuth } from '../providers/AuthProvider';
import { addLogs, getRecentMealLogs, saveFavorite, type EntryDraft, type LogEntry } from '../lib/diet';
import { MEAL_LABELS, dayLabel, sumMacros, toISODate, type Meal } from '../lib/diet-math';
import { spacing, useTheme } from '../theme';
import { BottomSheet } from './bottom-sheet';
import { Button, Card, ErrorText, Text, TextField } from './ui';

const toDraft = (e: LogEntry): EntryDraft => ({
  meal: e.meal,
  food_id: e.food_id,
  recipe_id: e.recipe_id,
  name: e.name,
  quantity_g: e.quantity_g,
  servings: e.servings,
  kcal: e.kcal,
  protein_g: e.protein_g,
  carbs_g: e.carbs_g,
  fat_g: e.fat_g,
});

/** Copia una comida de los últimos días a la fecha actual del diario. */
export function CopyMealModal({
  visible,
  meal,
  date,
  onClose,
  onCopied,
}: {
  visible: boolean;
  meal: Meal;
  date: string;
  onClose: () => void;
  onCopied: () => void;
}) {
  const { session } = useAuth();
  const [logs, setLogs] = useState<LogEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLogs(null);
    setError(null);
    getRecentMealLogs(meal, date)
      .then(setLogs)
      .catch(() => setError('No se pudo cargar el historial. Comprueba tu conexión.'));
  }, [visible, meal, date]);

  const days = useMemo(() => {
    const map = new Map<string, LogEntry[]>();
    for (const l of logs ?? []) map.set(l.log_date, [...(map.get(l.log_date) ?? []), l]);
    return [...map.entries()];
  }, [logs]);

  const copy = async (day: string, entries: LogEntry[]) => {
    if (!session) return;
    setBusy(day);
    setError(null);
    try {
      await addLogs(session.user.id, date, entries.map(toDraft));
      onCopied();
    } catch {
      setError('No se pudo copiar. Comprueba tu conexión.');
      setBusy(null);
    }
  };

  const today = toISODate(new Date());
  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="heading">Copiar {MEAL_LABELS[meal].toLowerCase()} de otro día</Text>
      <ErrorText>{error}</ErrorText>
      {!logs && !error ? <Text muted>Cargando…</Text> : null}
      {logs && !days.length ? <Text muted>No hay {MEAL_LABELS[meal].toLowerCase()} registrados en los últimos 14 días.</Text> : null}
      {days.map(([day, entries]) => (
        <Pressable key={day} accessibilityRole="button" disabled={!!busy} onPress={() => void copy(day, entries)}>
          <Card>
            <Text variant="label">
              {dayLabel(day, today)} · {Math.round(sumMacros(entries).kcal)} kcal
            </Text>
            <Text variant="caption" muted>
              {entries.map((e) => e.name).join(', ')}
            </Text>
            {busy === day ? <Text variant="caption">Copiando…</Text> : null}
          </Card>
        </Pressable>
      ))}
      <Button title="Cancelar" variant="ghost" onPress={onClose} />
    </BottomSheet>
  );
}

/** Guarda las entradas de una comida como comida favorita reutilizable. */
export function SaveFavoriteModal({
  visible,
  meal,
  entries,
  onClose,
  onSaved,
}: {
  visible: boolean;
  meal: Meal;
  entries: LogEntry[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { session } = useAuth();
  const { colors } = useTheme();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (visible) {
      setName(`${MEAL_LABELS[meal]} habitual`);
      setError(null);
      setBusy(false);
    }
  }, [visible, meal]);

  const save = async () => {
    const n = name.trim();
    if (!n || n.length > 80) return setError('Pon un nombre de hasta 80 caracteres.');
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      await saveFavorite(session.user.id, n, entries.map(toDraft));
      onSaved();
    } catch {
      setError('No se pudo guardar. Comprueba tu conexión.');
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose}>
      <Text variant="heading">Guardar como favorita</Text>
      <Text variant="caption" style={{ color: colors.textMuted }}>
        {entries.length} alimento(s) · {Math.round(sumMacros(entries).kcal)} kcal. Podrás añadirla a cualquier día desde «Favoritas».
      </Text>
      <TextField label="Nombre" value={name} onChangeText={setName} maxLength={80} />
      <ErrorText>{error}</ErrorText>
      <Button title="Guardar favorita" onPress={save} loading={busy} />
      <Button title="Cancelar" variant="ghost" onPress={onClose} />
      <Text style={{ height: spacing.xs }}> </Text>
    </BottomSheet>
  );
}
