import {
  achievementDetail,
  achievementTitle,
  celebrations,
  detectPRs,
  goalBestLabel,
  goalMet,
  goalProgress,
  goalTitle,
  missingPRs,
  prKey,
  prTimeline,
  type GoalLike,
  type TimelineSet,
} from '../achievements';

const s = (weightKg: number, reps: number) => ({ weightKg, reps });
const kinds = (prior: ReturnType<typeof s>[], set: ReturnType<typeof s>) => detectPRs(prior, set).map((e) => e.kind);

describe('detectPRs', () => {
  it('la primera serie de un ejercicio fija la marca de partida: no es récord', () => {
    expect(detectPRs([], s(100, 5))).toEqual([]);
  });

  it('récord de peso: más carga que nunca, con cualquier número de repeticiones', () => {
    expect(kinds([s(100, 5)], s(102.5, 1))).toContain('pr_weight');
    expect(kinds([s(100, 5)], s(100, 5))).toEqual([]); // igualar no es batir
    expect(kinds([s(100, 5)], s(95, 8))).not.toContain('pr_weight');
  });

  it('récord de repeticiones: más reps que nunca con un peso igual o mayor', () => {
    expect(kinds([s(80, 8)], s(80, 9))).toContain('pr_reps');
    expect(kinds([s(80, 8), s(90, 6)], s(80, 7))).toEqual([]); // con 90 kg ya hizo 6 y con 80 hizo 8: 7 no bate nada
    // 9 reps con 80 kg: con ≥ 80 kg lo mejor era 8 (80×8 y 90×8)
    expect(kinds([s(80, 8), s(90, 8)], s(80, 9))).toContain('pr_reps');
  });

  it('con más peso que nunca es récord de peso y no además de repeticiones', () => {
    const k = kinds([s(80, 8)], s(85, 3));
    expect(k).toContain('pr_weight');
    expect(k).not.toContain('pr_reps');
  });

  it('un récord de repeticiones con un peso menor que uno hecho antes con más repeticiones no cuenta', () => {
    expect(kinds([s(100, 10)], s(80, 9))).toEqual([]);
  });

  it('peso corporal (0 kg): solo hay récord de repeticiones', () => {
    expect(kinds([s(0, 10)], s(0, 12))).toEqual(['pr_reps']);
    expect(kinds([s(0, 10)], s(0, 10))).toEqual([]);
    expect(kinds([s(0, 10)], s(0, 8))).toEqual([]);
  });

  it('récord de 1RM estimado (Epley) sin batir el peso ni las repeticiones', () => {
    // 100×15 queda fuera del 1RM (más de 12 reps) pero impide el récord de reps de 95×12; 95×12 estima 133 > 116,7
    expect(kinds([s(100, 5), s(100, 15)], s(95, 12))).toEqual(['pr_1rm']);
  });

  it('1RM: mejor estimación que nunca, con el valor redondeado a 0,1 kg', () => {
    // prior 100×5 → 116,7. 95×8 → 120,3 (también más reps con ≥ 95 kg)
    const e = detectPRs([s(100, 5)], s(95, 8));
    expect(e.map((x) => x.kind)).toEqual(['pr_reps', 'pr_1rm']);
    expect(e.find((x) => x.kind === 'pr_1rm')?.value).toBe(120.3);
  });

  it('el 1RM solo se estima hasta 12 repeticiones y con carga', () => {
    expect(kinds([s(100, 5)], s(60, 20))).not.toContain('pr_1rm'); // 20 reps: Epley pierde precisión
    expect(kinds([s(100, 5)], s(0, 30))).not.toContain('pr_1rm'); // sin carga no hay 1RM
  });

  it('el evento lleva la serie que lo consiguió', () => {
    const [e] = detectPRs([s(100, 5)], s(105, 3));
    expect(e).toMatchObject({ kind: 'pr_weight', value: 105, weightKg: 105, reps: 3 });
  });

  it('una serie puede batir varios récords a la vez', () => {
    expect(kinds([s(100, 5)], s(105, 6))).toEqual(['pr_weight', 'pr_1rm']);
  });
});

describe('prTimeline', () => {
  const t = (id: string, at: string, w: number, r: number, order = 0): TimelineSet => ({ id, at, weightKg: w, reps: r, order });

  it('recorre el historial en orden cronológico aunque llegue desordenado', () => {
    const tl = prTimeline([t('c', '2026-10-03', 105, 3), t('a', '2026-10-01', 100, 5), t('b', '2026-10-02', 100, 6)]);
    // a: marca de partida; b: 100×6 bate repeticiones (6>5 con ≥100 kg) y 1RM (120 > 116,7); c: 105×3 bate peso (105>100)
    expect(tl.map((e) => [e.setId, e.kind])).toEqual([
      ['b', 'pr_reps'],
      ['b', 'pr_1rm'],
      ['c', 'pr_weight'],
    ]);
    expect(tl[0].at).toBe('2026-10-02');
  });

  it('desempata por orden dentro del mismo instante', () => {
    const tl = prTimeline([t('b', '2026-10-01T10:00:00Z', 105, 3, 1), t('a', '2026-10-01T10:00:00Z', 100, 5, 0)]);
    expect(tl.map((e) => [e.setId, e.kind])).toEqual([['b', 'pr_weight']]); // a primero (marca de partida) y b la bate
  });

  it('un historial vacío o de una sola serie no tiene récords', () => {
    expect(prTimeline([])).toEqual([]);
    expect(prTimeline([t('a', '2026-10-01', 100, 5)])).toEqual([]);
  });

  it('missingPRs no repite lo ya guardado', () => {
    const tl = prTimeline([t('a', '2026-10-01', 100, 5), t('b', '2026-10-02', 105, 3)]);
    expect(missingPRs(tl, new Set()).length).toBe(tl.length);
    expect(missingPRs(tl, new Set([prKey('b', 'pr_weight')])).map((e) => e.kind)).toEqual(tl.map((e) => e.kind).filter((k) => k !== 'pr_weight'));
    expect(missingPRs(tl, new Set(tl.map((e) => prKey(e.setId, e.kind))))).toEqual([]);
  });
});

