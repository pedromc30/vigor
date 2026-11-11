// Orden de la línea del día en «Hoy»: las comidas van siempre en su orden y el entreno se coloca donde elija el usuario.
import { MEALS, type Meal } from './diet-math';

/** Dónde va el entreno: al principio del día o justo después de una comida. */
export type TrainingSlot = 'start' | Meal;

export const DEFAULT_TRAINING_SLOT: TrainingSlot = 'merienda';
export const TRAINING_SLOT_KEY = 'vigor.trainingSlot';

export type DayEvent = { kind: 'meal'; meal: Meal } | { kind: 'training' };

export const isTrainingSlot = (v: unknown): v is TrainingSlot => v === 'start' || (typeof v === 'string' && (MEALS as readonly string[]).includes(v));

const SLOT_LABELS: Record<TrainingSlot, string> = {
  start: 'Antes del desayuno',
  desayuno: 'Después del desayuno',
  snacks: 'Después de la media mañana',
  comida: 'Después de la comida',
  merienda: 'Después de la merienda',
  cena: 'Después de la cena (al final)',
};

/** «Antes del desayuno», «Después de la comida»… */
export const slotLabel = (slot: TrainingSlot): string => SLOT_LABELS[slot];

export const TRAINING_SLOTS: TrainingSlot[] = ['start', ...MEALS];

/** Las comidas en su orden con el entreno colocado en su sitio. Un valor desconocido usa el predeterminado. */
export function dayEvents(slot: unknown): DayEvent[] {
  const s = isTrainingSlot(slot) ? slot : DEFAULT_TRAINING_SLOT;
  const meals: DayEvent[] = MEALS.map((meal) => ({ kind: 'meal', meal }));
  if (s === 'start') return [{ kind: 'training' }, ...meals];
  const at = MEALS.indexOf(s);
  return [...meals.slice(0, at + 1), { kind: 'training' }, ...meals.slice(at + 1)];
}
