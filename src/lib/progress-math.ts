// Lógica pura de progreso: tendencias de peso, adherencia, racha y ajuste semanal de calorías.
import { addDays, fromISODate, isoWeekday, type Macros } from './diet-math';
import type { Goal } from './nutrition';
import { KCAL_PER_G } from './nutrition';
import { bestEstimated1RM } from './training-math';

export interface DatedValue {
  date: string; // AAAA-MM-DD
  value: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Días naturales entre dos fechas ISO (b − a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((fromISODate(b).getTime() - fromISODate(a).getTime()) / 86400000);
}

/** Lunes de la semana de una fecha ISO. */
export function weekStartISO(iso: string): string {
  return addDays(iso, -(isoWeekday(iso) - 1));
}

/**
 * Media móvil: para cada medición, media de las mediciones de los últimos `windowDays` días
 * naturales (incluido el propio día). Si hay varias en un día, cuentan todas.
 */
export function movingAverage(points: DatedValue[], windowDays = 7): DatedValue[] {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((p) => {
    const inWindow = sorted.filter((q) => {
      const d = daysBetween(q.date, p.date);
      return d >= 0 && d < windowDays;
    });
    return { date: p.date, value: r1(inWindow.reduce((s, q) => s + q.value, 0) / inWindow.length) };
  });
}

/** Pendiente por mínimos cuadrados en unidades por semana; null si no hay al menos dos días distintos. */
export function slopePerWeek(points: DatedValue[]): number | null {
  if (points.length < 2) return null;
  const t0 = points.reduce((m, p) => (p.date < m ? p.date : m), points[0].date);
  const xs = points.map((p) => daysBetween(t0, p.date));
  const ys = points.map((p) => p.value);
  const n = points.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  const den = xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  if (den === 0) return null;
  const num = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0);
  return (num / den) * 7;
}

// ---------- Cumplimiento de la dieta ----------

export const DIET_TOLERANCE = 0.1;

/** Un día de dieta cuenta como cumplido si las kcal están dentro de ±10 % del objetivo. */
export function dietDayOk(kcal: number | undefined, target: number | null | undefined, tolerance = DIET_TOLERANCE): boolean {
  if (!kcal || !target || target <= 0) return false;
  return kcal >= target * (1 - tolerance) && kcal <= target * (1 + tolerance);
}

/** Suma las kcal por día a partir de las entradas del diario. */
export function kcalByDay(rows: { log_date: string; kcal: number }[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const r of rows) out[r.log_date] = (out[r.log_date] ?? 0) + Number(r.kcal);
  return out;
}

export interface WeekAdherence {
  weekStart: string;
  /** Días transcurridos de la semana (7 salvo la semana en curso). */
  elapsedDays: number;
  dietDays: number;
  dietPct: number;
  sessions: number;
  trainingPct: number;
  inProgress: boolean;
}

/**
 * Adherencia de las últimas `weeks` semanas (de lunes a domingo, la última es la actual).
 * - Dieta: % de días transcurridos con kcal dentro de ±10 % del objetivo.
 * - Entreno: sesiones terminadas / entrenos planificados por semana (de tu perfil), con un tope del 100 %.
 *   En la semana en curso lo planificado se prorratea por los días transcurridos.
 */
export function weeklyAdherence(opts: {
  weeks: number;
  today: string;
  kcalByDay: Record<string, number>;
  target: number | null;
  sessionDates: string[];
  plannedPerWeek: number;
}): WeekAdherence[] {
  const thisWeek = weekStartISO(opts.today);
  const out: WeekAdherence[] = [];
  for (let w = opts.weeks - 1; w >= 0; w--) {
    const start = addDays(thisWeek, -7 * w);
    const end = addDays(start, 6);
    const inProgress = w === 0;
    const elapsed = inProgress ? daysBetween(start, opts.today) + 1 : 7;
    let dietDays = 0;
    for (let i = 0; i < elapsed; i++) if (dietDayOk(opts.kcalByDay[addDays(start, i)], opts.target)) dietDays++;
    const sessions = opts.sessionDates.filter((d) => d >= start && d <= end).length;
    const expected = inProgress ? Math.max(1, Math.ceil((opts.plannedPerWeek * elapsed) / 7)) : opts.plannedPerWeek;
    out.push({
      weekStart: start,
      elapsedDays: elapsed,
      dietDays,
      dietPct: Math.round((dietDays / elapsed) * 100),
      sessions,
      trainingPct: opts.plannedPerWeek > 0 ? Math.min(100, Math.round((sessions / expected) * 100)) : 0,
      inProgress,
    });
  }
  return out;
}