describe('objetivos', () => {
  const weightGoal: GoalLike = { kind: 'weight', target_weight_kg: 100, target_reps: 1 };
  const repsGoal: GoalLike = { kind: 'reps', target_weight_kg: 0, target_reps: 12 };
  const loadedReps: GoalLike = { kind: 'reps', target_weight_kg: 80, target_reps: 8 };

  it('goalMet exige a la vez la carga y las repeticiones', () => {
    expect(goalMet(weightGoal, s(100, 1))).toBe(true);
    expect(goalMet(weightGoal, s(105, 3))).toBe(true);
    expect(goalMet(weightGoal, s(95, 5))).toBe(false);
    expect(goalMet(loadedReps, s(80, 8))).toBe(true);
    expect(goalMet(loadedReps, s(85, 7))).toBe(false);
    expect(goalMet(loadedReps, s(75, 12))).toBe(false);
    expect(goalMet(repsGoal, s(0, 12))).toBe(true);
    expect(goalMet(repsGoal, s(10, 12))).toBe(true); // con lastre también cuenta
  });

  it('progreso de un objetivo de carga: mejor carga hecha con las repeticiones pedidas', () => {
    expect(goalProgress(weightGoal, [s(85, 5), s(80, 8)])).toEqual({ percent: 85, met: false, best: 85 });
    expect(goalProgress(weightGoal, [])).toEqual({ percent: 0, met: false, best: null });
    expect(goalProgress(weightGoal, [s(100, 1)])).toEqual({ percent: 100, met: true, best: 100 });
    const five: GoalLike = { kind: 'weight', target_weight_kg: 100, target_reps: 5 };
    // 100×3 no cuenta para un objetivo de 100 × 5: la mejor marca con ≥ 5 reps es 90
    expect(goalProgress(five, [s(100, 3), s(90, 5)])).toEqual({ percent: 90, met: false, best: 90 });
  });

  it('progreso de un objetivo de repeticiones: máximas reps con la carga pedida o más', () => {
    expect(goalProgress(repsGoal, [s(0, 9)])).toEqual({ percent: 75, met: false, best: 9 });
    expect(goalProgress(loadedReps, [s(80, 6), s(60, 12)])).toEqual({ percent: 75, met: false, best: 6 });
    expect(goalProgress(loadedReps, [s(60, 12)])).toEqual({ percent: 0, met: false, best: null });
  });

  it('nunca muestra 100 % sin cumplirlo', () => {
    const g: GoalLike = { kind: 'weight', target_weight_kg: 1000, target_reps: 1 };
    expect(goalProgress(g, [s(999.9, 1)]).percent).toBe(99);
  });

  it('textos', () => {
    expect(goalTitle(weightGoal)).toBe('100 kg × 1');
    expect(goalTitle(loadedReps)).toBe('80 kg × 8');
    expect(goalTitle({ kind: 'weight', target_weight_kg: 62.5, target_reps: 3 })).toBe('62,5 kg × 3');
    expect(goalTitle(repsGoal)).toBe('12 repeticiones con peso corporal');
    expect(goalBestLabel(weightGoal, 85)).toBe('85 kg');
    expect(goalBestLabel(repsGoal, 9)).toBe('9 repeticiones');
    expect(goalBestLabel(repsGoal, 1)).toBe('1 repetición');
    expect(goalBestLabel(repsGoal, null)).toBe('sin marca todavía');
  });
});

describe('textos de logros y celebración', () => {
  it('detalle por tipo', () => {
    expect(achievementDetail({ kind: 'pr_weight', value: 105, weight_kg: 105, reps: 3 })).toBe('105 kg × 3');
    expect(achievementDetail({ kind: 'pr_reps', value: 12, weight_kg: 0, reps: 12 })).toBe('12 repeticiones con peso corporal');
    expect(achievementDetail({ kind: 'pr_reps', value: 9, weight_kg: 80, reps: 9 })).toBe('9 repeticiones con 80 kg');
    expect(achievementDetail({ kind: 'pr_1rm', value: 120.3, weight_kg: 95, reps: 8 })).toBe('120,3 kg (de 95 kg × 8)');
    expect(achievementDetail({ kind: 'goal', value: 100, weight_kg: 100, reps: 1 })).toBe('100 kg × 1');
    expect(achievementTitle('goal')).toBe('Objetivo conseguido');
    expect(achievementTitle('pr_1rm')).toBe('Récord de 1RM estimado');
  });

  it('un solo aviso de récord aunque se batan varios, y uno por objetivo', () => {
    const prs = detectPRs([s(100, 5)], s(105, 6));
    const c = celebrations('Press de banca', prs, [{ kind: 'weight', target_weight_kg: 100, target_reps: 1 }]);
    expect(c).toHaveLength(2);
    expect(c[0].title).toBe('¡Récord personal!');
    expect(c[0].detail).toBe('Press de banca: peso 105 kg · 1RM estimado 126 kg');
    expect(c[1]).toEqual({ title: '¡Objetivo conseguido!', detail: 'Press de banca: 100 kg × 1' });
    expect(celebrations('X', [], [])).toEqual([]);
  });
});
