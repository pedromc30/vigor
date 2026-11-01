import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActionSheet } from '../../src/components/action-sheet';
import { ExercisePicker } from '../../src/components/exercise-picker';
import { ReorderSheet } from '../../src/components/reorder-sheet';
import { ElapsedClock, RestBar, RestDoneToast, type RestState } from '../../src/components/rest-timer';
import { RPE_OPTIONS, SelectField } from '../../src/components/select-field';
import { Button, Card, ErrorText, LinkButton, Screen, Text } from '../../src/components/ui';
import { confirm } from '../../src/lib/confirm';
import {
  insertAt,
  nextSetIndex,
  nextSlot,
  orderByKeys,
  orderUpdates,
  removeAt,
  repsLabel,
  repsRange,
  setLabels,
  targetLabel,
  warmupInsertIndex,
} from '../../src/lib/plan';
import { syncRestNotification } from '../../src/lib/rest-notification';
import {
  bySetOrder,
  deleteSession,
  deleteSet,
  finishSession,
  getPreviousSets,
  getSession,
  getSessionSets,
  saveSet,
  updateSessionPlan,
  updateSetOrders,
  type Exercise,
  type PlanItem,
  type Session,
  type SessionSet,
} from '../../src/lib/training';
import {
  bestEstimated1RM,
  formatKg,
  isNormalSet,
  suggestNextWeight,
  targetsMet,
  type SetType,
} from '../../src/lib/training-math';
import { parseDecimal } from '../../src/lib/validation';
import { success, tap } from '../../src/lib/haptics';
import { useAuth } from '../../src/providers/AuthProvider';
import { radius, spacing, useTheme } from '../../src/theme';

interface Row {
  /** Identidad local de la fila (no cambia aunque se reordene). */
  id: string;
  /** Identidad de la serie en la base de datos (set_index). */
  setIndex: number;
  type: SetType;
  weight: string;
  reps: string;
  rpe: string;
  dbId: string | null;
  /** Orden guardado en la base de datos (null = sin guardar o serie antigua). */
  sortOrder: number | null;
  busy: boolean;
}
type Previous = Record<string, { date: string; sets: SessionSet[] }>;

const toData = (s: { weight_kg: number; reps: number }) => ({ weightKg: s.weight_kg, reps: s.reps });
const slotOf = (item: PlanItem, pos: number) => item.slot ?? pos;

/** Filas de series de un ejercicio: las ya registradas (en su orden) más las normales que faltan, con la carga sugerida. */
function buildRows(item: PlanItem, pos: number, sets: SessionSet[], newId: () => string, prev?: Previous[string]): Row[] {
  const mine = sets.filter((s) => s.position === slotOf(item, pos)).sort(bySetOrder);
  const { max } = repsRange(item);
  const suggestion = prev ? suggestNextWeight(prev.sets.map(toData), item.sets, max) : null;
  const rows: Row[] = mine.map((s) => ({
    id: newId(),
    setIndex: s.set_index,
    type: s.set_type,
    weight: formatKg(s.weight_kg),
    reps: String(s.reps),
    rpe: s.rpe == null ? '' : formatKg(s.rpe),
    dbId: s.id,
    sortOrder: s.sort_order,
    busy: false,
  }));
  const normalDone = rows.filter((r) => r.type === 'normal').length;
  for (let k = normalDone; k < item.sets; k++) {
    const fallback = prev?.sets[k]?.weight_kg ?? prev?.sets[prev.sets.length - 1]?.weight_kg;
    const w = suggestion ?? fallback;
    rows.push({
      id: newId(),
      setIndex: nextSetIndex(rows),
      type: 'normal',
      weight: w != null ? formatKg(w) : '',
      reps: String(max),
      rpe: '',
      dbId: null,
      sortOrder: null,
      busy: false,
    });
  }
  return rows;
}

