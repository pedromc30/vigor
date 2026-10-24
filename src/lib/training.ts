import { supabase } from './supabase';
import type { Equipment, MuscleGroup } from './labels';

export interface Exercise {
  id: string;
  user_id: string | null;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  description: string;
}

export interface Routine {
  id: string;
  name: string;
  notes: string;
  day_names: string[];
  schedule: number[];
  routine_exercises?: RoutineExercise[];
}

export interface RoutineExercise {
  id: string;
  exercise_id: string;
  day_index: number;
  position: number;
  sets: number;
  reps_target: number;
  rest_seconds: number;
  notes: string;
  exercises: Pick<Exercise, 'id' | 'name' | 'muscle_group' | 'equipment'> | null;
}

export interface PlanItem {
  exercise_id: string;
  name: string;
  muscle_group: MuscleGroup;
  sets: number;
  reps_target: number;
  rest_seconds: number;
  notes: string;
}

export interface Session {
  id: string;
  routine_id: string | null;
  routine_name: string;
  plan: PlanItem[];
  started_at: string;
  finished_at: string | null;
  notes: string;
}

export interface SessionSet {
  id: string;
  session_id: string;
  exercise_id: string;
  position: number;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  target_reps: number | null;
  created_at: string;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const num = (v: unknown) => Number(v);

function normalizeSet(s: SessionSet): SessionSet {
  return { ...s, weight_kg: num(s.weight_kg), rpe: s.rpe == null ? null : num(s.rpe) };
}

// ---------- Ejercicios ----------

export async function listExercises(): Promise<Exercise[]> {
  return check(await supabase.from('exercises').select('*').order('name'));
}

export async function createExercise(v: Pick<Exercise, 'name' | 'muscle_group' | 'equipment' | 'description'>, userId: string) {
  return check(await supabase.from('exercises').insert({ ...v, user_id: userId }).select('*').single()) as Exercise;
}

export async function deleteExercise(id: string) {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Rutinas ----------

export async function listRoutines(): Promise<Routine[]> {
  return check(
    await supabase
      .from('routines')
      .select('*, routine_exercises(id, exercise_id, day_index)')
      .order('created_at', { ascending: false }),
  ) as unknown as Routine[];
}

export async function getRoutine(id: string): Promise<Routine | null> {
  const { data, error } = await supabase
    .from('routines')
    .select(
      '*, routine_exercises(id, exercise_id, day_index, position, sets, reps_target, rest_seconds, notes, exercises(id, name, muscle_group, equipment))',
    )
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const routine = data as unknown as Routine;
  routine.routine_exercises = (routine.routine_exercises ?? []).sort(
    (a, b) => a.day_index - b.day_index || a.position - b.position,
  );
  return routine;
}

export interface RoutineInput {
  id: string | null;
  name: string;
  notes: string;
  dayNames: string[];
  schedule: number[];
  items: {
    exercise_id: string;
    day_index: number;
    position: number;
    sets: number;
    reps_target: number;
    rest_seconds: number;
    notes: string;
  }[];
}

export async function saveRoutine(r: RoutineInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_routine', {
    p_id: r.id,
    p_name: r.name,
    p_notes: r.notes,
    p_day_names: r.dayNames,
    p_schedule: r.schedule,
    p_items: r.items,
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export async function deleteRoutine(id: string) {
  const { error } = await supabase.from('routines').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export function planForDay(routine: Routine, dayIndex: number): PlanItem[] {
  return (routine.routine_exercises ?? [])
    .filter((e) => e.day_index === dayIndex && e.exercises)
    .sort((a, b) => a.position - b.position)
    .map((e) => ({
      exercise_id: e.exercise_id,
      name: e.exercises!.name,
      muscle_group: e.exercises!.muscle_group,
      sets: e.sets,
      reps_target: e.reps_target,
      rest_seconds: e.rest_seconds,
      notes: e.notes,
    }));
}

// ---------- Sesiones ----------

export async function startSession(
  userId: string,
  routineId: string | null,
  name: string,
  plan: PlanItem[],
): Promise<string> {
  const row = check(
    await supabase
      .from('workout_sessions')
      .insert({ user_id: userId, routine_id: routineId, routine_name: name, plan })
      .select('id')
      .single(),
  ) as { id: string };
  return row.id;
}

export async function getSession(id: string): Promise<Session | null> {
  const { data, error } = await supabase.from('workout_sessions').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return data as Session | null;
}

export async function getActiveSession(): Promise<Session | null> {
  const { data, error } = await supabase
    .from('workout_sessions')
    .select('*')
    .is('finished_at', null)
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Session | null;
}

export async function updateSessionPlan(id: string, plan: PlanItem[]) {
  const { error } = await supabase.from('workout_sessions').update({ plan }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function finishSession(id: string) {
  const { error } = await supabase
    .from('workout_sessions')
    .update({ finished_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteSession(id: string) {
  const { error } = await supabase.from('workout_sessions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function listFinishedSessions(limit = 40): Promise<{ session: Session; sets: SessionSet[] }[]> {
  const sessions = check(
    await supabase
      .from('workout_sessions')
      .select('*')
      .not('finished_at', 'is', null)
      .order('started_at', { ascending: false })
      .limit(limit),
  ) as Session[];
  if (!sessions.length) return [];
  const sets = (
    check(await supabase.from('workout_sets').select('*').in('session_id', sessions.map((s) => s.id))) as SessionSet[]
  ).map(normalizeSet);
  return sessions.map((session) => ({ session, sets: sets.filter((s) => s.session_id === session.id) }));
}

// ---------- Series ----------

export async function getSessionSets(sessionId: string): Promise<SessionSet[]> {
  const rows = check(
    await supabase
      .from('workout_sets')
      .select('*')
      .eq('session_id', sessionId)
      .order('position')
      .order('set_index'),
  ) as SessionSet[];
  return rows.map(normalizeSet);
}

export interface SetInput {
  session_id: string;
  user_id: string;
  exercise_id: string;
  position: number;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  target_reps: number | null;
}

/** Idempotente: repetir la misma serie la actualiza en lugar de duplicarla. */
export async function saveSet(s: SetInput): Promise<SessionSet> {
  const row = check(
    await supabase
      .from('workout_sets')
      .upsert(s, { onConflict: 'session_id,position,set_index' })
      .select('*')
      .single(),
  ) as SessionSet;
  return normalizeSet(row);
}

export async function deleteSet(id: string) {
  const { error } = await supabase.from('workout_sets').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** Series de la última sesión terminada (distinta de la actual) de cada ejercicio. */
export async function getPreviousSets(
  exerciseIds: string[],
  excludeSessionId: string,
): Promise<Record<string, { date: string; sets: SessionSet[] }>> {
  if (!exerciseIds.length) return {};
  const rows = (
    check(
      await supabase
        .from('workout_sets')
        .select('*, workout_sessions!inner(finished_at)')
        .in('exercise_id', exerciseIds)
        .neq('session_id', excludeSessionId)
        .not('workout_sessions.finished_at', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300),
    ) as (SessionSet & { workout_sessions: { finished_at: string } })[]
  ).map((r) => ({ ...normalizeSet(r), finished_at: r.workout_sessions.finished_at }));

  const result: Record<string, { date: string; sets: SessionSet[] }> = {};
  for (const r of rows) {
    const entry = result[r.exercise_id];
    if (!entry) result[r.exercise_id] = { date: r.finished_at, sets: [r] };
    else if (entry.sets[0].session_id === r.session_id) entry.sets.push(r);
  }
  for (const e of Object.values(result)) e.sets.sort((a, b) => a.set_index - b.set_index);
  return result;
}

/** Series registradas desde `since`, con el grupo muscular del ejercicio. */
export async function getSetsSince(since: Date) {
  const rows = check(
    await supabase
      .from('workout_sets')
      .select('weight_kg, reps, exercises(muscle_group)')
      .gte('created_at', since.toISOString()),
  ) as unknown as { weight_kg: number; reps: number; exercises: { muscle_group: string } | null }[];
  return rows
    .filter((r) => r.exercises)
    .map((r) => ({ muscleGroup: r.exercises!.muscle_group, weightKg: num(r.weight_kg), reps: r.reps }));
}
