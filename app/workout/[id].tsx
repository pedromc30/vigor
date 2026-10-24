import { useCallback, useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ExercisePicker } from '../../src/components/exercise-picker';
import { ElapsedClock, RestBar, type RestState } from '../../src/components/rest-timer';
import { Button, Card, ErrorText, LinkButton, Screen, Text } from '../../src/components/ui';
import { confirm } from '../../src/lib/confirm';
import {
  deleteSession,
  deleteSet,
  finishSession,
  getPreviousSets,
  getSession,
  getSessionSets,
  saveSet,
  updateSessionPlan,
  type Exercise,
  type PlanItem,
  type Session,
  type SessionSet,
} from '../../src/lib/training';
import { bestEstimated1RM, formatKg, suggestNextWeight, targetsMet } from '../../src/lib/training-math';
import { parseDecimal } from '../../src/lib/validation';
import { success, tap } from '../../src/lib/haptics';
import { useAuth } from '../../src/providers/AuthProvider';
import { radius, spacing, useTheme } from '../../src/theme';

interface Row {
  weight: string;
  reps: string;
  rpe: string;
  dbId: string | null;
  busy: boolean;
}
type Previous = Record<string, { date: string; sets: SessionSet[] }>;

const toData = (s: { weight_kg: number; reps: number }) => ({ weightKg: s.weight_kg, reps: s.reps });

/** Filas de series de un ejercicio: las ya registradas más las pendientes, con la carga sugerida. */
function buildRows(item: PlanItem, position: number, sets: SessionSet[], prev?: Previous[string]): Row[] {
  const mine = sets.filter((s) => s.position === position);
  const count = Math.max(item.sets, ...mine.map((s) => s.set_index + 1));
  const suggestion = prev ? suggestNextWeight(prev.sets.map(toData), item.sets, item.reps_target) : null;
  return Array.from({ length: count }, (_, i): Row => {
    const done = mine.find((s) => s.set_index === i);
    if (done) {
      return {
        weight: formatKg(done.weight_kg),
        reps: String(done.reps),
        rpe: done.rpe == null ? '' : formatKg(done.rpe),
        dbId: done.id,
        busy: false,
      };
    }
    const fallback = prev?.sets[i]?.weight_kg ?? prev?.sets[prev.sets.length - 1]?.weight_kg;
    const w = suggestion ?? fallback;
    return { weight: w != null ? formatKg(w) : '', reps: String(item.reps_target), rpe: '', dbId: null, busy: false };
  });
}

