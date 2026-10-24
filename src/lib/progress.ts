import { supabase } from './supabase';
import { toISODate } from './diet-math';

const BUCKET = 'progress-photos';
const PAGE = 1000; // límite por petición de la API de Supabase

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

/** Lee todas las filas de una consulta paginando de 1000 en 1000 (la API corta en 1000 por defecto). */
export async function selectAll<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const rows = check(await page(from, from + PAGE - 1)) ?? [];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

const num = (v: unknown) => (v == null ? null : Number(v));

// ---------- Medidas corporales ----------

export interface BodyMetric {
  id: string;
  measured_on: string;
  weight_kg: number | null;
  waist_cm: number | null;
  hip_cm: number | null;
  arm_cm: number | null;
  thigh_cm: number | null;
}

export type MetricValues = Partial<Pick<BodyMetric, 'weight_kg' | 'waist_cm' | 'hip_cm' | 'arm_cm' | 'thigh_cm'>>;

export async function listMetrics(): Promise<BodyMetric[]> {
  const rows = await selectAll<BodyMetric>((from, to) =>
    supabase.from('body_metrics').select('*').order('measured_on', { ascending: true }).range(from, to),
  );
  return rows.map((r) => ({ ...r, weight_kg: num(r.weight_kg), waist_cm: num(r.waist_cm), hip_cm: num(r.hip_cm), arm_cm: num(r.arm_cm), thigh_cm: num(r.thigh_cm) }));
}

/** Guarda solo las medidas indicadas ese día; las que no se envían se conservan. */
export async function saveMetrics(userId: string, date: string, values: MetricValues): Promise<void> {
  const { error } = await supabase
    .from('body_metrics')
    .upsert({ user_id: userId, measured_on: date, ...values }, { onConflict: 'user_id,measured_on' });
  if (error) throw new Error(error.message);
}

export async function deleteMetric(id: string): Promise<void> {
  const { error } = await supabase.from('body_metrics').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// ---------- Fotos de progreso (bucket privado) ----------

export interface ProgressPhoto {
  id: string;
  taken_on: string;
  storage_path: string;
  note: string;
}

export async function listPhotos(): Promise<ProgressPhoto[]> {
  return check(
    await supabase.from('progress_photos').select('*').order('taken_on', { ascending: false }).order('created_at', { ascending: false }),
  ) as ProgressPhoto[];
}

/** URL firmadas temporales (1 h): el bucket no es público, sin firma no se puede ver nada. */
export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, 3600);
  if (error) throw new Error(error.message);
  const out: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
  return out;
}

export async function uploadPhoto(userId: string, date: string, bytes: Uint8Array, note = ''): Promise<void> {
  const path = `${userId}/${date}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const up = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { error } = await supabase.from('progress_photos').insert({ user_id: userId, taken_on: date, storage_path: path, note });
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]); // no dejar archivos huérfanos
    throw new Error(error.message);
  }
}

/** Borra primero el archivo y después la fila; si falla el archivo no se toca la fila. */
export async function deletePhoto(photo: ProgressPhoto): Promise<void> {
  const rm = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
  if (rm.error) throw new Error(rm.error.message);
  const { error } = await supabase.from('progress_photos').delete().eq('id', photo.id);
  if (error) throw new Error(error.message);
}

/**
 * Borra todos los archivos de fotos del usuario (Storage no se vacía solo al borrar la cuenta).
 * Lanza error si no puede, para no dejar archivos huérfanos tras eliminar la cuenta.
 */
export async function deleteAllPhotoFiles(): Promise<void> {
  const rows = await selectAll<{ storage_path: string }>((from, to) =>
    supabase.from('progress_photos').select('storage_path').range(from, to),
  );
  const paths = rows.map((r) => r.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }
}

// ---------- Datos para gráficas ----------

/** Kcal registradas por entrada desde `since` (AAAA-MM-DD), para sumar por día. */
export async function getKcalRows(since: string): Promise<{ log_date: string; kcal: number }[]> {
  const rows = await selectAll<{ log_date: string; kcal: number }>((from, to) =>
    supabase.from('meal_logs').select('log_date, kcal').gte('log_date', since).order('log_date').range(from, to),
  );
  return rows.map((r) => ({ log_date: r.log_date, kcal: Number(r.kcal) }));
}

/** Fechas locales (AAAA-MM-DD) de las sesiones terminadas desde `since`. */
export async function getSessionDates(since: string): Promise<string[]> {
  const rows = await selectAll<{ started_at: string }>((from, to) =>
    supabase
      .from('workout_sessions')
      .select('started_at')
      .not('finished_at', 'is', null)
      .gte('started_at', new Date(`${since}T00:00:00`).toISOString())
      .order('started_at')
      .range(from, to),
  );
  return rows.map((r) => toISODate(new Date(r.started_at)));
}

/** Ejercicios con series registradas, para elegir cuál graficar. */
export async function listTrainedExercises(): Promise<{ id: string; name: string }[]> {
  const rows = (await selectAll<{ exercise_id: string; exercises: { name: string } | null }>(
    (from, to) =>
      supabase.from('workout_sets').select('exercise_id, exercises(name)').order('created_at', { ascending: false }).range(from, to) as never,
  )) as { exercise_id: string; exercises: { name: string } | null }[];
  const seen = new Map<string, string>();
  for (const r of rows) if (r.exercises && !seen.has(r.exercise_id)) seen.set(r.exercise_id, r.exercises.name);
  return [...seen.entries()].map(([id, name]) => ({ id, name }));
}

export async function getExerciseSets(exerciseId: string) {
  const rows = await selectAll<{ session_id: string; weight_kg: number; reps: number; created_at: string }>((from, to) =>
    supabase
      .from('workout_sets')
      .select('session_id, weight_kg, reps, created_at')
      .eq('exercise_id', exerciseId)
      .order('created_at')
      .range(from, to),
  );
  return rows.map((r) => ({ ...r, weight_kg: Number(r.weight_kg) }));
}
