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

// ---------- Dieta y entrenos por días (fechas arriba) ----------

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
/** Número con coma decimal, para los textos de las celdas (las cifras sueltas van como número). */
const es = (n: number) => String(round(n, 2)).replace('.', ',');

/** Tabla «en horizontal»: la primera columna son los nombres de las filas y hay una columna por día, de la más antigua a la más reciente. */
function dayGrid(filename: string, days: Map<string, Record<string, number | string>>, rows: { label: string; key: string; fmt?: (n: number) => number }[]): Table {
  const dates = [...days.keys()].filter(Boolean).sort();
  if (!dates.length) return { filename, headers: ['dato'], rows: [] };
  return {
    filename,
    headers: ['dato', ...dates],
    rows: rows.map(({ label, key, fmt = (n) => round(n) }) => [
      label,
      ...dates.map((d) => {
        const v = days.get(d)?.[key];
        return v === undefined ? '' : typeof v === 'number' ? fmt(v) : v;
      }),
    ]),
  };
}

const dayOf = (days: Map<string, Record<string, number | string>>, d: string) => {
  let v = days.get(d);
  if (!v) days.set(d, (v = {}));
  return v;
};
const addTo = (days: Map<string, Record<string, number | string>>, d: string, key: string, n: number) => {
  const v = dayOf(days, d);
  v[key] = ((v[key] as number | undefined) ?? 0) + n;
};

export interface DietByDayInput {
  diet: { log_date: string; meal: string; kcal: number; protein_g: number; carbs_g: number; fat_g: number }[];
  water: { log_date: string; ml: number }[];
}

const DIET_MEALS: [string, string][] = [
  ['desayuno', 'Desayuno (kcal)'],
  ['snacks', 'Media mañana (kcal)'],
  ['comida', 'Comida (kcal)'],
  ['merienda', 'Merienda (kcal)'],
  ['cena', 'Cena (kcal)'],
];

/** Dieta por días: calorías y macros del día, calorías de cada comida y agua. Un día sin dato queda en blanco. */
export function dietByDayTable(input: DietByDayInput): Table {
  const days = new Map<string, Record<string, number | string>>();
  for (const l of input.diet) {
    addTo(days, l.log_date, 'kcal', l.kcal);
    addTo(days, l.log_date, 'protein', l.protein_g);
    addTo(days, l.log_date, 'carbs', l.carbs_g);
    addTo(days, l.log_date, 'fat', l.fat_g);
    addTo(days, l.log_date, `meal:${l.meal}`, l.kcal);
  }
  for (const w of input.water) addTo(days, w.log_date, 'water', w.ml);
  return dayGrid('dieta', days, [
    { label: 'Calorías (kcal)', key: 'kcal', fmt: (n) => round(n, 0) },
    { label: 'Proteína (g)', key: 'protein' },
    { label: 'Hidratos (g)', key: 'carbs' },
    { label: 'Grasa (g)', key: 'fat' },
    ...DIET_MEALS.map(([k, label]) => ({ label, key: `meal:${k}`, fmt: (n: number) => round(n, 0) })),
    { label: 'Agua (ml)', key: 'water', fmt: (n) => round(n, 0) },
  ]);
}

export interface TrainingByDayInput {
  sessions: SessionRow[];
  sets: SetRow[];
}

/**
 * Entrenos por días: rutina, series y volumen del día y, debajo, una fila por ejercicio con sus series («80×8 · 80×8»).
 * Las series de aproximación no cuentan ni se listan. Si un ejercicio se hizo en dos sesiones el mismo día, van separadas por « | ».
 */
export function trainingByDayTable(input: TrainingByDayInput): Table {
  const days = new Map<string, Record<string, number | string>>();
  const sessionsById = new Map(input.sessions.map((x) => [x.id, x]));
  for (const x of [...input.sessions].sort((a, b) => a.started_at.localeCompare(b.started_at))) {
    const v = dayOf(days, date(x.started_at));
    const names = String(v.workout ?? '').split(' + ').filter(Boolean);
    if (!names.includes(x.routine_name)) names.push(x.routine_name);
    v.workout = names.join(' + ');
  }
  const planIndex = (st: SetRow) => {
    const i = (sessionsById.get(st.session_id)?.plan ?? []).findIndex((p, k) => (p.slot ?? k) === st.position);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const sorted = [...input.sets].sort(
    (a, b) =>
      (sessionsById.get(a.session_id)?.started_at ?? '').localeCompare(sessionsById.get(b.session_id)?.started_at ?? '') ||
      a.session_id.localeCompare(b.session_id) ||
      planIndex(a) - planIndex(b) ||
      a.position - b.position ||
      effectiveOrder(a) - effectiveOrder(b) ||
      a.set_index - b.set_index,
  );
  const exercises = new Map<string, string>(); // clave en minúsculas → nombre, en orden de aparición
  const text = new Map<string, Map<string, string[]>>(); // `fecha|ejercicio` → sesión → series
  for (const st of sorted) {
    const session = sessionsById.get(st.session_id);
    if (!session || st.set_type === 'warmup') continue;
    const d = date(session.started_at);
    addTo(days, d, 'sets', 1);
    addTo(days, d, 'volume', st.weight_kg * st.reps);
    const name = itemForPosition(session.plan ?? [], st.position)?.name ?? `Ejercicio ${st.position + 1}`;
    const key = name.toLowerCase();
    if (!exercises.has(key)) exercises.set(key, name);
    const cell = `${d}|${key}`;
    const bySession = text.get(cell) ?? new Map<string, string[]>();
    bySession.set(st.session_id, [...(bySession.get(st.session_id) ?? []), `${es(st.weight_kg)}×${st.reps}`]);
    text.set(cell, bySession);
  }
  for (const [cell, bySession] of text) {
    const sep = cell.indexOf('|');
    dayOf(days, cell.slice(0, sep))[`ex:${cell.slice(sep + 1)}`] = [...bySession.values()].map((l) => l.join(' · ')).join(' | ');
  }
  return dayGrid('entrenos', days, [
    { label: 'Rutina', key: 'workout' },
    { label: 'Series', key: 'sets', fmt: (n) => n },
    { label: 'Volumen (kg)', key: 'volume', fmt: (n) => round(n, 0) },
    ...[...exercises].map(([key, label]) => ({ label, key: `ex:${key}` })),
  ]);
}