export default function Workout() {
  const router = useRouter();
  const { session: auth } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<Row[][]>([]);
  const [prev, setPrev] = useState<Previous>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rest, setRest] = useState<RestState | null>(null);
  const [picker, setPicker] = useState(false);
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
        setRows(s.plan.map((p, pos) => buildRows(p, pos, sets, previous[p.exercise_id])));
      } catch {
        setLoadError('No se pudo cargar la sesión. Comprueba tu conexión.');
      }
    })();
  }, [id]);

  const patchRow = (pos: number, idx: number, patch: Partial<Row>) =>
    setRows((all) => all.map((rs, p) => (p === pos ? rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)) : rs)));

  const toggleSet = async (pos: number, idx: number) => {
    if (!session || !auth) return;
    const item = session.plan[pos];
    const row = rows[pos][idx];
    if (row.busy) return;
    setError(null);

    if (row.dbId) {
      patchRow(pos, idx, { busy: true });
      try {
        await deleteSet(row.dbId);
        patchRow(pos, idx, { dbId: null, busy: false });
      } catch {
        patchRow(pos, idx, { busy: false });
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

    patchRow(pos, idx, { busy: true });
    try {
      const saved = await saveSet({
        session_id: session.id,
        user_id: auth.user.id,
        exercise_id: item.exercise_id,
        position: pos,
        set_index: idx,
        weight_kg: weight,
        reps,
        rpe,
        target_reps: item.reps_target,
      });
      patchRow(pos, idx, { dbId: saved.id, busy: false });
      tap();
      if (item.rest_seconds > 0) setRest({ endsAt: Date.now() + item.rest_seconds * 1000, total: item.rest_seconds });
    } catch {
      patchRow(pos, idx, { busy: false });
      setError('No se pudo guardar la serie. Comprueba tu conexión e inténtalo de nuevo.');
    }
  };

  const addSet = (pos: number) =>
    setRows((all) =>
      all.map((rs, p) => {
        if (p !== pos) return rs;
        const last = rs[rs.length - 1];
        return [...rs, { weight: last?.weight ?? '', reps: last?.reps ?? '', rpe: '', dbId: null, busy: false }];
      }),
    );

  const addExercise = async (e: Exercise) => {
    if (!session) return;
    setPicker(false);
    const item: PlanItem = {
      exercise_id: e.id,
      name: e.name,
      muscle_group: e.muscle_group,
      sets: 3,
      reps_target: 10,
      rest_seconds: 90,
      notes: '',
    };
    const plan = [...session.plan, item];
    try {
      await updateSessionPlan(session.id, plan);
      const known = prev[e.id] ? prev : { ...prev, ...(await getPreviousSets([e.id], session.id).catch(() => ({}))) };
      setPrev(known);
      setSession({ ...session, plan });
      setRows((all) => [...all, buildRows(item, plan.length - 1, [], known[e.id])]);
    } catch {
      setError('No se pudo añadir el ejercicio. Comprueba tu conexión.');
    }
  };

  const doneCount = rows.flat().filter((r) => r.dbId).length;

  const finish = async () => {
    if (!session) return;
    if (doneCount === 0) {
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
            key={`${item.exercise_id}-${pos}`}
            item={item}
            rows={rows[pos] ?? []}
            previous={prev[item.exercise_id]}
            onChange={(idx, patch) => patchRow(pos, idx, patch)}
            onToggle={(idx) => void toggleSet(pos, idx)}
            onAddSet={() => addSet(pos)}
          />
        ))}

        <Button title="Añadir ejercicio" variant="secondary" onPress={() => setPicker(true)} />
        <ErrorText>{error}</ErrorText>
        <Button title="Terminar sesión" onPress={() => void finish()} loading={finishing} />
        <LinkButton title="Descartar sesión" danger onPress={() => void discard()} />
        {rest ? <View style={{ height: 96 }} /> : null}
      </Screen>

      {rest ? <RestBar rest={rest} onChange={onRestChange} /> : null}

      <ExercisePicker visible={picker} onClose={() => setPicker(false)} onPick={(e) => void addExercise(e)} />
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
}: {
  item: PlanItem;
  rows: Row[];
  previous?: Previous[string];
  onChange: (idx: number, patch: Partial<Row>) => void;
  onToggle: (idx: number) => void;
  onAddSet: () => void;
}) {
  const { colors } = useTheme();
  const done = rows.filter((r) => r.dbId).map((r) => ({ weightKg: parseDecimal(r.weight) ?? 0, reps: parseDecimal(r.reps) ?? 0 }));
  const suggestion = previous ? suggestNextWeight(previous.sets.map(toData), item.sets, item.reps_target) : null;
  const oneRm = bestEstimated1RM(done);
  const completed = done.length >= item.sets && targetsMet(done, item.sets, item.reps_target);
  const nextWeight = completed ? suggestNextWeight(done, item.sets, item.reps_target) : null;

  return (
    <Card>
      <Text variant="heading">{item.name}</Text>
      <Text variant="caption" muted>
        Objetivo: {item.sets} × {item.reps_target} · descanso {item.rest_seconds} s
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
          Sugerencia: {formatKg(suggestion)} kg (completaste todas las repeticiones la última vez)
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.xs }}>
        <Text variant="caption" muted numberOfLines={1} style={{ width: 38 }}>
          Serie
        </Text>
        <Text variant="caption" muted style={{ flex: 1.2 }}>
          kg
        </Text>
        <Text variant="caption" muted style={{ flex: 1 }}>
          Reps
        </Text>
        <Text variant="caption" muted style={{ flex: 0.9 }}>
          RPE
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {rows.map((r, idx) => (
        <View key={idx} style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
          <Text style={{ width: 38 }} muted>
            {idx + 1}
          </Text>
          <SetInput flex={1.2} label={`Peso serie ${idx + 1}`} value={r.weight} editable={!r.dbId} onChangeText={(t) => onChange(idx, { weight: t })} decimal />
          <SetInput flex={1} label={`Repeticiones serie ${idx + 1}`} value={r.reps} editable={!r.dbId} onChangeText={(t) => onChange(idx, { reps: t })} />
          <SetInput flex={0.9} label={`RPE serie ${idx + 1}`} value={r.rpe} editable={!r.dbId} onChangeText={(t) => onChange(idx, { rpe: t })} decimal />
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Serie ${idx + 1} completada`}
            accessibilityState={{ checked: !!r.dbId, busy: r.busy }}
            onPress={() => onToggle(idx)}
            hitSlop={6}
            style={{ width: 40, height: 44, alignItems: 'center', justifyContent: 'center', opacity: r.busy ? 0.5 : 1 }}
          >
            <Ionicons
              name={r.dbId ? 'checkmark-circle' : 'ellipse-outline'}
              size={30}
              color={r.dbId ? colors.primary : colors.textMuted}
            />
          </Pressable>
        </View>
      ))}

      <LinkButton title="+ Serie" onPress={onAddSet} />

      {oneRm != null ? (
        <Text variant="caption" muted>
          1RM estimado (Epley): {formatKg(Math.round(oneRm * 10) / 10)} kg
        </Text>
      ) : null}
      {nextWeight != null ? (
        <View style={{ backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: spacing.md }}>
          <Text variant="label">¡Objetivo cumplido!</Text>
          <Text variant="caption">
            Has completado todas las repeticiones objetivo. La próxima vez prueba con {formatKg(nextWeight)} kg.
          </Text>
        </View>
      ) : null}
    </Card>
  );
}

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