export default function Workout() {
  const router = useRouter();
  const { session: auth } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const rowCounter = useRef(0);
  const newRowId = useCallback(() => `r${++rowCounter.current}`, []);

  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Row[][]>([]);
  const [prev, setPrev] = useState<Previous>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rest, setRest] = useState<RestState | null>(null);
  const [restDone, setRestDone] = useState(false);
  const [picker, setPicker] = useState(false);
  const [reorder, setReorder] = useState(false);
  const [menu, setMenu] = useState<{ pos: number; rowId: string } | null>(null);
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const s = await getSession(id);
        if (!s) return setLoadError('No se encontró la sesión.');
        const sets = await getSessionSets(id);
        const previous = await getPreviousSets([...new Set(s.plan.map((p) => p.exercise_id))], id).catch(() => ({}) as Previous); // sin red puede no haber histórico
        setSession(s);
        setPrev(previous);
        setRows(s.plan.map((p, pos) => buildRows(p, pos, sets, newRowId, previous[p.exercise_id])));
      } catch {
        setLoadError('No se pudo cargar la sesión. Comprueba tu conexión.');
      }
    })();
  }, [id, newRowId]);

  // El aviso del sistema de fin de descanso sigue siempre al temporizador: se reprograma al iniciar, alargar, acortar o saltar.
  const restEndsAt = rest?.endsAt ?? null;
  useEffect(() => {
    void syncRestNotification(restEndsAt);
  }, [restEndsAt]);
  useEffect(() => () => void syncRestNotification(null), []);

  const patchRow = (rowId: string, patch: Partial<Row>) =>
    setRows((all) => all.map((rs) => rs.map((r) => (r.id === rowId ? { ...r, ...patch } : r))));

  const replaceRows = (pos: number, next: Row[]) => setRows((all) => all.map((rs, p) => (p === pos ? next : rs)));

  /** Guarda el orden de las series ya registradas cuyo lugar ha cambiado al insertar o borrar otra. */
  const persistOrder = async (next: Row[]) => {
    const updates = orderUpdates(next);
    if (!updates.length) return;
    try {
      await updateSetOrders(updates);
      setRows((all) =>
        all.map((rs) =>
          rs.map((r) => {
            const u = updates.find((x) => x.dbId === r.dbId);
            return u ? { ...r, sortOrder: u.sortOrder } : r;
          }),
        ),
      );
    } catch {
      setError('No se pudo guardar el nuevo orden de las series. Comprueba tu conexión.');
    }
  };

  const toggleSet = async (pos: number, rowId: string) => {
    if (!session || !auth) return;
    const item = session.plan[pos];
    const index = rows[pos].findIndex((r) => r.id === rowId);
    const row = rows[pos][index];
    if (!row || row.busy) return;
    setError(null);

    if (row.dbId) {
      patchRow(rowId, { busy: true });
      try {
        await deleteSet(row.dbId);
        patchRow(rowId, { dbId: null, sortOrder: null, busy: false });
      } catch {
        patchRow(rowId, { busy: false });
        setError('No se pudo deshacer la serie. Comprueba tu conexión.');
      }
      return;
    }

    const weight = parseDecimal(row.weight);
    const reps = parseDecimal(row.reps);
    const rpe = row.rpe.trim() === '' ? null : parseDecimal(row.rpe);
    if (weight === null || weight > 1000) return setError(`${item.name}: introduce el peso en kg (0 si no usas carga).`);
    if (reps === null || !Number.isInteger(reps) || reps < 1 || reps > 200)
      return setError(`${item.name}: las repeticiones deben ser un número entero entre 1 y 200.`);
    if (row.rpe.trim() !== '' && (rpe === null || rpe < 1 || rpe > 10))
      return setError(`${item.name}: el RPE debe estar entre 1 y 10.`);

    patchRow(rowId, { busy: true });
    try {
      const saved = await saveSet({
        session_id: session.id,
        user_id: auth.user.id,
        exercise_id: item.exercise_id,
        position: slotOf(item, pos),
        set_index: row.setIndex,
        weight_kg: weight,
        reps,
        rpe,
        target_reps: repsRange(item).max,
        set_type: row.type,
        sort_order: index,
      });
      patchRow(rowId, { dbId: saved.id, sortOrder: index, busy: false });
      tap();
      if (item.rest_seconds > 0) {
        setRest({ endsAt: Date.now() + item.rest_seconds * 1000, total: item.rest_seconds });
        setRestDone(false);
      }
    } catch {
      patchRow(rowId, { busy: false });
      setError('No se pudo guardar la serie. Comprueba tu conexión e inténtalo de nuevo.');
    }
  };

  const newRow = (rs: Row[], type: SetType, from?: Row): Row => ({
    id: newRowId(),
    setIndex: nextSetIndex(rs),
    type,
    weight: from?.weight ?? '',
    reps: from?.reps ?? (type === 'warmup' ? '10' : ''),
    rpe: '',
    dbId: null,
    sortOrder: null,
    busy: false,
  });

  /** Serie normal al final. */
  const addSet = (pos: number) => {
    const rs = rows[pos];
    const last = [...rs].reverse().find((r) => r.type !== 'warmup');
    replaceRows(pos, [...rs, newRow(rs, 'normal', last)]);
  };

  /** Aproximación: tras las que ya hay y antes de cualquier otra serie. */
  const addWarmup = (pos: number) => {
    const rs = rows[pos];
    const next = insertAt(rs, warmupInsertIndex(rs), newRow(rs, 'warmup'));
    replaceRows(pos, next);
    void persistOrder(next);
  };

  /** Dropset justo después de la serie `afterId` (por defecto, la última serie de trabajo). */
  const addDropset = (pos: number, afterId?: string) => {
    const rs = rows[pos];
    let index = afterId ? rs.findIndex((r) => r.id === afterId) : -1;
    if (index === -1) index = rs.map((r) => r.type).lastIndexOf('normal');
    if (index === -1) return setError('Añade primero una serie normal para poder hacer un dropset a continuación.');
    const next = insertAt(rs, index + 1, newRow(rs, 'dropset', rs[index]));
    replaceRows(pos, next);
    void persistOrder(next);
  };

  const deleteRow = async (pos: number, rowId: string) => {
    const rs = rows[pos];
    const index = rs.findIndex((r) => r.id === rowId);
    const row = rs[index];
    if (!row) return;
    setError(null);
    if (row.dbId) {
      if (!(await confirm('Eliminar serie', 'Se borrará esta serie registrada.', 'Eliminar', true))) return;
      patchRow(rowId, { busy: true });
      try {
        await deleteSet(row.dbId);
      } catch {
        patchRow(rowId, { busy: false });
        return setError('No se pudo eliminar la serie. Comprueba tu conexión.');
      }
    }
    const next = removeAt(rs, index);
    replaceRows(pos, next);
    void persistOrder(next);
  };

  const addExercise = async (e: Exercise) => {
    if (!session) return;
    setPicker(false);
    const item: PlanItem = {
      exercise_id: e.id,
      name: e.name,
      muscle_group: e.muscle_group,
      sets: 3,
      reps_target: 10,
      reps_min: 10,
      reps_max: 10,
      rest_seconds: 90,
      notes: '',
      slot: nextSlot(session.plan),
    };
    const plan = [...session.plan, item];
    try {
      await updateSessionPlan(session.id, plan);
      const known = prev[e.id] ? prev : { ...prev, ...(await getPreviousSets([e.id], session.id).catch(() => ({}))) };
      setPrev(known);
      setSession({ ...session, plan });
      setRows((all) => [...all, buildRows(item, plan.length - 1, [], newRowId, known[e.id])]);
    } catch {
      setError('No se pudo añadir el ejercicio. Comprueba tu conexión.');
    }
  };

  /** Solo cambia el orden de esta sesión: la rutina guardada no se toca. Las series quedan ligadas al `slot`. */
  const applyExerciseOrder = async (keys: string[]) => {
    if (!session) return;
    const plan = orderByKeys(session.plan, (p) => String(p.slot), keys);
    const bySlot = new Map(session.plan.map((p, i) => [String(p.slot), rows[i]]));
    const previousSession = session;
    const previousRows = rows;
    setSession({ ...session, plan });
    setRows(plan.map((p) => bySlot.get(String(p.slot)) ?? []));
    try {
      await updateSessionPlan(session.id, plan);
    } catch {
      setSession(previousSession);
      setRows(previousRows);
      setError('No se pudo guardar el nuevo orden. Comprueba tu conexión.');
    }
  };

  const doneCount = rows.flat().filter((r) => r.dbId && r.type !== 'warmup').length;
  const anyDone = rows.flat().some((r) => r.dbId);

  const finish = async () => {
    if (!session) return;
    if (!anyDone) {
      if (!(await confirm('Descartar sesión', 'No has registrado ninguna serie. ¿Descartar la sesión?', 'Descartar', true))) return;
      setFinishing(true);
      try {
        await deleteSession(session.id);
        router.dismissTo('/entreno');
      } catch {
        setFinishing(false);
        setError('No se pudo descartar la sesión.');
      }
      return;
    }
    if (!(await confirm('Terminar sesión', `Has registrado ${doneCount} series. ¿Terminar el entreno?`, 'Terminar'))) return;
    setFinishing(true);
    try {
      await finishSession(session.id);
      success();
      router.replace({ pathname: '/session/[id]', params: { id: session.id } });
    } catch {
      setFinishing(false);
      setError('No se pudo terminar la sesión. Comprueba tu conexión.');
    }
  };

  const discard = async () => {
    if (!session) return;
    if (!(await confirm('Descartar sesión', 'Se borrarán todas las series de esta sesión.', 'Descartar', true))) return;
    try {
      await deleteSession(session.id);
      router.dismissTo('/entreno');
    } catch {
      setError('No se pudo descartar la sesión.');
    }
  };

  const onRestChange = useCallback((next: RestState | null) => setRest(next), []);
  const onRestFinished = useCallback(() => setRestDone(true), []);
  const hideRestDone = useCallback(() => setRestDone(false), []);

  if (loadError) {
    return (
      <Screen>
        <ErrorText>{loadError}</ErrorText>
        <Button title="Volver" variant="ghost" onPress={() => router.dismissTo('/entreno')} />
      </Screen>
    );
  }
  if (!session) {
    return (
      <Screen>
        <Text muted>Cargando…</Text>
      </Screen>
    );
  }

  const menuRow = menu ? rows[menu.pos]?.find((r) => r.id === menu.rowId) : undefined;
  const menuLabel = menu && menuRow ? setLabels(rows[menu.pos])[rows[menu.pos].indexOf(menuRow)] : '';

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <View>
          <Text variant="title">{session.routine_name}</Text>
          <ElapsedClock since={session.started_at} />
        </View>

        {session.plan.length === 0 ? <Text muted>Sesión libre: añade los ejercicios que vayas a hacer.</Text> : null}

        {session.plan.map((item, pos) => (
          <ExerciseCard
            key={`${item.exercise_id}-${slotOf(item, pos)}`}
            item={item}
            rows={rows[pos] ?? []}
            previous={prev[item.exercise_id]}
            onChange={patchRow}
            onToggle={(rowId) => void toggleSet(pos, rowId)}
            onAddSet={() => addSet(pos)}
            onAddWarmup={() => addWarmup(pos)}
            onAddDropset={() => addDropset(pos)}
            onMenu={(rowId) => setMenu({ pos, rowId })}
          />
        ))}

        <Button title="Añadir ejercicio" variant="secondary" onPress={() => setPicker(true)} />
        {session.plan.length > 1 ? (
          <Button title="Reordenar ejercicios" variant="ghost" onPress={() => setReorder(true)} />
        ) : null}
        <ErrorText>{error}</ErrorText>
        <Button title="Terminar sesión" onPress={() => void finish()} loading={finishing} />
        <LinkButton title="Descartar sesión" danger onPress={() => void discard()} />
        {rest ? <View style={{ height: 96 }} /> : null}
      </Screen>

      {rest ? <RestBar rest={rest} onChange={onRestChange} onFinished={onRestFinished} /> : null}
      <RestDoneToast visible={restDone} onHide={hideRestDone} />

      <ExercisePicker visible={picker} onClose={() => setPicker(false)} onPick={(e) => void addExercise(e)} />

      <ReorderSheet
        visible={reorder}
        title="Reordenar ejercicios"
        subtitle="Solo cambia esta sesión; tu rutina guardada no se modifica."
        items={session.plan.map((p, i) => ({
          key: String(slotOf(p, i)),
          label: p.name,
          hint: targetLabel(p.sets, p),
        }))}
        onClose={() => setReorder(false)}
        onApply={(keys) => void applyExerciseOrder(keys)}
      />

      <ActionSheet
        visible={!!menu && !!menuRow}
        title={menuRow ? `Serie ${menuLabel}` : ''}
        onClose={() => setMenu(null)}
        actions={
          menu && menuRow
            ? [
                ...(menuRow.type !== 'warmup'
                  ? [{ label: 'Añadir dropset a continuación', icon: 'arrow-down-circle-outline' as const, onPress: () => addDropset(menu.pos, menuRow.id) }]
                  : []),
                { label: 'Eliminar serie', icon: 'trash-outline' as const, danger: true, onPress: () => void deleteRow(menu.pos, menuRow.id) },
              ]
            : []
        }
      />
    </View>
  );
}

