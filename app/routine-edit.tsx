import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ExercisePicker } from '../src/components/exercise-picker';
import { ReorderSheet } from '../src/components/reorder-sheet';
import { Button, Card, ChipSingle, ErrorText, LinkButton, Screen, Text, TextField } from '../src/components/ui';
import { WEEKDAY_LONG } from '../src/lib/labels';
import { DEFAULT_REPS_FIELDS, draftToInput, repsFields, validateDraft, type DraftDay, type DraftItem, type RepsMode, type RoutineDraft } from '../src/lib/routine-draft';
import { orderByKeys } from '../src/lib/plan';
import { syncReminders } from '../src/lib/notifications';
import { getRoutine, saveRoutine, type Exercise } from '../src/lib/training';
import { spacing } from '../src/theme';

const REPS_MODE_OPTIONS: { key: RepsMode; label: string }[] = [
  { key: 'fixed', label: 'Repeticiones fijas' },
  { key: 'range', label: 'Rango' },
];

const WEEKDAY_OPTIONS = [
  { key: '0', label: 'Sin día fijo' },
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({ key: String(n), label: WEEKDAY_LONG[n].slice(0, 3) })),
];

export default function RoutineEdit() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const keyCounter = useRef(0);
  const nextKey = () => `i${++keyCounter.current}`;

  const [loading, setLoading] = useState(!!id);
  const [draft, setDraft] = useState<RoutineDraft>({
    id: id ?? null,
    name: '',
    notes: '',
    days: [{ name: 'Día 1', weekday: 0, items: [] }],
  });
  const [pickerDay, setPickerDay] = useState<number | null>(null);
  const [reorderDay, setReorderDay] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getRoutine(id)
      .then((r) => {
        if (!r) return setError('No se encontró la rutina.');
        setDraft({
          id: r.id,
          name: r.name,
          notes: r.notes,
          days: r.day_names.map((name, dayIndex) => ({
            name,
            weekday: r.schedule[dayIndex] ?? 0,
            items: (r.routine_exercises ?? [])
              .filter((e) => e.day_index === dayIndex && e.exercises)
              .map((e) => ({
                key: nextKey(),
                exercise: e.exercises!,
                sets: String(e.sets),
                ...repsFields(e.reps_min ?? e.reps_target, e.reps_max ?? e.reps_target),
                rest: String(e.rest_seconds),
                notes: e.notes,
              })),
          })),
        });
      })
      .catch(() => setError('No se pudo cargar la rutina.'))
      .finally(() => setLoading(false));
  }, [id]);

  const setDay = (i: number, patch: Partial<DraftDay>) =>
    setDraft((d) => ({ ...d, days: d.days.map((day, j) => (j === i ? { ...day, ...patch } : day)) }));

  const setItem = (di: number, ii: number, patch: Partial<DraftItem>) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((day, j) =>
        j === di ? { ...day, items: day.items.map((it, k) => (k === ii ? { ...it, ...patch } : it)) } : day,
      ),
    }));

  const moveItem = (di: number, ii: number, delta: number) =>
    setDraft((d) => ({
      ...d,
      days: d.days.map((day, j) => {
        if (j !== di) return day;
        const to = ii + delta;
        if (to < 0 || to >= day.items.length) return day;
        const items = [...day.items];
        [items[ii], items[to]] = [items[to], items[ii]];
        return { ...day, items };
      }),
    }));

  const removeItem = (di: number, ii: number) =>
    setDay(di, { items: draft.days[di].items.filter((_, k) => k !== ii) });

  const addExercise = (e: Exercise) => {
    if (pickerDay === null) return;
    const day = draft.days[pickerDay];
    setDay(pickerDay, {
      items: [
        ...day.items,
        { key: nextKey(), exercise: e, sets: '3', ...DEFAULT_REPS_FIELDS, rest: '90', notes: '' },
      ],
    });
    setPickerDay(null);
  };

  const addDay = () =>
    setDraft((d) =>
      d.days.length >= 7 ? d : { ...d, days: [...d.days, { name: `Día ${d.days.length + 1}`, weekday: 0, items: [] }] },
    );

  const removeDay = (i: number) => setDraft((d) => ({ ...d, days: d.days.filter((_, j) => j !== i) }));

  const save = async () => {
    const problem = validateDraft(draft);
    if (problem) return setError(problem);
    setSaving(true);
    setError(null);
    try {
      const savedId = await saveRoutine(draftToInput(draft));
      void syncReminders().catch(() => {}); // los avisos de entreno dependen de los días de tus rutinas
      // Editando: se vuelve a la vista de la rutina (que se recarga al enfocar); nueva: se sustituye el editor.
      if (draft.id) router.back();
      else router.replace({ pathname: '/routine/[id]', params: { id: savedId } });
    } catch {
      setError('No se pudo guardar la rutina. Comprueba tu conexión e inténtalo de nuevo.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Text muted>Cargando…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{draft.id ? 'Editar rutina' : 'Nueva rutina'}</Text>
      <TextField label="Nombre" value={draft.name} onChangeText={(t) => setDraft((d) => ({ ...d, name: t }))} maxLength={60} />
      <TextField
        label="Notas (opcional)"
        value={draft.notes}
        onChangeText={(t) => setDraft((d) => ({ ...d, notes: t }))}
        multiline
        maxLength={1000}
        style={{ minHeight: 70, textAlignVertical: 'top' }}
      />

      {draft.days.map((day, di) => (
        <Card key={di}>
          <TextField label={`Día ${di + 1}`} value={day.name} onChangeText={(t) => setDay(di, { name: t })} maxLength={40} />
          <Text variant="caption" muted>
            Día de la semana (para el entreno programado)
          </Text>
          <ChipSingle
            options={WEEKDAY_OPTIONS}
            value={String(day.weekday)}
            onChange={(k) => setDay(di, { weekday: Number(k ?? 0) })}
          />

          {day.items.map((it, ii) => (
            <View key={it.key} style={{ gap: spacing.sm, paddingTop: spacing.md }}>
              <Text variant="label">{it.exercise.name}</Text>
              <ChipSingle
                options={REPS_MODE_OPTIONS}
                value={it.repsMode}
                onChange={(k) => setItem(di, ii, { repsMode: k ?? 'fixed' })}
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TextField label="Series" keyboardType="number-pad" value={it.sets} onChangeText={(t) => setItem(di, ii, { sets: t })} />
                </View>
                {it.repsMode === 'range' ? (
                  <>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TextField label="Reps mín." keyboardType="number-pad" value={it.repsMin} onChangeText={(t) => setItem(di, ii, { repsMin: t })} />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <TextField label="Reps máx." keyboardType="number-pad" value={it.repsMax} onChangeText={(t) => setItem(di, ii, { repsMax: t })} />
                    </View>
                  </>
                ) : (
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <TextField label="Reps" keyboardType="number-pad" value={it.reps} onChangeText={(t) => setItem(di, ii, { reps: t })} />
                  </View>
                )}
                <View style={{ flex: 1, minWidth: 0 }}>
                  <TextField label="Desc. (s)" keyboardType="number-pad" value={it.rest} onChangeText={(t) => setItem(di, ii, { rest: t })} />
                </View>
              </View>
              {it.repsMode === 'range' ? (
                <Text variant="caption" muted>
                  Subirás de carga cuando todas las series normales lleguen al máximo del rango.
                </Text>
              ) : null}
              <TextField label="Notas" value={it.notes} onChangeText={(t) => setItem(di, ii, { notes: t })} maxLength={500} />
              <View style={{ flexDirection: 'row', gap: spacing.lg }}>
                <LinkButton title="Subir" disabled={ii === 0} onPress={() => moveItem(di, ii, -1)} />
                <LinkButton title="Bajar" disabled={ii === day.items.length - 1} onPress={() => moveItem(di, ii, 1)} />
                <LinkButton title="Quitar" danger onPress={() => removeItem(di, ii)} />
              </View>
            </View>
          ))}

          <Button title="Añadir ejercicio" variant="secondary" onPress={() => setPickerDay(di)} />
          {day.items.length > 1 ? <Button title="Reordenar ejercicios" variant="ghost" onPress={() => setReorderDay(di)} /> : null}
          {draft.days.length > 1 ? <LinkButton title="Eliminar este día" danger onPress={() => removeDay(di)} /> : null}
        </Card>
      ))}

      {draft.days.length < 7 ? <Button title="Añadir día" variant="secondary" onPress={addDay} /> : null}

      <ErrorText>{error}</ErrorText>
      <Button title="Guardar rutina" onPress={save} loading={saving} />
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />

      <ExercisePicker visible={pickerDay !== null} onClose={() => setPickerDay(null)} onPick={addExercise} />

      <ReorderSheet
        visible={reorderDay !== null}
        title="Reordenar ejercicios"
        subtitle="Arrastra el asa de la derecha para cambiar el orden."
        items={reorderDay === null ? [] : draft.days[reorderDay].items.map((it) => ({ key: it.key, label: it.exercise.name }))}
        onClose={() => setReorderDay(null)}
        onApply={(keys) => {
          if (reorderDay === null) return;
          setDay(reorderDay, { items: orderByKeys(draft.days[reorderDay].items, (it) => it.key, keys) });
        }}
      />
    </Screen>
  );
}
