// Acceso a datos de objetivos y logros (Supabase). La lógica de qué es un récord está en `achievements.ts`.
import { supabase } from './supabase';
import { loadPref, savePref } from './local-prefs';
import {
  missingPRs,
  prKey,
  prTimeline,
  toTimelineSet,
  type AchievementKind,
  type GoalKind,
  type PREvent,
} from './achievements';
import { getExerciseSets, listTrainedExercises, selectAll } from './progress';

export interface Goal {
  id: string;
  exercise_id: string;
  kind: GoalKind;
  target_weight_kg: number;
  target_reps: number;
  achieved_at: string | null;
  created_at: string;
}

export interface Achievement {
  id: string;
  exercise_id: string;
  kind: AchievementKind;
  value: number;
  weight_kg: number;
  reps: number;
  goal_id: string | null;
  set_id: string | null;
  session_id: string | null;
  achieved_at: string;
}

export interface GoalInput {
  exercise_id: string;
  kind: GoalKind;
  target_weight_kg: number;
  target_reps: number;
}

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

const normGoal = (g: Goal): Goal => ({ ...g, target_weight_kg: Number(g.target_weight_kg) });
const normAchievement = (a: Achievement): Achievement => ({ ...a, value: Number(a.value), weight_kg: Number(a.weight_kg) });

// ---------- Objetivos ----------

export async function listGoals(): Promise<Goal[]> {
  return (check(await supabase.from('exercise_goals').select('*').order('created_at')) as Goal[]).map(normGoal);
}

export async function createGoal(userId: string, g: GoalInput): Promise<Goal> {
  return normGoal(check(await supabase.from('exercise_goals').insert({ ...g, user_id: userId }).select('*').single()) as Goal);
}

/** Editar un objetivo lo vuelve a dejar pendiente: se comprueba otra vez contra lo que se haga a partir de ahora. */
export async function updateGoal(id: string, g: GoalInput): Promise<void> {
  const { error } = await supabase.from('exercise_goals').update({ ...g, achieved_at: null }).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Vuelve a dejar pendiente un objetivo (p. ej. al deshacer la serie que lo consiguió). */
export async function reopenGoal(id: string): Promise<void> {
  const { error } = await supabase.from('exercise_goals').update({ achieved_at: null }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('exercise_goals').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Logros ----------

export async function listAchievements(limit = 200): Promise<Achievement[]> {
  return (
    check(await supabase.from('achievements').select('*').order('achieved_at', { ascending: false }).limit(limit)) as Achievement[]
  ).map(normAchievement);
}

export interface NewAchievement {
  user_id: string;
  exercise_id: string;
  kind: AchievementKind;
  value: number;
  weight_kg: number;
  reps: number;
  goal_id?: string | null;
  set_id?: string | null;
  session_id?: string | null;
  achieved_at?: string;
}

export async function insertAchievements(rows: NewAchievement[]): Promise<void> {
  if (!rows.length) return;
  const { error } = await supabase.from('achievements').insert(rows);
  if (error) throw new Error(error.message);
}

export interface SetContext {
  userId: string;
  exerciseId: string;
  sessionId: string;
  setId: string;
  weightKg: number;
  reps: number;
}

/**
 * Guarda lo conseguido con una serie recién registrada: los récords y los objetivos cumplidos (que además quedan
 * marcados como conseguidos). Si algo falla no se reintenta: el entreno no depende de esto.
 */
export async function recordAchievements(ctx: SetContext, prs: PREvent[], goals: Goal[]): Promise<void> {
  // La hora la pone el móvil: así es la del entreno aunque el envío se retrase por falta de conexión.
  const now = new Date().toISOString();
  const base = { user_id: ctx.userId, exercise_id: ctx.exerciseId, set_id: ctx.setId, session_id: ctx.sessionId, achieved_at: now };
  const rows: NewAchievement[] = [
    ...prs.map((p) => ({ ...base, kind: p.kind, value: p.value, weight_kg: p.weightKg, reps: p.reps })),
    ...goals.map((g) => ({
      ...base,
      kind: 'goal' as const,
      value: g.kind === 'weight' ? ctx.weightKg : ctx.reps,
      weight_kg: ctx.weightKg,
      reps: ctx.reps,
      goal_id: g.id,
    })),
  ];
  await insertAchievements(rows);
  for (const g of goals) {
    const { error } = await supabase.from('exercise_goals').update({ achieved_at: now }).eq('id', g.id);
    if (error) throw new Error(error.message);
  }
}

// ---------- Récords del historial anterior ----------

const BACKFILL_KEY = 'vigor.achievements.backfill.v1';

/**
 * Reconoce, una sola vez por usuario, los récords que ya había en el historial y los guarda sin celebrarlos.
 * Es segura de repetir: no duplica lo ya guardado. Devuelve true si guardó algo nuevo.
 */
export async function ensureAchievementsBackfill(userId: string): Promise<boolean> {
  const key = `${BACKFILL_KEY}.${userId}`;
  if (await loadPref(key, false)) return false;
  try {
    const saved = await selectAll<{ set_id: string | null; kind: AchievementKind }>((from, to) =>
      supabase.from('achievements').select('set_id, kind').neq('kind', 'goal').order('id').range(from, to),
    );
    const savedKeys = new Set(saved.filter((s) => s.set_id).map((s) => prKey(s.set_id!, s.kind)));
    const rows: NewAchievement[] = [];
    for (const ex of await listTrainedExercises()) {
      const sets = await getExerciseSets(ex.id);
      const bySet = new Map(sets.map((s) => [s.id, s]));
      for (const e of missingPRs(prTimeline(sets.map(toTimelineSet)), savedKeys)) {
        rows.push({
          user_id: userId,
          exercise_id: ex.id,
          kind: e.kind,
          value: e.value,
          weight_kg: e.weightKg,
          reps: e.reps,
          set_id: e.setId,
          session_id: bySet.get(e.setId)?.session_id ?? null,
          achieved_at: e.at,
        });
      }
    }
    for (let i = 0; i < rows.length; i += 100) await insertAchievements(rows.slice(i, i + 100));
    await savePref(key, true);
    return rows.length > 0;
  } catch {
    return false; // sin red o error: se intentará la próxima vez
  }
}
