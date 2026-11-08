// Objetivos de calorías y macros por día de la semana. Lógica pura.
// Si el perfil tiene un objetivo para ese día se usa; si no, el objetivo general de siempre.
import { isoWeekday } from './diet-math';

export interface DayTarget {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

/** Clave: día de la semana como texto, «1» = lunes … «7» = domingo. */
export type DayTargets = Record<string, DayTarget>;

export interface TargetsProfile {
  target_kcal: number | null;
  target_protein_g: number | null;
  target_carbs_g: number | null;
  target_fat_g: number | null;
  day_targets?: unknown;
}

export interface TargetsForDay {
  kcal: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  /** true si vienen del objetivo propio de ese día. */
  perDay: boolean;
}

const LIMITS: Record<keyof DayTarget, [number, number]> = { kcal: [500, 10000], protein_g: [0, 1000], carbs_g: [0, 2000], fat_g: [0, 1000] };

/** Valida lo que viene de la base de datos: se descarta cualquier día mal formado. Devuelve null si no queda ninguno. */
export function cleanDayTargets(raw: unknown): DayTargets | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: DayTargets = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const day = Number(k);
    if (!Number.isInteger(day) || day < 1 || day > 7 || !v || typeof v !== 'object') continue;
    const t = v as Record<string, unknown>;
    const parsed: Partial<DayTarget> = {};
    let ok = true;
    for (const key of Object.keys(LIMITS) as (keyof DayTarget)[]) {
      const n = t[key];
      if (typeof n !== 'number' || !Number.isFinite(n) || n < LIMITS[key][0] || n > LIMITS[key][1]) {
        ok = false;
        break;
      }
      parsed[key] = Math.round(n);
    }
    if (ok) out[String(day)] = parsed as DayTarget;
  }
  return Object.keys(out).length ? out : null;
}

/** Objetivos para un día de la semana (1-7). */
export function targetsForWeekday(p: TargetsProfile | null | undefined, weekday: number): TargetsForDay {
  const own = p ? cleanDayTargets(p.day_targets)?.[String(weekday)] : undefined;
  if (own) return { ...own, perDay: true };
  return {
    kcal: p?.target_kcal ?? null,
    protein_g: p?.target_protein_g ?? null,
    carbs_g: p?.target_carbs_g ?? null,
    fat_g: p?.target_fat_g ?? null,
    perDay: false,
  };
}

/** Objetivos para una fecha (AAAA-MM-DD). */
export const targetsForDate = (p: TargetsProfile | null | undefined, isoDate: string): TargetsForDay => targetsForWeekday(p, isoWeekday(isoDate));

/** Media de los días con objetivo propio: sirve de objetivo general y de respaldo para los días sin objetivo. */
export function averageOfDays(dt: DayTargets): DayTarget {
  const list = Object.values(dt);
  const avg = (k: keyof DayTarget) => Math.round(list.reduce((a, t) => a + t[k], 0) / list.length);
  return { kcal: avg('kcal'), protein_g: avg('protein_g'), carbs_g: avg('carbs_g'), fat_g: avg('fat_g') };
}
