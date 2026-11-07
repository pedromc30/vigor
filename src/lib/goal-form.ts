// Validación del formulario de objetivos por ejercicio. Funciones puras.
import type { GoalKind } from './achievements';
import { parseDecimal } from './validation';

export interface GoalForm {
  kind: GoalKind;
  /** Carga en kg. En objetivos de repeticiones puede quedar vacía o en 0: peso corporal. */
  weight: string;
  reps: string;
}

export interface GoalValues {
  kind: GoalKind;
  target_weight_kg: number;
  target_reps: number;
}

/** Convierte el formulario en un objetivo válido, o devuelve el mensaje de error. */
export function parseGoalForm(f: GoalForm): { values: GoalValues } | { error: string } {
  const reps = parseDecimal(f.reps);
  if (reps === null || !Number.isInteger(reps) || reps < 1 || reps > 200) {
    return { error: 'Las repeticiones deben ser un número entero entre 1 y 200.' };
  }
  if (f.kind === 'weight') {
    const w = parseDecimal(f.weight);
    if (w === null || w <= 0 || w > 1000) return { error: 'Introduce la carga del objetivo en kg (entre 0,5 y 1000).' };
    return { values: { kind: 'weight', target_weight_kg: w, target_reps: reps } };
  }
  const raw = f.weight.trim();
  const w = raw === '' ? 0 : parseDecimal(raw);
  if (w === null || w < 0 || w > 1000) return { error: 'La carga debe ser un número entre 0 y 1000 kg (0 o vacío es peso corporal).' };
  return { values: { kind: 'reps', target_weight_kg: w, target_reps: reps } };
}
