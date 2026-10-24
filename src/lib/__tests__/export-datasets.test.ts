import { dietTable, foodsTable, metricsTable, photosTable, planTable, profileTable, recipesTable, routinesTable, waterTable, workoutsTable } from '../export-datasets';

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
      ['2026-10-10', 'Remo', 2, 50],
      ['2026-10-20', 'Sentadilla', 1, 100],
    ]);
    expect(t.rows.map((r) => r[9])).toEqual(['sí', 'sí', 'no']);
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
    expect(t.rows[0]).toEqual(['R', 'D1', 'miércoles', 'Press', 3, 8, 90, '']);
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
  it('ordena el diario por fecha', () => {
    const e = { meal: 'comida', name: 'x', quantity_g: 1, servings: null, kcal: 1, protein_g: 1, carbs_g: 1, fat_g: 1 };
    const t = dietTable([{ ...e, log_date: '2026-10-25' }, { ...e, log_date: '2026-10-24' }]);
    expect(t.rows.map((r) => r[0])).toEqual(['2026-10-24', '2026-10-25']);
  });
});
