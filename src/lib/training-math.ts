// Lógica pura de entrenamiento: 1RM, progresión de carga y volumen.

/** Incremento de carga sugerido cuando se completan todas las repeticiones objetivo. */
export const PROGRESSION_STEP_KG = 2.5;

/** Epley pierde precisión con muchas repeticiones, así que solo se estima hasta este número. */
export const MAX_REPS_FOR_1RM = 12;

export interface SetData {
  weightKg: number;
  reps: number;
}

/** 1RM estimado con Epley: peso × (1 + reps / 30). Con 1 repetición es el propio peso. */
export function epley1RM(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  if (reps === 1) return weightKg;
  return weightKg * (1 + reps / 30);
}

/** Mejor 1RM estimado de una lista de series (ignora las de más de 12 repeticiones). */
export function bestEstimated1RM(sets: SetData[]): number | null {
  const values = sets.filter((s) => s.reps <= MAX_REPS_FOR_1RM).map((s) => epley1RM(s.weightKg, s.reps));
  const best = Math.max(0, ...values);
  return best > 0 ? best : null;
}

/** Volumen de una serie (kg × repeticiones). */
export function setVolume(s: SetData): number {
  return s.weightKg * s.reps;
}

/** ¿Se hicieron al menos `plannedSets` series alcanzando las repeticiones objetivo? */
export function targetsMet(sets: SetData[], plannedSets: number, targetReps: number): boolean {
  return sets.filter((s) => s.reps >= targetReps).length >= plannedSets;
}

/**
 * Si se completaron todas las series con las repeticiones objetivo, sugiere subir carga:
 * la mayor carga con la que se cumplió el objetivo + PROGRESSION_STEP_KG.
 * Devuelve null si no se cumplió o si el ejercicio es sin carga (peso 0).
 */
export function suggestNextWeight(sets: SetData[], plannedSets: number, targetReps: number): number | null {
  if (!targetsMet(sets, plannedSets, targetReps)) return null;
  const qualifying = sets.filter((s) => s.reps >= targetReps);
  const top = Math.max(...qualifying.map((s) => s.weightKg));
  if (top <= 0) return null;
  return top + PROGRESSION_STEP_KG;
}

/** Lunes 00:00 (hora local) de la semana de `date`. */
export function weekStart(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const sinceMonday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - sinceMonday);
  return d;
}

export interface VolumeEntry {
  muscleGroup: string;
  weightKg: number;
  reps: number;
}

export interface GroupVolume {
  muscleGroup: string;
  sets: number;
  volumeKg: number;
}

/** Series y volumen (kg × reps) por grupo muscular, de mayor a menor número de series. */
export function volumeByMuscleGroup(entries: VolumeEntry[]): GroupVolume[] {
  const map = new Map<string, GroupVolume>();
  for (const e of entries) {
    const g = map.get(e.muscleGroup) ?? { muscleGroup: e.muscleGroup, sets: 0, volumeKg: 0 };
    g.sets += 1;
    g.volumeKg += setVolume(e);
    map.set(e.muscleGroup, g);
  }
  return [...map.values()].sort((a, b) => b.sets - a.sets || b.volumeKg - a.volumeKg);
}

/** 62.5 → "62,5"; 60 → "60". */
export function formatKg(n: number): string {
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

/** 3725 → "1 h 02 min"; 540 → "9 min". */
export function formatDuration(totalSeconds: number): string {
  const minutes = Math.max(0, Math.round(totalSeconds / 60));
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`;
}

/** 95 → "1:35". */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
