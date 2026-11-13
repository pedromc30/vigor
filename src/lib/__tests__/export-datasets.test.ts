import { dietByDayTable, trainingByDayTable, dietFilesTable, achievementsTable, goalsTable, dietTable, foodsTable, metricsTable, photosTable, planTable, profileTable, recipesTable, routinesTable, waterTable, workoutsTable } from '../export-datasets';

describe('workoutsTable', () => {
  const sessions = [
    { id: 's2', routine_name: 'B', started_at: '2026-10-20T10:00:00Z', finished_at: null, plan: [{ name: 'Sentadilla', muscle_group: 'cuadriceps' }] },
    { id: 's1', routine_name: 'A', started_at: '2026-10-10T09:00:00Z', finished_at: '2026-10-10T10:00:00Z', plan: [{ name: 'Press', muscle_group: 'pecho' }, { name: 'Remo', muscle_group: 'espalda' }] },
  ];
  const sets = [
    { session_id: 's2', position: 0, set_index: 0, weight_kg: 100, reps: 5, rpe: 8, target_reps: 5 },
    { session_id: 's1', position: 1, set_index: 1, weight_kg: 50, reps: 10, rpe: null, target_reps: 10 },
    { session_id: 's1', position: 0, set_index: 0, weight_kg: 60, reps: 8, rpe: null, target_reps: 8 },
  ];
  it('una fila por serie, ordenada por fecha, ejercicio y serie, con el nombre del plan de esa sesión', () => {
    const t = workoutsTable(sessions, sets);
    expect(t.headers).toHaveLength(t.rows[0].length);
    expect(t.rows.map((r) => [r[0], r[2], r[4], r[5]])).toEqual([
      ['2026-10-10', 'Press', 1, 60],
      ['2026-10-10', 'Remo', 1, 50], // «serie» es el orden dentro del ejercicio de esa sesión
      ['2026-10-20', 'Sentadilla', 1, 100],
    ]);
    expect(t.rows.map((r) => r[9])).toEqual(['sí', 'sí', 'no']);
    expect(t.rows.map((r) => r[10])).toEqual(['normal', 'normal', 'normal']);
  });

  it('tipo de serie, orden en pantalla y ejercicios reordenados (slot)', () => {
    const sess = [
      // Sentadilla se hizo primero en pantalla (slot 1) y Press después (slot 0)
      { id: 's', routine_name: 'R', started_at: '2026-10-10T09:00:00Z', finished_at: null, plan: [{ name: 'Sentadilla', muscle_group: 'cuadriceps', slot: 1 }, { name: 'Press', muscle_group: 'pecho', slot: 0 }] },
    ];
    const st = [
      { session_id: 's', position: 0, set_index: 0, weight_kg: 60, reps: 8, rpe: null, target_reps: 8, set_type: 'normal', sort_order: 1 },
      { session_id: 's', position: 0, set_index: 1, weight_kg: 30, reps: 10, rpe: null, target_reps: 8, set_type: 'warmup', sort_order: 0 },
      { session_id: 's', position: 1, set_index: 0, weight_kg: 100, reps: 5, rpe: 8, target_reps: 5, set_type: 'dropset', sort_order: 0 },
    ];
    const t = workoutsTable(sess, st);
    expect(t.rows.map((r) => [r[2], r[4], r[5], r[10]])).toEqual([
      ['Sentadilla', 1, 100, 'dropset'],
      ['Press', 1, 30, 'aproximacion'],
      ['Press', 2, 60, 'normal'],
    ]);
  });
  it('tolera series cuya sesión o ejercicio ya no existe', () => {
    const t = workoutsTable([], [sets[0]]);
    expect(t.rows[0].slice(0, 4)).toEqual(['', '', '', '']);
  });
});