/**
 * Racha de días cumplidos. Un día cumple si las kcal están dentro de ±10 % del objetivo y,
 * si ese día de la semana tienes entreno programado, hay una sesión terminada.
 * Hoy no rompe la racha mientras no se haya cumplido (aún puede cumplirse).
 */
export function computeStreak(opts: {
  today: string;
  kcalByDay: Record<string, number>;
  target: number | null;
  sessionDates: Set<string>;
  scheduledWeekdays: Set<number>;
  maxDays?: number;
}): number {
  if (!opts.target) return 0;
  const ok = (d: string) =>
    dietDayOk(opts.kcalByDay[d], opts.target) && (!opts.scheduledWeekdays.has(isoWeekday(d)) || opts.sessionDates.has(d));
  let streak = 0;
  for (let i = 0; i < (opts.maxDays ?? 365); i++) {
    const d = addDays(opts.today, -i);
    if (ok(d)) streak++;
    else if (i === 0) continue;
    else break;
  }
  return streak;
}

// ---------- Ajuste semanal de calorías ----------

export type AdjustmentStatus = 'suggest' | 'on_track' | 'insufficient_data' | 'low_logging' | 'cooldown' | 'at_floor';

export interface Adjustment {
  status: AdjustmentStatus;
  message: string;
  slopeKgPerWeek: number | null;
  deltaKcal: number;
  newKcal: number | null;
}

export const ADJUSTMENT_WINDOW_DAYS = 14;
export const ADJUSTMENT_COOLDOWN_DAYS = 14;

/**
 * Propone un ajuste de ±100-200 kcal si en las últimas 2 semanas la tendencia de peso no va en la
 * dirección del objetivo. Reglas (heurísticas, no consejo médico):
 *  - Hace falta tener ≥ 4 pesajes que abarquen ≥ 10 días y kcal registradas en ≥ 7 de los últimos 14 días.
 *  - Perder grasa: pendiente > −0,1 kg/sem → menos kcal (−100 estancado, −150 si sube, −200 si sube > 0,25 kg/sem).
 *    Si baja más del 1 % del peso por semana, +100 por seguridad.
 *  - Ganar músculo: pendiente < +0,05 kg/sem → más kcal (+100, +150 si baja, +200 si baja > 0,25).
 *    Si sube más del 0,5 % por semana, −100.
 *  - Mantener: si |pendiente| > 0,25 kg/sem → ∓150 (∓200 si > 0,5).
 *  - No se vuelve a sugerir hasta pasados 14 días desde la última decisión (aceptada o rechazada).
 */
