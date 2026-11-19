// Dieta ya interpretada (p. ej. la leída de una foto) que espera en memoria a que la pantalla de revisión la recoja.
import type { ParsedDiet } from './diet-import';

let pending: ParsedDiet | null = null;

export const setPendingImport = (p: ParsedDiet | null): void => {
  pending = p;
};

export const takePendingImport = (): ParsedDiet | null => {
  const p = pending;
  pending = null;
  return p;
};