describe('otras tablas', () => {
  it('perfil: alergias unidas y mismas columnas que cabeceras', () => {
    const t = profileTable({ sex: 'male', allergies: ['gluten', 'huevo'], target_kcal: 2500 });
    expect(t.rows[0]).toHaveLength(t.headers.length);
    expect(t.rows[0][t.headers.indexOf('alergias')]).toBe('gluten; huevo');
  });
  it('rutinas: día de la semana en texto', () => {
    const t = routinesTable([{ name: 'R', notes: '', day_names: ['D1'], schedule: [3], routine_exercises: [{ day_index: 0, position: 0, sets: 3, reps_target: 8, rest_seconds: 90, notes: '', exercises: { name: 'Press' } }] }]);
    expect(t.rows[0]).toEqual(['R', 'D1', 'miércoles', 'Press', 3, 8, 90, '', 8, 8]);
    const r = routinesTable([{ name: 'R', notes: '', day_names: ['D1'], schedule: [3], routine_exercises: [{ day_index: 0, position: 0, sets: 3, reps_target: 8, reps_min: 6, reps_max: 8, rest_seconds: 90, notes: '', exercises: { name: 'Press' } }] }]);
    expect(r.rows[0].slice(-2)).toEqual([6, 8]);
  });
  it('diario, agua, medidas, alimentos, recetas, plan y fotos: columnas coherentes', () => {
    const entry = { meal: 'comida', name: 'Arroz', quantity_g: 100, servings: null, kcal: 130, protein_g: 3, carbs_g: 28, fat_g: 0.3 };
    const tables = [
      dietTable([{ ...entry, log_date: '2026-10-24' }]),
      waterTable([{ log_date: '2026-10-24', ml: 250, created_at: '2026-10-24T10:00:00Z' }]),
      metricsTable([{ measured_on: '2026-10-24', weight_kg: 80, waist_cm: null, hip_cm: null, arm_cm: null, thigh_cm: null }]),
      foodsTable([{ name: 'Arroz', brand: '', barcode: null, source: 'custom', serving_g: 100, kcal_100g: 130, protein_100g: 3, carbs_100g: 28, fat_100g: 0.3, allergens: [] }]),
      recipesTable([{ name: 'Receta', servings: 2, notes: 'n', recipe_items: [{ grams: 200, position: 0, foods: { name: 'Arroz' } }] }]),
      planTable([{ ...entry, weekday: 1 }]),
      photosTable([{ taken_on: '2026-10-24', storage_path: 'uid/2026-10-24-1.jpg', note: '' }]),
    ];
    for (const t of tables) {
      expect(t.rows.length).toBeGreaterThan(0);
      for (const r of t.rows) expect(r).toHaveLength(t.headers.length);
    }
    expect(tables[6].rows[0][1]).toBe('2026-10-24-1.jpg'); // no se exporta el id del usuario de la ruta
    expect(tables[5].rows[0][0]).toBe('lunes');
  });
  it('objetivos y logros: tipos legibles y columnas coherentes', () => {
    const g = goalsTable([
      { kind: 'reps', target_weight_kg: 0, target_reps: 12, achieved_at: null, created_at: '2026-10-02T10:00:00Z', exercises: { name: 'Dominadas' } },
      { kind: 'weight', target_weight_kg: 100, target_reps: 1, achieved_at: '2026-10-20T10:00:00Z', created_at: '2026-10-01T10:00:00Z', exercises: { name: 'Sentadilla' } },
    ]);
    expect(g.rows.map((r) => [r[0], r[1], r[2], r[3], r[4], r[5]])).toEqual([
      ['Sentadilla', 'peso', 100, 1, '2026-10-01', '2026-10-20'],
      ['Dominadas', 'repeticiones', 0, 12, '2026-10-02', ''],
    ]);
    const a = achievementsTable([
      { kind: 'pr_1rm', value: 120.3, weight_kg: 95, reps: 8, achieved_at: '2026-10-12T10:00:00Z', exercises: { name: 'Press' } },
      { kind: 'goal', value: 100, weight_kg: 100, reps: 1, achieved_at: '2026-10-10T10:00:00Z', exercises: null },
    ]);
    expect(a.rows.map((r) => [r[0], r[1], r[2]])).toEqual([['2026-10-10', '', 'objetivo_conseguido'], ['2026-10-12', 'Press', 'record_1rm']]);
    for (const t of [g, a]) for (const r of t.rows) expect(r).toHaveLength(t.headers.length);
  });
  it('archivos de dieta: índice con nombre, tipo y tamaño', () => {
    const t = dietFilesTable([
      { name: 'b.pdf', mime_type: 'application/pdf', size_bytes: 200, created_at: '2026-11-02T10:00:00Z' },
      { name: 'a.xlsx', mime_type: 'application/vnd.ms-excel', size_bytes: 100, created_at: '2026-11-01T10:00:00Z' },
    ]);
    expect(t.rows.map((r) => [r[0], r[1], r[3]])).toEqual([['2026-11-01', 'a.xlsx', 100], ['2026-11-02', 'b.pdf', 200]]);
    expect(t.rows[0]).toHaveLength(t.headers.length);
  });
  it('ordena el diario por fecha', () => {
    const e = { meal: 'comida', name: 'x', quantity_g: 1, servings: null, kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 };
    const t = dietTable([{ ...e, log_date: '2026-10-25' }, { ...e, log_date: '2026-10-24' }]);
    expect(t.rows.map((r) => r[0])).toEqual(['2026-10-24', '2026-10-25']);
  });
});

