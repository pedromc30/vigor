import type { Exercise, RoutineInput } from './training';

/** Repeticiones objetivo: un número fijo (3 × 8) o un rango (3 × 6–8). */
export type RepsMode = 'fixed' | 'range';

export interface DraftItem {
  key: string;
  exercise: Pick<Exercise, 'id' | 'name' | 'muscle_group'>;
  sets: string;
  repsMode: RepsMode;
  /** Repeticiones fijas (modo fijo). */
  reps: string;
  /** Límites del rango (modo rango). */
  repsMin: string;
  repsMax: string;
  rest: string;
  notes: string;
}

/** Campos de repeticiones de un borrador a partir de lo guardado: mínimo = máximo es el modo fijo. */
export function repsFields(min: number, max: number): Pick<DraftItem, 'repsMode' | 'reps' | 'repsMin' | 'repsMax'> {
  return { repsMode: min === max ? 'fixed' : 'range', reps: String(max), repsMin: String(min), repsMax: String(max) };
}

/** Campos por defecto de un ejercicio recién añadido: 10 repeticiones fijas. */
export const DEFAULT_REPS_FIELDS = repsFields(10, 10);

export interface DraftDay {
  name: string;
  weekday: number; // 0 = sin día fijo, 1..7 = lunes..domingo
  items: DraftItem[];
}

export interface RoutineDraft {
  id: string | null;
  name: string;
  notes: string;
  days: DraftDay[];
}

const intIn = (text: string, min: number, max: number): number | null => {
  const t = text.trim();
  if (!/^\d+$/.test(t)) return null;
  const n = Number(t);
  return n >= min && n <= max ? n : null;
};

/** Devuelve un mensaje de error o null si el borrador es válido. */
export function validateDraft(d: RoutineDraft): string | null {
  const name = d.name.trim();
  if (name.length < 2 || name.length > 60) return 'El nombre de la rutina debe tener entre 2 y 60 caracteres.';
  if (d.days.length < 1 || d.days.length > 7) return 'La rutina debe tener entre 1 y 7 días.';
  for (const [i, day] of d.days.entries()) {
    if (!day.name.trim()) return `Pon nombre al día ${i + 1}.`;
    if (!day.items.length) return `El día «${day.name.trim()}» no tiene ejercicios.`;
    for (const it of day.items) {
      const label = `${it.exercise.name} (${day.name.trim()})`;
      if (intIn(it.sets, 1, 20) === null) return `Series de ${label}: introduce un número entre 1 y 20.`;
      if (it.repsMode === 'range') {
        const min = intIn(it.repsMin, 1, 100);
        const max = intIn(it.repsMax, 1, 100);
        if (min === null || max === null) return `Rango de repeticiones de ${label}: el mínimo y el máximo deben ser números entre 1 y 100.`;
        if (min > max) return `Rango de repeticiones de ${label}: el mínimo no puede ser mayor que el máximo.`;
      } else if (intIn(it.reps, 1, 100) === null) {
        return `Repeticiones de ${label}: introduce un número entre 1 y 100.`;
      }
      if (intIn(it.rest, 0, 900) === null) return `Descanso de ${label}: introduce segundos entre 0 y 900.`;
    }
  }
  return null;
}

/** Convierte un borrador ya validado en la entrada de `save_routine`. */
export function draftToInput(d: RoutineDraft): RoutineInput {
  return {
    id: d.id,
    name: d.name.trim(),
    notes: d.notes.trim(),
    dayNames: d.days.map((day) => day.name.trim()),
    schedule: d.days.map((day) => day.weekday),
    items: d.days.flatMap((day, dayIndex) =>
      day.items.map((it, position) => {
        const min = it.repsMode === 'range' ? Number(it.repsMin) : Number(it.reps);
        const max = it.repsMode === 'range' ? Number(it.repsMax) : Number(it.reps);
        return {
          exercise_id: it.exercise.id,
          day_index: dayIndex,
          position,
          sets: Number(it.sets),
          reps_target: max, // se conserva como el máximo (lo usan la versión anterior y las exportaciones)
          reps_min: min,
          reps_max: max,
          rest_seconds: Number(it.rest),
          notes: it.notes.trim(),
        };
      }),
    ),
  };
}
