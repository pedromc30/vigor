// Lógica pura de logros: récords personales (PR), objetivos por ejercicio y sus textos.
// Solo cuentan las series normales: quien llame debe filtrar antes las de aproximación y los dropsets.
import { effectiveOrder } from './plan';
import { MAX_REPS_FOR_1RM, bestEstimated1RM, epley1RM, formatKg } from './training-math';

export type PRKind = 'pr_weight' | 'pr_reps' | 'pr_1rm';
export type AchievementKind = 'goal' | PRKind;

/** Una serie: carga y repeticiones. */
export interface WeightReps {
  weightKg: number;
  reps: number;
}

export interface PREvent {
  kind: PRKind;
  /** kg (peso, 1RM) o repeticiones (reps). */
  value: number;
  /** La serie que lo consiguió. */
  weightKg: number;
  reps: number;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Récords que bate una serie frente a las anteriores del mismo ejercicio:
 *  - peso: más carga que nunca;
 *  - repeticiones: más repeticiones que nunca con un peso igual o mayor (si no hay series con ese peso, ya es de peso);
 *  - 1RM: mejor 1RM estimado (Epley, solo series de hasta 10 repeticiones y con carga).
 * Sin series anteriores no hay récord: la primera vez fija la marca de partida.
 */
export function detectPRs(prior: WeightReps[], set: WeightReps): PREvent[] {
  if (!prior.length) return [];
  const out: PREvent[] = [];
  const { weightKg: w, reps: r } = set;

  if (w > 0 && w > Math.max(...prior.map((p) => p.weightKg))) {
    out.push({ kind: 'pr_weight', value: w, weightKg: w, reps: r });
  }

  const sameOrHeavier = prior.filter((p) => p.weightKg >= w);
  if (sameOrHeavier.length && r > Math.max(...sameOrHeavier.map((p) => p.reps))) {
    out.push({ kind: 'pr_reps', value: r, weightKg: w, reps: r });
  }

  if (w > 0 && r <= MAX_REPS_FOR_1RM) {
    const best = bestEstimated1RM(prior);
    if (best != null && r1(epley1RM(w, r)) > r1(best)) {
      out.push({ kind: 'pr_1rm', value: r1(epley1RM(w, r)), weightKg: w, reps: r });
    }
  }
  return out;
}

export interface TimelineSet extends WeightReps {
  id: string;
  /** Momento en que se registró la serie (ISO). */
  at: string;
  /** Desempate dentro de un mismo instante. */
  order?: number;
}

export interface TimelinePR extends PREvent {
  setId: string;
  at: string;
}

/**
 * Todos los récords que se fueron batiendo a lo largo del historial, en orden cronológico. Es la misma regla que se
 * usa al guardar una serie, así las marcas anteriores a esta función quedan reconocidas sin celebrar nada.
 */
export function prTimeline(sets: TimelineSet[]): TimelinePR[] {
  const sorted = [...sets].sort((a, b) => a.at.localeCompare(b.at) || (a.order ?? 0) - (b.order ?? 0));
  const prior: WeightReps[] = [];
  const out: TimelinePR[] = [];
  for (const s of sorted) {
    for (const e of detectPRs(prior, s)) out.push({ ...e, setId: s.id, at: s.at });
    prior.push({ weightKg: s.weightKg, reps: s.reps });
  }
  return out;
}

/** Una serie leída de la base de datos, lista para recorrer el historial. */
export const toTimelineSet = (r: { id: string; weight_kg: number; reps: number; created_at: string; set_index?: number; sort_order?: number | null }): TimelineSet => ({
  id: r.id,
  weightKg: r.weight_kg,
  reps: r.reps,
  at: r.created_at,
  order: effectiveOrder({ set_index: r.set_index ?? 0, sort_order: r.sort_order }),
});

/** Récords batidos en cada sesión de un ejercicio (clave: id de sesión), a partir de sus series normales. */
export function prKindsBySession(rows: { id: string; session_id: string; weight_kg: number; reps: number; created_at: string; set_index?: number; sort_order?: number | null }[]): Map<string, PRKind[]> {
  const sessionOf = new Map(rows.map((r) => [r.id, r.session_id]));
  const out = new Map<string, PRKind[]>();
  for (const e of prTimeline(rows.map(toTimelineSet))) {
    const sid = sessionOf.get(e.setId);
    if (!sid) continue;
    const kinds = out.get(sid) ?? [];
    if (!kinds.includes(e.kind)) kinds.push(e.kind);
    out.set(sid, kinds);
  }
  return out;
}

/** Clave estable de un récord ya guardado: una serie solo registra una vez cada tipo de récord. */
export const prKey = (setId: string, kind: AchievementKind) => `${setId}|${kind}`;

/** Récords del historial que todavía no están guardados (para el cálculo inicial, sin celebraciones). */
export function missingPRs(timeline: TimelinePR[], savedKeys: Set<string>): TimelinePR[] {
  return timeline.filter((e) => !savedKeys.has(prKey(e.setId, e.kind)));
}

// ---------- Objetivos ----------

export type GoalKind = 'weight' | 'reps';

export interface GoalLike {
  kind: GoalKind;
  target_weight_kg: number;
  target_reps: number;
}

/** Un objetivo se cumple con una serie que alcance a la vez la carga y las repeticiones. */
export function goalMet(g: GoalLike, s: WeightReps): boolean {
  return s.weightKg >= g.target_weight_kg && s.reps >= g.target_reps;
}

export interface GoalProgress {
  percent: number;
  /** Mejor marca actual hacia el objetivo (kg en objetivos de carga, repeticiones en los de repeticiones). */
  best: number | null;
  met: boolean;
}

/**
 * Progreso hacia un objetivo con la mejor marca del historial:
 *  - de carga: la mayor carga hecha con las repeticiones pedidas o más;
 *  - de repeticiones: las máximas repeticiones hechas con la carga pedida o más.
 * El porcentaje no llega a 100 hasta que se cumple.
 */
export function goalProgress(g: GoalLike, sets: WeightReps[]): GoalProgress {
  const eligible = g.kind === 'weight' ? sets.filter((s) => s.reps >= g.target_reps) : sets.filter((s) => s.weightKg >= g.target_weight_kg);
  const best = eligible.length ? Math.max(...eligible.map((s) => (g.kind === 'weight' ? s.weightKg : s.reps))) : null;
  const met = sets.some((s) => goalMet(g, s));
  if (met) return { percent: 100, met, best };
  if (best == null) return { percent: 0, met, best };
  const target = g.kind === 'weight' ? g.target_weight_kg : g.target_reps;
  return { percent: Math.max(0, Math.min(99, Math.floor((best / target) * 100))), met, best };
}

// ---------- Textos ----------

const kg = (n: number) => `${formatKg(n)} kg`;
const withLoad = (weightKg: number) => (weightKg > 0 ? kg(weightKg) : 'peso corporal');

/** «100 kg × 1», «80 kg × 8» o «12 repeticiones con peso corporal». */
export function goalTitle(g: GoalLike): string {
  if (g.kind === 'reps' && g.target_weight_kg === 0) return `${g.target_reps} repeticiones con peso corporal`;
  return `${kg(g.target_weight_kg)} × ${g.target_reps}`;
}

/** Marca actual hacia el objetivo, p. ej. «85 kg» o «9 repeticiones». */
export function goalBestLabel(g: GoalLike, best: number | null): string {
  if (best == null) return 'sin marca todavía';
  return g.kind === 'weight' ? kg(best) : `${best} ${best === 1 ? 'repetición' : 'repeticiones'}`;
}

export const PR_LABELS: Record<PRKind, string> = {
  pr_weight: 'Récord de peso',
  pr_reps: 'Récord de repeticiones',
  pr_1rm: 'Récord de 1RM estimado',
};

export interface AchievementLike {
  kind: AchievementKind;
  value: number;
  weight_kg: number;
  reps: number;
}

/** Resumen de un logro: la serie que lo consiguió y, en el 1RM, la estimación. */
export function achievementDetail(a: AchievementLike): string {
  switch (a.kind) {
    case 'pr_weight':
      return `${kg(a.weight_kg)} × ${a.reps}`;
    case 'pr_reps':
      return `${a.reps} repeticiones con ${withLoad(a.weight_kg)}`;
    case 'pr_1rm':
      return `${kg(a.value)} (de ${kg(a.weight_kg)} × ${a.reps})`;
    case 'goal':
      return a.weight_kg > 0 ? `${kg(a.weight_kg)} × ${a.reps}` : `${a.reps} repeticiones con peso corporal`;
  }
}

export const achievementTitle = (kind: AchievementKind): string => (kind === 'goal' ? 'Objetivo conseguido' : PR_LABELS[kind]);

export interface Celebration {
  title: string;
  detail: string;
}

/** Mensajes para celebrar lo conseguido con una serie: un único aviso de récord y uno por objetivo. */
export function celebrations(exerciseName: string, prs: PREvent[], goals: GoalLike[]): Celebration[] {
  const out: Celebration[] = [];
  if (prs.length) {
    out.push({
      title: '¡Récord personal!',
      detail: `${exerciseName}: ${prs.map((p) => `${PR_LABELS[p.kind].replace('Récord de ', '')} ${p.kind === 'pr_reps' ? `${p.value} reps` : kg(p.value)}`).join(' · ')}`,
    });
  }
  for (const g of goals) out.push({ title: '¡Objetivo conseguido!', detail: `${exerciseName}: ${goalTitle(g)}` });
  return out;
}
