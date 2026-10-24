// Conversión de los datos del usuario a tablas (cabeceras + filas) para exportarlos a CSV.
import type { Cell } from './csv';

export interface Table {
  filename: string;
  headers: string[];
  rows: Cell[][];
}

const date = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

export function profileTable(p: Record<string, unknown>): Table {
  const list = (v: unknown) => (Array.isArray(v) ? v.join('; ') : '');
  return {
    filename: 'perfil',
    headers: ['sexo', 'edad', 'altura_cm', 'peso_kg', 'nivel_actividad', 'objetivo', 'dias_entreno_semana', 'dieta', 'alergias', 'objetivo_kcal', 'objetivo_proteina_g', 'objetivo_grasa_g', 'objetivo_carbohidratos_g', 'objetivo_agua_ml', 'objetivos_editados_a_mano', 'consentimiento_fecha', 'consentimiento_version'],
    rows: [[p.sex, p.age, p.height_cm, p.weight_kg, p.activity_level, p.goal, p.training_days_per_week, p.diet_preference, list(p.allergies), p.target_kcal, p.target_protein_g, p.target_fat_g, p.target_carbs_g, p.water_goal_ml, p.targets_manual, p.health_consent_at, p.consent_version] as Cell[]],
  };
}

export interface SessionRow {
  id: string;
  routine_name: string;
  started_at: string;
  finished_at: string | null;
  plan: { name: string; muscle_group: string }[];
}
export interface SetRow {
  session_id: string;
  position: number;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  target_reps: number | null;
}

export function workoutsTable(sessions: SessionRow[], sets: SetRow[]): Table {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const rows = [...sets]
    .sort((a, b) => (byId.get(a.session_id)?.started_at ?? '').localeCompare(byId.get(b.session_id)?.started_at ?? '') || a.position - b.position || a.set_index - b.set_index)
    .map((s) => {
      const session = byId.get(s.session_id);
      const ex = session?.plan?.[s.position];
      return [date(session?.started_at), session?.routine_name ?? '', ex?.name ?? '', ex?.muscle_group ?? '', s.set_index + 1, s.weight_kg, s.reps, s.rpe, s.target_reps, session?.finished_at ? 'sí' : 'no'] as Cell[];
    });
  return { filename: 'entrenos', headers: ['fecha', 'sesion', 'ejercicio', 'grupo_muscular', 'serie', 'peso_kg', 'repeticiones', 'rpe', 'repeticiones_objetivo', 'sesion_terminada'], rows };
}

export interface RoutineRow {
  name: string;
  notes: string;
  day_names: string[];
  schedule: number[];
  routine_exercises: { day_index: number; position: number; sets: number; reps_target: number; rest_seconds: number; notes: string; exercises: { name: string } | null }[];
}

const WEEKDAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function routinesTable(routines: RoutineRow[]): Table {
  const rows = routines.flatMap((r) =>
    [...r.routine_exercises]
      .sort((a, b) => a.day_index - b.day_index || a.position - b.position)
      .map((e) => [r.name, r.day_names[e.day_index] ?? '', WEEKDAYS[r.schedule[e.day_index] ?? 0] ?? '', e.exercises?.name ?? '', e.sets, e.reps_target, e.rest_seconds, e.notes] as Cell[]),
  );
  return { filename: 'rutinas', headers: ['rutina', 'dia', 'dia_semana', 'ejercicio', 'series', 'repeticiones_objetivo', 'descanso_s', 'notas'], rows };
}

interface Entry {
  meal: string;
  name: string;
  quantity_g: number | null;
  servings: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export function dietTable(logs: (Entry & { log_date: string })[]): Table {
  const rows = [...logs]
    .sort((a, b) => a.log_date.localeCompare(b.log_date))
    .map((l) => [l.log_date, l.meal, l.name, l.quantity_g, l.servings, l.kcal, l.protein_g, l.carbs_g, l.fat_g] as Cell[]);
  return { filename: 'diario', headers: ['fecha', 'comida', 'alimento', 'cantidad_g', 'raciones', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasa_g'], rows };
}

export function waterTable(logs: { log_date: string; ml: number; created_at: string }[]): Table {
  return { filename: 'agua', headers: ['fecha', 'ml'], rows: [...logs].sort((a, b) => a.log_date.localeCompare(b.log_date) || a.created_at.localeCompare(b.created_at)).map((l) => [l.log_date, l.ml] as Cell[]) };
}

export function metricsTable(rows: { measured_on: string; weight_kg: number | null; waist_cm: number | null; hip_cm: number | null; arm_cm: number | null; thigh_cm: number | null }[]): Table {
  return {
    filename: 'medidas',
    headers: ['fecha', 'peso_kg', 'cintura_cm', 'cadera_cm', 'brazo_cm', 'muslo_cm'],
    rows: [...rows].sort((a, b) => a.measured_on.localeCompare(b.measured_on)).map((m) => [m.measured_on, m.weight_kg, m.waist_cm, m.hip_cm, m.arm_cm, m.thigh_cm] as Cell[]),
  };
}

export function foodsTable(rows: { name: string; brand: string; barcode: string | null; source: string; serving_g: number; kcal_100g: number; protein_100g: number; carbs_100g: number; fat_100g: number; allergens: string[] }[]): Table {
  return {
    filename: 'alimentos',
    headers: ['nombre', 'marca', 'codigo_barras', 'origen', 'racion_g', 'kcal_100g', 'proteina_100g', 'carbohidratos_100g', 'grasa_100g', 'alergenos'],
    rows: rows.map((f) => [f.name, f.brand, f.barcode, f.source, f.serving_g, f.kcal_100g, f.protein_100g, f.carbs_100g, f.fat_100g, (f.allergens ?? []).join('; ')] as Cell[]),
  };
}

export function recipesTable(rows: { name: string; servings: number; notes: string; recipe_items: { grams: number; position: number; foods: { name: string } | null }[] }[]): Table {
  return {
    filename: 'recetas',
    headers: ['receta', 'raciones', 'ingrediente', 'gramos', 'notas'],
    rows: rows.flatMap((r) => [...r.recipe_items].sort((a, b) => a.position - b.position).map((i) => [r.name, r.servings, i.foods?.name ?? '', i.grams, r.notes] as Cell[])),
  };
}

export function planTable(rows: (Entry & { weekday: number })[]): Table {
  return {
    filename: 'planificador',
    headers: ['dia_semana', 'comida', 'alimento', 'cantidad_g', 'raciones', 'kcal', 'proteina_g', 'carbohidratos_g', 'grasa_g'],
    rows: [...rows].sort((a, b) => a.weekday - b.weekday).map((p) => [WEEKDAYS[p.weekday] ?? '', p.meal, p.name, p.quantity_g, p.servings, p.kcal, p.protein_g, p.carbs_g, p.fat_g] as Cell[]),
  };
}

export function photosTable(rows: { taken_on: string; storage_path: string; note: string }[]): Table {
  return { filename: 'fotos', headers: ['fecha', 'archivo', 'nota'], rows: rows.map((p) => [p.taken_on, p.storage_path.split('/').pop() ?? '', p.note] as Cell[]) };
}
