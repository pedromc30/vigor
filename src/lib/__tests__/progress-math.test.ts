import {
  computeStreak,
  daysBetween,
  dietDayOk,
  kcalByDay,
  macrosForNewKcal,
  movingAverage,
  niceTicks,
  sessionBests,
  slopePerWeek,
  suggestAdjustment,
  weekStartISO,
  weeklyAdherence,
  type DatedValue,
} from '../progress-math';

describe('movingAverage', () => {
  it('media de los últimos 7 días naturales incluyendo el propio día', () => {
    const pts = [
      { date: '2026-10-01', value: 80 },
      { date: '2026-10-02', value: 79 },
      { date: '2026-10-09', value: 78 }, // 8 días después: las dos primeras salen de la ventana
    ];
    expect(movingAverage(pts).map((p) => p.value)).toEqual([80, 79.5, 78]);
  });
  it('ordena las entradas y tolera huecos', () => {
    const r = movingAverage([{ date: '2026-10-03', value: 70 }, { date: '2026-10-01', value: 72 }]);
    expect(r.map((p) => p.date)).toEqual(['2026-10-01', '2026-10-03']);
    expect(r[1].value).toBe(71);
  });
});

describe('slopePerWeek', () => {
  it('calcula kg/semana', () => {
    expect(slopePerWeek([{ date: '2026-10-01', value: 80 }, { date: '2026-10-08', value: 79 }])).toBeCloseTo(-1, 6);
    expect(slopePerWeek([{ date: '2026-10-01', value: 80 }, { date: '2026-10-15', value: 80.7 }])).toBeCloseTo(0.35, 6);
  });
  it('null sin datos suficientes', () => {
    expect(slopePerWeek([])).toBeNull();
    expect(slopePerWeek([{ date: '2026-10-01', value: 80 }])).toBeNull();
    expect(slopePerWeek([{ date: '2026-10-01', value: 80 }, { date: '2026-10-01', value: 81 }])).toBeNull();
  });
});

describe('fechas', () => {
  it('daysBetween y weekStartISO', () => {
    expect(daysBetween('2026-10-01', '2026-10-24')).toBe(23);
    expect(weekStartISO('2026-10-24')).toBe('2026-10-19'); // sábado → lunes
    expect(weekStartISO('2026-10-19')).toBe('2026-10-19');
    expect(weekStartISO('2026-10-25')).toBe('2026-10-19'); // domingo
  });
});

describe('dieta', () => {
  it('dietDayOk: ±10 %', () => {
    expect(dietDayOk(2000, 2000)).toBe(true);
    expect(dietDayOk(1800, 2000)).toBe(true);
    expect(dietDayOk(1799, 2000)).toBe(false);
    expect(dietDayOk(2200, 2000)).toBe(true);
    expect(dietDayOk(2201, 2000)).toBe(false);
    expect(dietDayOk(undefined, 2000)).toBe(false);
    expect(dietDayOk(2000, null)).toBe(false);
  });
  it('kcalByDay suma por día', () => {
    expect(kcalByDay([{ log_date: 'a', kcal: 100 }, { log_date: 'a', kcal: 50.5 }, { log_date: 'b', kcal: 10 }])).toEqual({ a: 150.5, b: 10 });
  });
});

