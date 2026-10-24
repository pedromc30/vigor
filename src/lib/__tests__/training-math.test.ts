import {
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
