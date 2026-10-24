import type { Exercise, RoutineInput } from './training';

export interface DraftItem {
  key: string;
  exercise: Pick<Exercise, 'id' | 'name' | 'muscle_group'>;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
}

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
      if (intIn(it.reps, 1, 100) === null) return `Repeticiones de ${label}: introduce un número entre 1 y 100.`;
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
      day.items.map((it, position) => ({
        exercise_id: it.exercise.id,
        day_index: dayIndex,
        position,
        sets: Number(it.sets),
        reps_target: Number(it.reps),
        rest_seconds: Number(it.rest),
        notes: it.notes.trim(),
      })),
    ),
  };
}