describe('dietByDayTable (fechas arriba)', () => {
  const m = (log_date: string, meal: string, kcal: number, p = 10, c = 20, f = 5) => ({ log_date, meal, kcal, protein_g: p, carbs_g: c, fat_g: f });
  const t = dietByDayTable({
    diet: [m('2026-11-09', 'desayuno', 400.4), m('2026-11-09', 'comida', 700), m('2026-11-07', 'snacks', 150)],
    water: [{ log_date: '2026-11-09', ml: 250 }, { log_date: '2026-11-09', ml: 500 }],
  });
  const row = (label: string) => t.rows.find((r) => r[0] === label)!;

  it('las fechas van arriba, ordenadas, y cada dato en su fila', () => {
    expect(t.headers).toEqual(['dato', '2026-11-07', '2026-11-09']);
    expect(t.rows.every((r) => r.length === t.headers.length)).toBe(true);
    expect(t.rows.map((r) => r[0])).toEqual(['Calorías (kcal)', 'Proteína (g)', 'Hidratos (g)', 'Grasa (g)', 'Desayuno (kcal)', 'Media mañana (kcal)', 'Comida (kcal)', 'Merienda (kcal)', 'Cena (kcal)', 'Agua (ml)']);
  });
  it('suma por día y por comida, y deja en blanco lo que falta', () => {
    expect(row('Calorías (kcal)')).toEqual(['Calorías (kcal)', 150, 1100]);
    expect(row('Proteína (g)')).toEqual(['Proteína (g)', 10, 20]);
    expect(row('Desayuno (kcal)')).toEqual(['Desayuno (kcal)', '', 400]);
    expect(row('Media mañana (kcal)')).toEqual(['Media mañana (kcal)', 150, '']);
    expect(row('Cena (kcal)')).toEqual(['Cena (kcal)', '', '']);
    expect(row('Agua (ml)')).toEqual(['Agua (ml)', '', 750]);
  });
  it('sin datos no hay filas', () => {
    expect(dietByDayTable({ diet: [], water: [] }).rows).toEqual([]);
  });
});

describe('trainingByDayTable (fechas arriba)', () => {
  const plan = [
    { name: 'Press banca', muscle_group: 'pecho' },
    { name: 'Remo', muscle_group: 'espalda' },
  ];
  const sess = (id: string, routine_name: string, started_at: string) => ({ id, routine_name, started_at, finished_at: null, plan });
  const set = (session_id: string, position: number, set_index: number, weight_kg: number, reps: number, set_type = 'normal') => ({ session_id, position, set_index, weight_kg, reps, rpe: null, target_reps: null, set_type });
  const t = trainingByDayTable({
    sessions: [sess('s1', 'Fuerza A', '2026-11-09T10:00:00Z'), sess('s2', 'Fuerza B', '2026-11-09T18:00:00Z'), sess('s0', 'Fuerza A', '2026-11-07T10:00:00Z')],
    sets: [
      set('s1', 1, 0, 60, 10),
      set('s1', 0, 0, 40, 5, 'warmup'), // no cuenta ni se lista
      set('s1', 0, 1, 80, 8),
      set('s1', 0, 2, 82.5, 6),
      set('s2', 0, 0, 70, 8),
      set('s0', 0, 0, 75, 8),
    ],
  });
  const row = (label: string) => t.rows.find((r) => r[0] === label)!;

  it('fechas arriba y filas: rutina, series, volumen y un ejercicio por fila', () => {
    expect(t.headers).toEqual(['dato', '2026-11-07', '2026-11-09']);
    expect(t.rows.map((r) => r[0])).toEqual(['Rutina', 'Series', 'Volumen (kg)', 'Press banca', 'Remo']);
  });
  it('rutinas, series (sin aproximación) y volumen del día', () => {
    expect(row('Rutina')).toEqual(['Rutina', 'Fuerza A', 'Fuerza A + Fuerza B']);
    expect(row('Series')).toEqual(['Series', 1, 4]);
    expect(row('Volumen (kg)')).toEqual(['Volumen (kg)', 600, 640 + 495 + 600 + 560]);
  });
  it('series de cada ejercicio con coma decimal; dos sesiones del mismo día se separan con «|»', () => {
    expect(row('Press banca')).toEqual(['Press banca', '75×8', '80×8 · 82,5×6 | 70×8']);
    expect(row('Remo')).toEqual(['Remo', '', '60×10']);
  });
  it('sin datos no hay filas', () => {
    expect(trainingByDayTable({ sessions: [], sets: [] }).rows).toEqual([]);
  });
});