describe('weeklyAdherence', () => {
  // hoy = miércoles 21 oct 2026 (semana en curso: lunes 19)
  const today = '2026-10-21';
  const days: Record<string, number> = {
    '2026-10-12': 2000, '2026-10-13': 2000, '2026-10-14': 1000, '2026-10-15': 2050, '2026-10-16': 0, '2026-10-17': 1990, '2026-10-18': 2000,
    '2026-10-19': 2000, '2026-10-20': 900,
  };
  const r = weeklyAdherence({ weeks: 2, today, kcalByDay: days, target: 2000, sessionDates: ['2026-10-13', '2026-10-15', '2026-10-17', '2026-10-19'], plannedPerWeek: 4 });

  it('semana pasada: 5 de 7 días y 3 de 4 sesiones', () => {
    expect(r[0]).toMatchObject({ weekStart: '2026-10-12', elapsedDays: 7, dietDays: 5, dietPct: 71, sessions: 3, trainingPct: 75, inProgress: false });
  });
  it('semana en curso: solo cuenta los días transcurridos y prorratea lo planificado', () => {
    // 3 días transcurridos (lun-mié): ok lunes → 1/3; planificado ceil(4*3/7)=2, 1 sesión → 50 %
    expect(r[1]).toMatchObject({ weekStart: '2026-10-19', elapsedDays: 3, dietDays: 1, dietPct: 33, sessions: 1, trainingPct: 50, inProgress: true });
  });
  it('sin entrenos planificados el % de entreno es 0 y no divide por cero', () => {
    const z = weeklyAdherence({ weeks: 1, today, kcalByDay: {}, target: 2000, sessionDates: [], plannedPerWeek: 0 });
    expect(z[0].trainingPct).toBe(0);
  });
  it('el tope es 100 %', () => {
    const z = weeklyAdherence({ weeks: 2, today, kcalByDay: {}, target: 2000, sessionDates: ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'], plannedPerWeek: 3 });
    expect(z[0].trainingPct).toBe(100);
  });
});

describe('computeStreak', () => {
  const base = { target: 2000, sessionDates: new Set<string>(), scheduledWeekdays: new Set<number>() };
  it('cuenta días seguidos hacia atrás y se para en el primer fallo', () => {
    const k = { '2026-10-24': 2000, '2026-10-23': 1950, '2026-10-22': 2100, '2026-10-21': 800, '2026-10-20': 2000 };
    expect(computeStreak({ ...base, today: '2026-10-24', kcalByDay: k })).toBe(3);
  });
  it('hoy sin cumplir todavía no rompe la racha', () => {
    const k = { '2026-10-23': 2000, '2026-10-22': 2000 };
    expect(computeStreak({ ...base, today: '2026-10-24', kcalByDay: k })).toBe(2);
  });
  it('un entreno programado sin hacer rompe la racha', () => {
    const k = { '2026-10-23': 2000, '2026-10-22': 2000, '2026-10-21': 2000 }; // 22 = jueves
    const withSession = computeStreak({ ...base, today: '2026-10-24', kcalByDay: k, scheduledWeekdays: new Set([4]), sessionDates: new Set(['2026-10-22']) });
    const without = computeStreak({ ...base, today: '2026-10-24', kcalByDay: k, scheduledWeekdays: new Set([4]) });
    expect(withSession).toBe(3);
    expect(without).toBe(1); // solo el viernes 23; el jueves 22 falla
  });
  it('sin objetivo la racha es 0', () => {
    expect(computeStreak({ ...base, target: null, today: '2026-10-24', kcalByDay: { '2026-10-24': 2000 } })).toBe(0);
  });
});

describe('suggestAdjustment', () => {
  const today = '2026-10-24';
  // pesajes cada 2-3 días durante 14 días con la pendiente indicada (kg/semana)
  const weights = (slope: number, w0 = 80): DatedValue[] =>
    [0, 3, 5, 8, 10, 13].map((d) => ({ date: new Date(Date.UTC(2026, 9, 11 + d)).toISOString().slice(0, 10), value: w0 + (slope * d) / 7 }));
  const common = { today, kcalDaysLogged: 12, currentKcal: 2200, minKcal: 1500, weightKg: 80, lastDecisionDate: null };

  it('perder grasa y peso estancado → −100', () => {
    const a = suggestAdjustment({ ...common, goal: 'lose_fat', weights: weights(-0.05) });
    expect(a).toMatchObject({ status: 'suggest', deltaKcal: -100, newKcal: 2100 });
  });
  it('perder grasa y el peso sube → −150 o −200', () => {
    expect(suggestAdjustment({ ...common, goal: 'lose_fat', weights: weights(0.15) }).deltaKcal).toBe(-150);
    expect(suggestAdjustment({ ...common, goal: 'lose_fat', weights: weights(0.4) }).deltaKcal).toBe(-200);
  });
  it('perder grasa a buen ritmo → todo bien', () => {
    expect(suggestAdjustment({ ...common, goal: 'lose_fat', weights: weights(-0.5) }).status).toBe('on_track');
  });
  it('perder más del 1 % semanal → +100 por seguridad', () => {
    expect(suggestAdjustment({ ...common, goal: 'lose_fat', weights: weights(-1.2) })).toMatchObject({ status: 'suggest', deltaKcal: 100 });
  });
  it('ganar músculo sin ganar peso → +100/+150/+200', () => {
    expect(suggestAdjustment({ ...common, goal: 'gain_muscle', weights: weights(0.0) }).deltaKcal).toBe(100);
    expect(suggestAdjustment({ ...common, goal: 'gain_muscle', weights: weights(-0.1) }).deltaKcal).toBe(150);
    expect(suggestAdjustment({ ...common, goal: 'gain_muscle', weights: weights(-0.4) }).deltaKcal).toBe(200);
    expect(suggestAdjustment({ ...common, goal: 'gain_muscle', weights: weights(0.25) }).status).toBe('on_track');
  });
  it('mantener: solo actúa si la deriva supera 0,25 kg/semana', () => {
    expect(suggestAdjustment({ ...common, goal: 'maintain', weights: weights(0.1) }).status).toBe('on_track');
    expect(suggestAdjustment({ ...common, goal: 'maintain', weights: weights(0.4) }).deltaKcal).toBe(-150);
    expect(suggestAdjustment({ ...common, goal: 'maintain', weights: weights(-0.6) }).deltaKcal).toBe(200);
  });
  it('pocos pesajes o poco tiempo → datos insuficientes', () => {
    expect(suggestAdjustment({ ...common, goal: 'lose_fat', weights: weights(0).slice(0, 3) }).status).toBe('insufficient_data');
    const cortos = [0, 1, 2, 3, 4].map((d) => ({ date: `2026-10-${String(20 + d).padStart(2, '0')}`, value: 80 }));
    expect(suggestAdjustment({ ...common, goal: 'lose_fat', weights: cortos }).status).toBe('insufficient_data');
  });
  it('si apenas registró comida no se toca nada', () => {
    expect(suggestAdjustment({ ...common, kcalDaysLogged: 5, goal: 'lose_fat', weights: weights(0) }).status).toBe('low_logging');
  });
  it('periodo de espera tras una decisión', () => {
    expect(suggestAdjustment({ ...common, lastDecisionDate: '2026-10-15', goal: 'lose_fat', weights: weights(0) }).status).toBe('cooldown');
    expect(suggestAdjustment({ ...common, lastDecisionDate: '2026-10-10', goal: 'lose_fat', weights: weights(0) }).status).toBe('suggest');
  });
  it('no baja por debajo del mínimo', () => {
    expect(suggestAdjustment({ ...common, currentKcal: 1550, goal: 'lose_fat', weights: weights(0.2) }).status).toBe('at_floor');
  });
  it('ignora pesajes fuera de las 2 últimas semanas', () => {
    const viejos = [{ date: '2026-08-01', value: 90 }, { date: '2026-08-10', value: 70 }, ...weights(-0.5)];
    expect(suggestAdjustment({ ...common, goal: 'lose_fat', weights: viejos }).status).toBe('on_track');
  });
});

describe('macrosForNewKcal', () => {
  it('mantiene proteína y grasa y ajusta carbohidratos', () => {
    expect(macrosForNewKcal(2100, 144, 77)).toEqual({ kcal: 2100, protein_g: 144, fat_g: 77, carbs_g: 208 });
    expect(macrosForNewKcal(500, 144, 77).carbs_g).toBe(0);
  });
});

describe('sessionBests', () => {
  it('mejor peso y 1RM por sesión en orden cronológico', () => {
    const r = sessionBests([
      { session_id: 'b', weight_kg: 62.5, reps: 8, created_at: '2026-10-20T10:00:00Z' },
      { session_id: 'a', weight_kg: 60, reps: 8, created_at: '2026-10-10T10:00:00Z' },
      { session_id: 'a', weight_kg: 60, reps: 6, created_at: '2026-10-10T10:05:00Z' },
    ]);
    expect(r.map((s) => [s.sessionId, s.date, s.topWeightKg])).toEqual([['a', '2026-10-10', 60], ['b', '2026-10-20', 62.5]]);
    expect(r[0].est1RM).toBe(76);
  });
});

describe('niceTicks', () => {
  it('marcas redondas', () => {
    expect(niceTicks(0, 2759, 4)).toEqual([0, 1000, 2000, 3000]);
    expect(niceTicks(78.2, 81.9, 4)).toEqual([78, 79, 80, 81, 82]);
  });
  it('rango degenerado', () => {
    expect(niceTicks(5, 5)).toEqual([5]);
  });
});
