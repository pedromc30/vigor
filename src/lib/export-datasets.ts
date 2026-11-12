// Conversión de los datos del usuario a tablas (cabeceras + filas) para exportarlos a CSV.
import type { Cell } from './csv';
import { effectiveOrder, itemForPosition } from './plan';

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
    headers: ['sexo', 'edad', 'altura_cm', 'peso_kg', 'grasa_corporal_pct', 'nivel_actividad', 'objetivo', 'dias_entreno_semana', 'dieta', 'alergias', 'objetivo_kcal', 'objetivo_proteina_g', 'objetivo_grasa_g', 'objetivo_carbohidratos_g', 'objetivos_por_dia', 'objetivo_agua_ml', 'objetivos_editados_a_mano', 'consentimiento_fecha', 'consentimiento_version'],
    rows: [[p.sex, p.age, p.height_cm, p.weight_kg, p.body_fat_pct, p.activity_level, p.goal, p.training_days_per_week, p.diet_preference, list(p.allergies), p.target_kcal, p.target_protein_g, p.target_fat_g, p.target_carbs_g, p.day_targets ? JSON.stringify(p.day_targets) : '', p.water_goal_ml, p.targets_manual, p.health_consent_at, p.consent_version] as Cell[]],
  };
}

export interface SessionRow {
  id: string;
  routine_name: string;
  started_at: string;
  finished_at: string | null;
  plan: { name: string; muscle_group: string; slot?: number }[];
}
export interface SetRow {
  session_id: string;
  position: number;
  set_index: number;
  weight_kg: number;
  reps: number;
  rpe: number | null;
  target_reps: number | null;
  set_type?: string;
  sort_order?: number | null;
}

const SET_TYPE_LABELS: Record<string, string> = { normal: 'normal', warmup: 'aproximacion', dropset: 'dropset' };