function ExerciseCard({
  item,
  rows,
  previous,
  onChange,
  onToggle,
  onAddSet,
  onAddWarmup,
  onAddDropset,
  onMenu,
}: {
  item: PlanItem;
  rows: Row[];
  previous?: Previous[string];
  onChange: (rowId: string, patch: Partial<Row>) => void;
  onToggle: (rowId: string) => void;
  onAddSet: () => void;
  onAddWarmup: () => void;
  onAddDropset: () => void;
  onMenu: (rowId: string) => void;
}) {
  const { colors } = useTheme();
  const { min, max } = repsRange(item);
  const isRange = min !== max;
  const labels = setLabels(rows);
  const done = rows
    .filter((r) => r.dbId)
    .map((r) => ({ weightKg: parseDecimal(r.weight) ?? 0, reps: parseDecimal(r.reps) ?? 0, type: r.type }));
  const suggestion = previous ? suggestNextWeight(previous.sets.map(toData), item.sets, max) : null;
  // La aproximación no cuenta para el 1RM; el objetivo y la progresión miran solo las series normales.
  const oneRm = bestEstimated1RM(done);
  const completed = done.filter(isNormalSet).length >= item.sets && targetsMet(done, item.sets, max);
  const nextWeight = completed ? suggestNextWeight(done, item.sets, max) : null;

  return (
    <Card>
      <Text variant="heading">{item.name}</Text>
      <Text variant="caption" muted>
        Objetivo: {targetLabel(item.sets, item)} · descanso {item.rest_seconds} s
      </Text>
      {item.notes ? <Text variant="caption">{item.notes}</Text> : null}

      {previous ? (
        <Text variant="caption" muted>
          Última vez ({new Date(previous.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}):{' '}
          {previous.sets.map((s) => `${formatKg(s.weight_kg)}×${s.reps}`).join(' · ')}
        </Text>
      ) : (
        <Text variant="caption" muted>
          Primera vez con este ejercicio.
        </Text>
      )}
      {suggestion != null ? (
        <Text variant="caption" style={{ color: colors.primary, fontWeight: '600' }}>
          Sugerencia: {formatKg(suggestion)} kg ({isRange ? `llegaste a ${max} repeticiones en todas las series` : 'completaste todas las repeticiones la última vez'})
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: ROW_GAP, paddingTop: spacing.xs }}>
        <Text variant="caption" muted numberOfLines={1} style={{ width: LABEL_W }}>
          Serie
        </Text>
        <Text variant="caption" muted style={{ flex: 1.3, minWidth: 0 }}>
          kg
        </Text>
        <Text variant="caption" muted style={{ flex: 1, minWidth: 0 }}>
          Reps
        </Text>
        <Text variant="caption" muted style={{ flex: 0.9, minWidth: 0 }}>
          RPE
        </Text>
        <View style={{ width: CHECK_W }} />
      </View>

      {rows.map((r, idx) => (
        <View key={r.id} style={{ flexDirection: 'row', gap: ROW_GAP, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Serie ${labels[idx]}${r.type === 'warmup' ? ' de aproximación' : r.type === 'dropset' ? ' dropset' : ''}: opciones`}
            onPress={() => onMenu(r.id)}
            style={{
              width: LABEL_W,
              height: 36,
              borderRadius: radius.sm,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: r.type === 'normal' ? colors.surfaceAlt : colors.warningBg,
              borderWidth: 1,
              borderColor: r.type === 'normal' ? colors.border : colors.warningText,
            }}
          >
            <Text variant="label" style={{ color: r.type === 'normal' ? colors.textMuted : colors.warningText }}>
              {labels[idx]}
            </Text>
          </Pressable>
          <SetInput flex={1.3} label={`Peso serie ${labels[idx]}`} value={r.weight} editable={!r.dbId} onChangeText={(t) => onChange(r.id, { weight: t })} decimal />
          <SetInput flex={1} label={`Repeticiones serie ${labels[idx]}`} value={r.reps} editable={!r.dbId} onChangeText={(t) => onChange(r.id, { reps: t })} />
          <SelectField
            style={{ flex: 0.9 }}
            label={`RPE serie ${labels[idx]}`}
            title="RPE (esfuerzo percibido)"
            value={r.rpe}
            options={RPE_OPTIONS}
            disabled={!!r.dbId}
            onChange={(k) => onChange(r.id, { rpe: k })}
          />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Serie ${labels[idx]} completada`}
            accessibilityState={{ checked: !!r.dbId, busy: r.busy }}
            onPress={() => onToggle(r.id)}
            hitSlop={6}
            style={{ width: CHECK_W, height: 44, alignItems: 'center', justifyContent: 'center', opacity: r.busy ? 0.5 : 1 }}
          >
            <Ionicons
              name={r.dbId ? 'checkmark-circle' : 'ellipse-outline'}
              size={30}
              color={r.dbId ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </View>
      ))}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg }}>
        <LinkButton title="+ Serie" onPress={onAddSet} />
        <LinkButton title="+ Aproximación" onPress={onAddWarmup} />
        <LinkButton title="+ Dropset" onPress={onAddDropset} />
      </View>

      {oneRm != null ? (
        <Text variant="caption" muted>
          1RM estimado (Epley): {formatKg(Math.round(oneRm * 10) / 10)} kg
        </Text>
      ) : null}
      {nextWeight != null ? (
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
          <Text variant="label">¡Objetivo cumplido!</Text>
          <Text variant="caption">
            {isRange
              ? `Has llegado a ${max} repeticiones en todas las series normales. La próxima vez prueba con ${formatKg(nextWeight)} kg y vuelve a ${repsLabel(min, min)} repeticiones.`
              : `Has completado todas las repeticiones objetivo. La próxima vez prueba con ${formatKg(nextWeight)} kg.`}
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

const LABEL_W = 34;
const CHECK_W = 38;
const ROW_GAP = 6;

function SetInput({
  value,
  onChangeText,
  editable,
  label,
  flex,
  decimal,
}: {
  value: string;
  onChangeText: (t: string) => void;
  editable: boolean;
  label: string;
  flex: number;
  decimal?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <TextInput
      accessibilityLabel={label}
      value={value}
      onChangeText={onChangeText}
      editable={editable}
      keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
      selectTextOnFocus
      maxLength={6}
      style={{
        flex,
        minWidth: 0,
        minHeight: 44,
        borderRadius: radius.sm,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: editable ? colors.surface : colors.surfaceAlt,
        color: colors.text,
        textAlign: 'center',
        fontSize: 16,
      }}
    />
  );
}
