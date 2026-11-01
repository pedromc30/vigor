import {
  isNormalSet,
  bestEstimated1RM,
  epley1RM,
  formatClock,
  formatDuration,
  formatKg,
  suggestNextWeight,
  targetsMet,
  volumeByMuscleGroup,
  weekStart,
} from '../training-math';

describe('epley1RM', () => {
  it('peso × (1 + reps/30)', () => {
    expect(epley1RM(100, 5)).toBeCloseTo(116.667, 3);
    expect(epley1RM(80, 10)).toBeCloseTo(106.667, 3);
  });
  it('con 1 repetición es el propio peso', () => {
    expect(epley1RM(140, 1)).toBe(140);
  });
  it('devuelve 0 con datos no válidos', () => {
    expect(epley1RM(0, 8)).toBe(0);
    expect(epley1RM(50, 0)).toBe(0);
  });
});

describe('bestEstimated1RM', () => {
  it('toma el mayor y descarta series de más de 12 repeticiones', () => {
    const best = bestEstimated1RM([
      { weightKg: 100, reps: 5 },
      { weightKg: 60, reps: 8 },
      { weightKg: 150, reps: 20 },
    ]);
    expect(best).toBeCloseTo(116.667, 3);
  });
  it('null si no hay datos válidos', () => {
    expect(bestEstimated1RM([])).toBeNull();
    expect(bestEstimated1RM([{ weightKg: 20, reps: 30 }])).toBeNull();
  });
});

describe('progresión', () => {
  const sets = (reps: number[], w = 60) => reps.map((r) => ({ weightKg: w, reps: r }));

  it('targetsMet exige todas las series con las repeticiones objetivo', () => {
    expect(targetsMet(sets([8, 8, 8]), 3, 8)).toBe(true);
    expect(targetsMet(sets([8, 8, 7]), 3, 8)).toBe(false);
    expect(targetsMet(sets([8, 8]), 3, 8)).toBe(false);
  });

  it('sugiere subir 2,5 kg si se cumplió todo', () => {
    expect(suggestNextWeight(sets([8, 9, 8]), 3, 8)).toBe(62.5);
  });

  it('no sugiere nada si falló alguna serie', () => {
    expect(suggestNextWeight(sets([8, 8, 6]), 3, 8)).toBeNull();
  });

  it('series extra con menos repeticiones no impiden la sugerencia', () => {
    expect(suggestNextWeight(sets([8, 8, 8, 5]), 3, 8)).toBe(62.5);
  });

  it('usa la mayor carga con la que se cumplió el objetivo', () => {
    const s = [
      { weightKg: 60, reps: 8 },
      { weightKg: 65, reps: 8 },
      { weightKg: 65, reps: 8 },
    ];
    expect(suggestNextWeight(s, 3, 8)).toBe(67.5);
  });

  it('no sugiere carga para ejercicios sin peso', () => {
    expect(suggestNextWeight(sets([12, 12, 12], 0), 3, 12)).toBeNull();
  });
});

describe('volumeByMuscleGroup', () => {
  it('agrupa series y kg×reps y ordena por series', () => {
    const v = volumeByMuscleGroup([
      { muscleGroup: 'pecho', weightKg: 80, reps: 8 },
      { muscleGroup: 'pecho', weightKg: 80, reps: 8 },
      { muscleGroup: 'espalda', weightKg: 50, reps: 10 },
      { muscleGroup: 'pecho', weightKg: 70, reps: 10 },
    ]);
    expect(v).toEqual([
      { muscleGroup: 'pecho', sets: 3, volumeKg: 80 * 8 + 80 * 8 + 70 * 10 },
      { muscleGroup: 'espalda', sets: 1, volumeKg: 500 },
    ]);
  });
});

describe('weekStart', () => {
  it('devuelve el lunes de esa semana', () => {
    // miércoles 21 oct 2026 → lunes 19
    const w = weekStart(new Date(2026, 9, 21, 15, 30));
    expect([w.getFullYear(), w.getMonth(), w.getDate(), w.getHours()]).toEqual([2026, 9, 19, 0]);
  });
  it('un domingo pertenece a la semana que empezó el lunes anterior', () => {
    const w = weekStart(new Date(2026, 9, 25, 10));
    expect(w.getDate()).toBe(19);
  });
  it('un lunes devuelve ese mismo día', () => {
    expect(weekStart(new Date(2026, 9, 19, 23, 59)).getDate()).toBe(19);
  });
});

