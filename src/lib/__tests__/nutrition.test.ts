import {
  bmr,
  computePlan,
  defaultMacros,
  macrosKcal,
  targetKcal,
  tdee,
  type PlanInput,
} from '../nutrition';

const male: PlanInput = {
  sex: 'male',
  age: 30,
  heightCm: 180,
  weightKg: 80,
  activityLevel: 'moderate',
  goal: 'maintain',
};

describe('bmr (Mifflin-St Jeor)', () => {
  it('hombre 30 a, 180 cm, 80 kg', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(bmr(male)).toBeCloseTo(1780, 5);
  });

  it('mujer 25 a, 165 cm, 60 kg', () => {
    // 10*60 + 6.25*165 - 5*25 - 161 = 1345.25
    expect(bmr({ sex: 'female', age: 25, heightCm: 165, weightKg: 60 })).toBeCloseTo(1345.25, 5);
  });
});

describe('tdee', () => {
  it('aplica el factor de actividad', () => {
    expect(tdee(male)).toBeCloseTo(1780 * 1.55, 5);
    expect(tdee({ ...male, activityLevel: 'sedentary' })).toBeCloseTo(1780 * 1.2, 5);
  });
});

describe('targetKcal', () => {
  it('déficit del 17,5 % para perder grasa', () => {
    expect(targetKcal(2759, 'lose_fat', 'male')).toEqual({ kcal: Math.round(2759 * 0.825), floorApplied: false });
  });

  it('superávit del 7,5 % para ganar músculo', () => {
    expect(targetKcal(2759, 'gain_muscle', 'male').kcal).toBe(Math.round(2759 * 1.075));
  });

  it('respeta el suelo calórico', () => {
    expect(targetKcal(1300, 'lose_fat', 'female')).toEqual({ kcal: 1200, floorApplied: true });
    expect(targetKcal(1700, 'lose_fat', 'male')).toEqual({ kcal: 1500, floorApplied: true });
  });
});

describe('defaultMacros', () => {
  it('cumple mínimos de proteína y grasa y cuadra las kcal', () => {
    for (const goal of ['lose_fat', 'maintain', 'gain_muscle'] as const) {
      const kcal = 2400;
      const m = defaultMacros(kcal, 80, goal);
      expect(m.proteinG / 80).toBeGreaterThanOrEqual(1.6);
      expect(m.proteinG / 80).toBeLessThanOrEqual(2.2 + 0.01);
      expect(m.fatG / 80).toBeGreaterThanOrEqual(0.8);
      expect(m.carbsG).toBeGreaterThan(0);
      expect(Math.abs(macrosKcal(m) - kcal)).toBeLessThanOrEqual(10);
      expect(m.warnings).toEqual([]);
    }
  });

  it('recorta grasa y luego proteína cuando no caben', () => {
    // 60 kg con solo 1000 kcal: 2,2 g/kg proteína (528 kcal) + grasa 25 % no caben con carbos >= 0
    const m = defaultMacros(1000, 60, 'lose_fat');
    expect(m.fatG / 60).toBeGreaterThanOrEqual(0.8 - 0.01);
    expect(m.carbsG).toBeGreaterThanOrEqual(0);
  });

  it('avisa si ni con los mínimos caben los macros', () => {
    const m = defaultMacros(800, 100, 'lose_fat');
    expect(m.carbsG).toBe(0);
    expect(m.warnings).toContain('macros_exceed_kcal');
  });
});

describe('computePlan', () => {
  it('hombre 30 a, 180 cm, 80 kg, activo moderado, mantener', () => {
    const p = computePlan(male);
    expect(p.bmr).toBe(1780);
    expect(p.tdee).toBe(2759);
    expect(p.kcal).toBe(2759);
    expect(p.proteinG).toBe(144);
    expect(p.fatG).toBe(77);
    expect(p.carbsG).toBe(Math.round((2759 - 144 * 4 - 77 * 9) / 4));
    expect(p.warnings).toEqual([]);
  });

  it('marca el suelo calórico aplicado', () => {
    const p = computePlan({
      sex: 'female',
      age: 60,
      heightCm: 150,
      weightKg: 45,
      activityLevel: 'sedentary',
      goal: 'lose_fat',
    });
    expect(p.kcal).toBe(1200);
    expect(p.warnings).toContain('kcal_floor_applied');
  });
});