export function suggestAdjustment(opts: {
  goal: Goal;
  today: string;
  weights: DatedValue[];
  kcalDaysLogged: number;
  currentKcal: number;
  minKcal: number;
  weightKg: number;
  lastDecisionDate: string | null;
}): Adjustment {
  const base = { slopeKgPerWeek: null, deltaKcal: 0, newKcal: null };
  if (opts.lastDecisionDate && daysBetween(opts.lastDecisionDate, opts.today) < ADJUSTMENT_COOLDOWN_DAYS) {
    return { ...base, status: 'cooldown', message: 'Ya revisaste tus calorías hace poco. Esperamos unos días para ver el efecto.' };
  }
  const from = addDays(opts.today, -(ADJUSTMENT_WINDOW_DAYS - 1));
  const w = opts.weights.filter((p) => p.date >= from && p.date <= opts.today);
  const span = w.length ? daysBetween(w.reduce((m, p) => (p.date < m ? p.date : m), w[0].date), w.reduce((m, p) => (p.date > m ? p.date : m), w[0].date)) : 0;
  if (w.length < 4 || span < 10) {
    return { ...base, status: 'insufficient_data', message: 'Registra tu peso al menos 4 veces en 2 semanas (con 10 días entre el primero y el último) para valorar tu tendencia.' };
  }
  const slope = slopePerWeek(w)!;
  const out = { slopeKgPerWeek: r1(slope * 10) / 10 === 0 ? 0 : Math.round(slope * 100) / 100, deltaKcal: 0, newKcal: null as number | null };
  if (opts.kcalDaysLogged < 7) {
    return { ...out, status: 'low_logging', message: 'Registraste tu comida menos de la mitad de los días. Antes de tocar calorías, intenta registrar más para saber si estás siguiendo el plan.' };
  }

  const pct = (slope / opts.weightKg) * 100;
  const sign = slope >= 0 ? 'sube' : 'baja';
  const rate = `${Math.abs(slope).toFixed(2).replace('.', ',')} kg/semana`;
  let delta = 0;
  let why = '';
  switch (opts.goal) {
    case 'lose_fat':
      if (slope > -0.1) {
        delta = slope > 0.25 ? -200 : slope > 0 ? -150 : -100;
        why = `Tu objetivo es perder grasa pero tu peso ${slope >= 0 ? 'sube' : 'está estancado'} (${sign} ${rate}).`;
      } else if (pct < -1) {
        delta = 100;
        why = `Estás perdiendo peso muy rápido (${rate}, más del 1 % semanal). Subir un poco las calorías protege tu masa muscular.`;
      }
      break;
    case 'gain_muscle':
      if (slope < 0.05) {
        delta = slope < -0.25 ? 200 : slope < 0 ? 150 : 100;
        why = `Tu objetivo es ganar músculo pero tu peso ${slope < 0 ? 'baja' : 'apenas sube'} (${sign} ${rate}).`;
      } else if (pct > 0.5) {
        delta = -100;
        why = `Estás ganando peso muy rápido (${rate}, más del 0,5 % semanal): buena parte sería grasa.`;
      }
      break;
    case 'maintain':
      if (Math.abs(slope) > 0.25) {
        const big = Math.abs(slope) > 0.5;
        delta = slope > 0 ? (big ? -200 : -150) : big ? 200 : 150;
        why = `Quieres mantener tu peso pero ${sign} ${rate}.`;
      }
      break;
  }

  if (delta === 0) {
    return { ...out, status: 'on_track', message: `Vas en la dirección de tu objetivo (tu peso ${sign} ${rate}). No hace falta cambiar nada.` };
  }
  const newKcal = opts.currentKcal + delta;
  if (newKcal < opts.minKcal) {
    return { ...out, status: 'at_floor', message: `${why} Pero tu objetivo ya está cerca del mínimo recomendado (${opts.minKcal} kcal), así que no sugerimos bajarlo más. Consulta con un dietista-nutricionista.` };
  }
  return { ...out, status: 'suggest', deltaKcal: delta, newKcal, message: `${why} Te proponemos ${delta > 0 ? 'subir' : 'bajar'} tu objetivo ${Math.abs(delta)} kcal (de ${opts.currentKcal} a ${newKcal} kcal).` };
}

/** Reparte unas nuevas kcal manteniendo proteína y grasa: los carbohidratos absorben el cambio. */
export function macrosForNewKcal(kcal: number, proteinG: number, fatG: number): Macros & { carbs_g: number } {
  const carbs = Math.max(0, Math.round((kcal - proteinG * KCAL_PER_G.protein - fatG * KCAL_PER_G.fat) / KCAL_PER_G.carbs));
  return { kcal, protein_g: proteinG, fat_g: fatG, carbs_g: carbs };
}

// ---------- Evolución de cargas ----------

export interface SessionBest {
  sessionId: string;
  date: string;
  topWeightKg: number;
  est1RM: number | null;
}

/** Mejor peso y mejor 1RM estimado de cada sesión para un ejercicio, en orden cronológico. */
export function sessionBests(sets: { session_id: string; weight_kg: number; reps: number; created_at: string }[]): SessionBest[] {
  const bySession = new Map<string, typeof sets>();
  for (const s of sets) bySession.set(s.session_id, [...(bySession.get(s.session_id) ?? []), s]);
  return [...bySession.entries()]
    .map(([sessionId, ss]) => ({
      sessionId,
      date: ss.map((s) => s.created_at).sort()[0].slice(0, 10),
      topWeightKg: Math.max(...ss.map((s) => s.weight_kg)),
      est1RM: (() => {
        const v = bestEstimated1RM(ss.map((s) => ({ weightKg: s.weight_kg, reps: s.reps })));
        return v == null ? null : r1(v);
      })(),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ---------- Ejes de gráficas ----------

/** Marcas «redondas» para un eje entre min y max (≈ count marcas). */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let v = start; v <= max + step * 0.999; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}