describe('formato', () => {
  it('formatKg', () => {
    expect(formatKg(62.5)).toBe('62,5');
    expect(formatKg(60)).toBe('60');
  });
  it('formatDuration', () => {
    expect(formatDuration(540)).toBe('9 min');
    expect(formatDuration(3725)).toBe('1 h 02 min');
  });
  it('formatClock', () => {
    expect(formatClock(95)).toBe('1:35');
    expect(formatClock(-3)).toBe('0:00');
  });
});


describe('series de aproximación y dropsets', () => {
  const w = (weightKg: number, reps: number, type?: 'normal' | 'warmup' | 'dropset') => ({ weightKg, reps, type });

  it('isNormalSet: sin tipo es normal', () => {
    expect(isNormalSet({})).toBe(true);
    expect(isNormalSet({ type: 'normal' })).toBe(true);
    expect(isNormalSet({ type: 'warmup' })).toBe(false);
    expect(isNormalSet({ type: 'dropset' })).toBe(false);
  });

  it('el 1RM ignora las series de aproximación', () => {
    // Una aproximación ligera con pocas repeticiones no cambia el resultado; una pesada tampoco debe contar.
    expect(bestEstimated1RM([w(60, 8, 'normal'), w(200, 1, 'warmup')])).toBeCloseTo(epley1RM(60, 8), 5);
    expect(bestEstimated1RM([w(200, 1, 'warmup')])).toBeNull();
  });

  it('el 1RM sí cuenta los dropsets', () => {
    expect(bestEstimated1RM([w(100, 5, 'normal'), w(80, 8, 'dropset')])).toBeCloseTo(epley1RM(100, 5), 5);
  });

  it('el volumen semanal no cuenta la aproximación ni sus series', () => {
    const v = volumeByMuscleGroup([
      { muscleGroup: 'pecho', weightKg: 100, reps: 5, type: 'normal' },
      { muscleGroup: 'pecho', weightKg: 40, reps: 10, type: 'warmup' },
      { muscleGroup: 'pecho', weightKg: 80, reps: 8, type: 'dropset' },
      { muscleGroup: 'espalda', weightKg: 30, reps: 10, type: 'warmup' },
    ]);
    expect(v).toEqual([{ muscleGroup: 'pecho', sets: 2, volumeKg: 500 + 640 }]);
  });

  it('la progresión solo mira las series normales', () => {
    const normals = [w(60, 8), w(60, 8), w(60, 8)];
    // las aproximaciones y los dropsets no cuentan como series normales ni hacen subir la carga por sí solos
    expect(targetsMet([...normals.slice(0, 2), w(60, 8, 'warmup'), w(60, 8, 'dropset')], 3, 8)).toBe(false);
    expect(targetsMet([...normals, w(20, 3, 'warmup')], 3, 8)).toBe(true);
    // la mayor carga que cuenta no sale de una aproximación o dropset
    expect(suggestNextWeight([...normals, w(100, 12, 'warmup'), w(90, 12, 'dropset')], 3, 8)).toBe(62.5);
  });
});

describe('doble progresión (rango de repeticiones)', () => {
  const s = (reps: number[], w = 60) => reps.map((r) => ({ weightKg: w, reps: r }));
  // En un rango 6–8 el objetivo de progresión es el máximo (8) en todas las series normales.
  it('sube carga solo cuando todas las series normales llegan al máximo', () => {
    expect(suggestNextWeight(s([8, 8, 8]), 3, 8)).toBe(62.5);
    expect(suggestNextWeight(s([8, 7, 8]), 3, 8)).toBeNull();
    expect(suggestNextWeight(s([6, 6, 6]), 3, 8)).toBeNull();
  });
  it('en modo fijo (mínimo = máximo) funciona igual con ese número', () => {
    expect(suggestNextWeight(s([10, 10, 10]), 3, 10)).toBe(62.5);
    expect(suggestNextWeight(s([10, 10, 9]), 3, 10)).toBeNull();
  });
});
