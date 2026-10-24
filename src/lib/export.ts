import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { toCsv, type CsvFormat } from './csv';
import {
  dietTable,
  foodsTable,
  metricsTable,
  photosTable,
  planTable,
  profileTable,
  recipesTable,
  routinesTable,
  waterTable,
  workoutsTable,
  type Table,
} from './export-datasets';
import { selectAll } from './progress';
import { supabase } from './supabase';

export const DATASETS = [
  { key: 'perfil', label: 'Perfil y objetivos', hint: 'Tus datos, objetivos diarios y el consentimiento.' },
  { key: 'entrenos', label: 'Entrenos', hint: 'Una fila por serie: fecha, ejercicio, peso, repeticiones y RPE.' },
  { key: 'rutinas', label: 'Rutinas', hint: 'Días, ejercicios, series, repeticiones y descansos.' },
  { key: 'diario', label: 'Diario de comidas', hint: 'Todo lo que has registrado, con sus macros.' },
  { key: 'agua', label: 'Agua', hint: 'Cada registro de agua.' },
  { key: 'medidas', label: 'Peso y perímetros', hint: 'Tus medidas corporales.' },
  { key: 'alimentos', label: 'Mis alimentos', hint: 'Alimentos propios y guardados de Open Food Facts.' },
  { key: 'recetas', label: 'Recetas', hint: 'Recetas con sus ingredientes.' },
  { key: 'planificador', label: 'Planificador semanal', hint: 'Menús planificados.' },
  { key: 'fotos', label: 'Fotos (índice)', hint: 'Fechas y nombres de archivo. Las imágenes no se incluyen en el CSV.' },
] as const;

export type DatasetKey = (typeof DATASETS)[number]['key'];

const all = <T,>(table: string, select: string, order = 'id') =>
  selectAll<T>((from, to) => supabase.from(table).select(select).order(order).range(from, to) as never);

/** Descarga de Supabase los datos de un conjunto (siempre del servidor, nunca de la copia del dispositivo). */
export async function loadTable(key: DatasetKey): Promise<Table> {
  switch (key) {
    case 'perfil': {
      const { data, error } = await supabase.from('profiles').select('*').maybeSingle();
      if (error) throw new Error(error.message);
      return profileTable((data ?? {}) as Record<string, unknown>);
    }
    case 'entrenos': {
      const [sessions, sets] = await Promise.all([
        all<Parameters<typeof workoutsTable>[0][number]>('workout_sessions', 'id, routine_name, started_at, finished_at, plan'),
        all<Parameters<typeof workoutsTable>[1][number]>('workout_sets', 'session_id, position, set_index, weight_kg, reps, rpe, target_reps'),
      ]);
      return workoutsTable(sessions, sets.map((s) => ({ ...s, weight_kg: Number(s.weight_kg), rpe: s.rpe == null ? null : Number(s.rpe) })));
    }
    case 'rutinas':
      return routinesTable(await all('routines', '*, routine_exercises(day_index, position, sets, reps_target, rest_seconds, notes, exercises(name))'));
    case 'diario':
      return dietTable(await all('meal_logs', 'log_date, meal, name, quantity_g, servings, kcal, protein_g, carbs_g, fat_g'));
    case 'agua':
      return waterTable(await all('water_logs', 'log_date, ml, created_at'));
    case 'medidas':
      return metricsTable(await all('body_metrics', 'measured_on, weight_kg, waist_cm, hip_cm, arm_cm, thigh_cm'));
    case 'alimentos':
      return foodsTable(await all('foods', 'name, brand, barcode, source, serving_g, kcal_100g, protein_100g, carbs_100g, fat_100g, allergens'));
    case 'recetas':
      return recipesTable(await all('recipes', 'name, servings, notes, recipe_items(grams, position, foods(name))'));
    case 'planificador':
      return planTable(await all('meal_plan_entries', 'weekday, meal, name, quantity_g, servings, kcal, protein_g, carbs_g, fat_g'));
    case 'fotos':
      return photosTable(await all('progress_photos', 'taken_on, storage_path, note'));
  }
}

/** Guarda el CSV y abre «compartir» (móvil) o lo descarga (web). */
export async function saveAndShare(table: Table, format: CsvFormat): Promise<'shared' | 'downloaded'> {
  const name = `vigor-${table.filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  const csv = toCsv(table.headers, table.rows, format);

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  }

  const file = new File(Paths.cache, name);
  file.create({ overwrite: true });
  file.write(csv);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no permite compartir archivos.');
  await Sharing.shareAsync(file.uri, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text', dialogTitle: 'Exportar datos de Vigor' });
  return 'shared';
}

/** Descarga una foto de progreso (por su URL firmada) y abre «compartir» para guardarla; en web la descarga. */
export async function shareRemoteImage(url: string, filename: string): Promise<void> {
  if (Platform.OS === 'web') {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return;
  }
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  const saved = await File.downloadFileAsync(url, file);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Este dispositivo no permite compartir archivos.');
  await Sharing.shareAsync(saved.uri, { mimeType: 'image/jpeg', UTI: 'public.jpeg', dialogTitle: 'Guardar foto' });
}