export function workoutsTable(sessions: SessionRow[], sets: SetRow[]): Table {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const planIndex = (s: SetRow) => {
    const plan = byId.get(s.session_id)?.plan ?? [];
    const i = plan.findIndex((p, k) => (p.slot ?? k) === s.position);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  // Orden: sesión (fecha), ejercicio (orden del plan de esa sesión) y serie (orden en pantalla).
  const sorted = [...sets].sort(
    (a, b) =>
      (byId.get(a.session_id)?.started_at ?? '').localeCompare(byId.get(b.session_id)?.started_at ?? '') ||
      a.session_id.localeCompare(b.session_id) ||
      planIndex(a) - planIndex(b) ||
      a.position - b.position ||
      effectiveOrder(a) - effectiveOrder(b) ||
      a.set_index - b.set_index,
  );
  const counter = new Map<string, number>();
  const rows = sorted.map((s) => {
    const session = byId.get(s.session_id);
    const ex = session?.plan ? itemForPosition(session.plan, s.position) : undefined;
    const key = `${s.session_id}|${s.position}`;
    const n = (counter.get(key) ?? 0) + 1;
    counter.set(key, n);
    return [date(session?.started_at), session?.routine_name ?? '', ex?.name ?? '', ex?.muscle_group ?? '', n, s.weight_kg, s.reps, s.rpe, s.target_reps, session?.finished_at ? 'sí' : 'no', SET_TYPE_LABELS[s.set_type ?? 'normal'] ?? 'normal'] as Cell[];
  });
  return { filename: 'entrenos', headers: ['fecha', 'sesion', 'ejercicio', 'grupo_muscular', 'serie', 'peso_kg', 'repeticiones', 'rpe', 'repeticiones_objetivo', 'sesion_terminada', 'tipo_serie'], rows };
}

export interface RoutineRow {
  name: string;
  notes: string;
  day_names: string[];
  schedule: number[];
  routine_exercises: { day_index: number; position: number; sets: number; reps_target: number; reps_min?: number; reps_max?: number; rest_seconds: number; notes: string; exercises: { name: string } | null }[];
}

const WEEKDAYS = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

export function routinesTable(routines: RoutineRow[]): Table {
  const rows = routines.flatMap((r) =>
    [...r.routine_exercises]
      .sort((a, b) => a.day_index - b.day_index || a.position - b.position)
      .map((e) => [r.name, r.day_names[e.day_index] ?? '', WEEKDAYS[r.schedule[e.day_index] ?? 0] ?? '', e.exercises?.name ?? '', e.sets, e.reps_target, e.rest_seconds, e.notes, e.reps_min ?? e.reps_target, e.reps_max ?? e.reps_target] as Cell[]),
  );
  return { filename: 'rutinas', headers: ['rutina', 'dia', 'dia_semana', 'ejercicio', 'series', 'repeticiones_objetivo', 'descanso_s', 'notas', 'repeticiones_min', 'repeticiones_max'], rows };
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

const PR_NAMES: Record<string, string> = { goal: 'objetivo_conseguido', pr_weight: 'record_peso', pr_reps: 'record_repeticiones', pr_1rm: 'record_1rm' };

export function goalsTable(rows: { kind: string; target_weight_kg: number; target_reps: number; achieved_at: string | null; created_at: string; exercises: { name: string } | null }[]): Table {
  return {
    filename: 'objetivos',
    headers: ['ejercicio', 'tipo', 'peso_objetivo_kg', 'repeticiones_objetivo', 'creado', 'conseguido'],
    rows: [...rows]
      .sort((a, b) => a.created_at.localeCompare(b.created_at))
      .map((g) => [g.exercises?.name ?? '', g.kind === 'weight' ? 'peso' : 'repeticiones', Number(g.target_weight_kg), g.target_reps, date(g.created_at), date(g.achieved_at)] as Cell[]),
  };
}

export function achievementsTable(rows: { kind: string; value: number; weight_kg: number; reps: number; achieved_at: string; exercises: { name: string } | null }[]): Table {
  return {
    filename: 'logros',
    headers: ['fecha', 'ejercicio', 'tipo', 'valor', 'peso_kg', 'repeticiones'],
    rows: [...rows]
      .sort((a, b) => a.achieved_at.localeCompare(b.achieved_at))
      .map((a) => [date(a.achieved_at), a.exercises?.name ?? '', PR_NAMES[a.kind] ?? a.kind, Number(a.value), Number(a.weight_kg), a.reps] as Cell[]),
  };
}

export function dietFilesTable(rows: { name: string; mime_type: string; size_bytes: number; created_at: string }[]): Table {
  return {
    filename: 'archivos_dieta',
    headers: ['fecha', 'nombre', 'tipo', 'tamano_bytes'],
    rows: [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at)).map((f) => [date(f.created_at), f.name, f.mime_type, f.size_bytes] as Cell[]),
  };
}

// ---------- Resumen por días (fechas arriba) ----------

export interface DailySummaryInput {
  diet: { log_date: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }[];
  water: { log_date: string; ml: number }[];
  metrics: { measured_on: string; weight_kg: number | null; waist_cm: number | null; hip_cm: number | null; arm_cm: number | null; thigh_cm: number | null }[];
  sessions: { id: string; routine_name: string; started_at: string }[];
  sets: { session_id: string; weight_kg: number; reps: number; set_type?: string }[];
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/**
 * Tabla «en horizontal»: una columna por día (las fechas arriba, de la más antigua a la más reciente) y una fila por dato
 * (calorías, macros, agua, peso, perímetros, entreno, series y volumen). Crece hacia abajo al añadir datos y hacia la
 * derecha al pasar los días. Un día sin dato en una fila queda en blanco. Las series de aproximación no cuentan.
 */
export function dailySummaryTable(input: DailySummaryInput): Table {
  const days = new Map<string, Record<string, number | string>>();
  const at = (d: string) => {
    let v = days.get(d);
    if (!v) days.set(d, (v = {}));
    return v;
  };
  const add = (d: string, key: string, n: number) => {
    const v = at(d);
    v[key] = ((v[key] as number | undefined) ?? 0) + n;
  };
  for (const l of input.diet) {
    add(l.log_date, 'kcal', l.kcal);
    add(l.log_date, 'protein', l.protein_g);
    add(l.log_date, 'carbs', l.carbs_g);
    add(l.log_date, 'fat', l.fat_g);
  }
  for (const w of input.water) add(w.log_date, 'water', w.ml);
  for (const m of input.metrics) {
    const v = at(m.measured_on);
    if (m.weight_kg != null) v.weight = m.weight_kg;
    if (m.waist_cm != null) v.waist = m.waist_cm;
    if (m.hip_cm != null) v.hip = m.hip_cm;
    if (m.arm_cm != null) v.arm = m.arm_cm;
    if (m.thigh_cm != null) v.thigh = m.thigh_cm;
  }
  const sessionDay = new Map(input.sessions.map((s) => [s.id, date(s.started_at)]));
  for (const s of input.sessions) {
    const d = date(s.started_at);
    const names = new Set(String(at(d).workout ?? '').split(' + ').filter(Boolean));
    names.add(s.routine_name);
    at(d).workout = [...names].join(' + ');
  }
  for (const set of input.sets) {
    const d = sessionDay.get(set.session_id);
    if (!d || set.set_type === 'warmup') continue;
    add(d, 'sets', 1);
    add(d, 'volume', set.weight_kg * set.reps);
  }

  const dates = [...days.keys()].filter(Boolean).sort();
  if (!dates.length) return { filename: 'resumen-por-dias', headers: ['dato'], rows: [] };
  const row = (label: string, key: string, f: (n: number) => number = (n) => round(n)): Cell[] => [
    label,
    ...dates.map((d) => {
      const v = days.get(d)?.[key];
      return v === undefined ? '' : typeof v === 'number' ? f(v) : v;
    }),
  ];
  return {
    filename: 'resumen-por-dias',
    headers: ['dato', ...dates],
    rows: [
      row('Calorías (kcal)', 'kcal', (n) => round(n, 0)),
      row('Proteína (g)', 'protein'),
      row('Hidratos (g)', 'carbs'),
      row('Grasa (g)', 'fat'),
      row('Agua (ml)', 'water', (n) => round(n, 0)),
      row('Peso (kg)', 'weight'),
      row('Cintura (cm)', 'waist'),
      row('Cadera (cm)', 'hip'),
      row('Brazo (cm)', 'arm'),
      row('Muslo (cm)', 'thigh'),
      row('Entreno', 'workout'),
      row('Series', 'sets', (n) => n),
      row('Volumen (kg)', 'volume', (n) => round(n, 0)),
    ],
  };
}
