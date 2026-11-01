// Lógica pura del plan de una sesión y de las series: objetivo de repeticiones, orden y numeración.
import type { SetType } from './training-math';

export interface RepsTarget {
  reps_target: number;
  reps_min?: number;
  reps_max?: number;
}

/** Rango de repeticiones de un ejercicio. Las sesiones y rutinas anteriores solo tienen `reps_target` (fijo). */
export function repsRange(t: RepsTarget): { min: number; max: number } {
  const max = t.reps_max ?? t.reps_target;
  return { min: Math.min(t.reps_min ?? max, max), max };
}

/** 8 → "8"; 6–8 → "6–8". */
export function repsLabel(min: number, max: number): string {
  return min === max ? String(max) : `${min}–${max}`;
}

/** "3 × 8" o "3 × 6–8". */
export function targetLabel(sets: number, t: RepsTarget): string {
  const { min, max } = repsRange(t);
  return `${sets} × ${repsLabel(min, max)}`;
}

// ---------- Orden de los ejercicios de una sesión ----------
//
// `plan` es una lista ordenada. Las series se guardan con `position` = `slot` del ejercicio, un identificador estable:
// cambiar el orden de la lista no obliga a tocar las series ya registradas. Los planes antiguos no tienen `slot`; en
// ellos el slot es el índice, que es lo que `position` significaba hasta ahora.

export interface Slotted {
  slot?: number;
}

/** Garantiza que todos los elementos tengan `slot` único, sin alterar los que ya lo tienen. */
export function withSlots<T extends Slotted>(plan: T[]): (T & { slot: number })[] {
  if (plan.every((p) => p.slot != null)) return plan as (T & { slot: number })[];
  if (plan.every((p) => p.slot == null)) return plan.map((p, i) => ({ ...p, slot: i }));
  let next = Math.max(...plan.map((p) => p.slot ?? -1)) + 1;
  return plan.map((p) => (p.slot != null ? (p as T & { slot: number }) : { ...p, slot: next++ }));
}

/** Siguiente slot libre para un ejercicio nuevo. */
export function nextSlot(plan: Slotted[]): number {
  return plan.reduce((m, p, i) => Math.max(m, (p.slot ?? i) + 1), 0);
}

/** Ejercicio al que pertenece una serie guardada con `position`. */
export function itemForPosition<T extends Slotted>(plan: T[], position: number): T | undefined {
  return plan.find((p, i) => (p.slot ?? i) === position);
}

/** Mueve un elemento de `from` a `to` (devuelve una copia). */
export function moveItem<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= list.length) return list;
  const out = [...list];
  const [it] = out.splice(from, 1);
  out.splice(Math.max(0, Math.min(out.length, to)), 0, it);
  return out;
}

/** Ordena `list` según la lista de claves dada (los que no estén en `keys` van al final, en su orden). */
export function orderByKeys<T>(list: T[], keyOf: (t: T) => string, keys: string[]): T[] {
  const rank = new Map(keys.map((k, i) => [k, i]));
  return [...list].sort((a, b) => (rank.get(keyOf(a)) ?? Infinity) - (rank.get(keyOf(b)) ?? Infinity));
}

/**
 * Índice de destino al arrastrar una fila de altura fija: `dy` es el desplazamiento vertical desde el inicio.
 * Se redondea al hueco más cercano y se limita al rango de la lista.
 */
export function dropIndex(startIndex: number, dy: number, rowHeight: number, count: number): number {
  return Math.max(0, Math.min(count - 1, startIndex + Math.round(dy / rowHeight)));
}

// ---------- Series de un ejercicio: tipo, orden y numeración ----------

export interface SetRowLike {
  type: SetType;
  /** Identidad de la serie en la base de datos (set_index). Nunca cambia. */
  setIndex: number;
  /** Orden guardado en la base de datos (null = sin guardar o antiguo). */
  sortOrder: number | null;
  dbId: string | null;
}

/** "A" para aproximación, "D" para dropset y el número (1, 2, 3…) para las normales, que no cuentan las demás. */
export function setLabels(rows: { type: SetType }[]): string[] {
  let n = 0;
  return rows.map((r) => (r.type === 'warmup' ? 'A' : r.type === 'dropset' ? 'D' : String(++n)));
}

/** Siguiente identidad libre (set_index) dentro de un ejercicio. */
export function nextSetIndex(rows: { setIndex: number }[]): number {
  return rows.reduce((m, r) => Math.max(m, r.setIndex + 1), 0);
}

/** Posición de una serie de aproximación nueva: tras las que ya hay, antes de cualquier otra. */
export function warmupInsertIndex(rows: { type: SetType }[]): number {
  const first = rows.findIndex((r) => r.type !== 'warmup');
  return first === -1 ? rows.length : first;
}

/** Quita el elemento `index`. */
export function removeAt<T>(rows: T[], index: number): T[] {
  return rows.filter((_, i) => i !== index);
}

/** Inserta `row` en `index`. */
export function insertAt<T>(rows: T[], index: number, row: T): T[] {
  return [...rows.slice(0, index), row, ...rows.slice(index)];
}

/**
 * Series ya guardadas cuyo orden en base de datos no coincide con su posición en la lista:
 * hay que actualizarlas tras insertar o borrar una serie intermedia.
 */
export function orderUpdates(rows: SetRowLike[]): { dbId: string; sortOrder: number }[] {
  const out: { dbId: string; sortOrder: number }[] = [];
  rows.forEach((r, i) => {
    if (r.dbId && (r.sortOrder ?? r.setIndex) !== i) out.push({ dbId: r.dbId, sortOrder: i });
  });
  return out;
}

/** Orden efectivo de una serie leída de la base de datos. */
export const effectiveOrder = (s: { sort_order?: number | null; set_index: number }): number => s.sort_order ?? s.set_index;
