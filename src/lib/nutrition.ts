// Cálculo de gasto energético y objetivos de macros. Funciones puras, sin dependencias de React.

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active';
export type Goal = 'lose_fat' | 'maintain' | 'gain_muscle';

export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

// Déficit del 15-20 % (se usa el punto medio) y superávit del 5-10 % (idem).
export const GOAL_ADJUSTMENT: Record<Goal, number> = {
  lose_fat: -0.175,
  maintain: 0,
  gain_muscle: 0.075,
};

// Proteína en g/kg dentro del rango 1,6-2,2. Más alta en déficit para conservar masa magra.
export const PROTEIN_PER_KG: Record<Goal, number> = {
  lose_fat: 2.2,
  maintain: 1.8,
  gain_muscle: 1.8,
};

export const PROTEIN_MIN_PER_KG = 1.6;
export const FAT_MIN_PER_KG = 0.8;
const FAT_MIN_SHARE_OF_KCAL = 0.25;

// Suelo calórico orientativo para no proponer objetivos excesivamente bajos.
export const MIN_KCAL: Record<Sex, number> = { male: 1500, female: 1200 };

export const KCAL_PER_G = { protein: 4, carbs: 4, fat: 9 } as const;

export interface BodyData {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
}

export interface PlanInput extends BodyData {
  activityLevel: ActivityLevel;
  goal: Goal;
}

export interface Macros {
  proteinG: number;
  fatG: number;
  carbsG: number;
}

export type PlanWarning = 'kcal_floor_applied' | 'macros_exceed_kcal';

export interface NutritionPlan extends Macros {
  bmr: number;
  tdee: number;
  kcal: number;
  warnings: PlanWarning[];
}

/** Tasa metabólica basal, Mifflin-St Jeor (kcal/día). */
export function bmr({ sex, age, heightCm, weightKg }: BodyData): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/** Gasto energético diario total = TMB × factor de actividad. */
export function tdee(input: PlanInput): number {
  return bmr(input) * ACTIVITY_FACTORS[input.activityLevel];
}

/** Energía (kcal) que aportan unos macros. */
export function macrosKcal({ proteinG, fatG, carbsG }: Macros): number {
  return proteinG * KCAL_PER_G.protein + fatG * KCAL_PER_G.fat + carbsG * KCAL_PER_G.carbs;
}

/**
 * Reparto por defecto: proteína por kg según objetivo, grasa = máx(0,8 g/kg, 25 % de kcal),
 * carbohidratos = resto. Si no cabe, se reduce primero la grasa hasta su mínimo y luego la
 * proteína hasta 1,6 g/kg; si aun así sobra, los carbohidratos quedan en 0 con un aviso.
 */
export function defaultMacros(kcal: number, weightKg: number, goal: Goal): Macros & { warnings: PlanWarning[] } {
  const warnings: PlanWarning[] = [];
  let protein = PROTEIN_PER_KG[goal] * weightKg;
  let fat = Math.max(FAT_MIN_PER_KG * weightKg, (FAT_MIN_SHARE_OF_KCAL * kcal) / KCAL_PER_G.fat);

  const carbsFor = () => (kcal - protein * KCAL_PER_G.protein - fat * KCAL_PER_G.fat) / KCAL_PER_G.carbs;

  if (carbsFor() < 0) fat = FAT_MIN_PER_KG * weightKg;
  if (carbsFor() < 0) protein = PROTEIN_MIN_PER_KG * weightKg;
  let carbs = carbsFor();
  if (carbs < 0) {
    carbs = 0;
    warnings.push('macros_exceed_kcal');
  }

  return {
    proteinG: Math.round(protein),
    fatG: Math.round(fat),
    carbsG: Math.round(carbs),
    warnings,
  };
}

/** Objetivo calórico a partir del gasto total y el objetivo, respetando el suelo calórico. */
export function targetKcal(totalExpenditure: number, goal: Goal, sex: Sex): { kcal: number; floorApplied: boolean } {
  const raw = totalExpenditure * (1 + GOAL_ADJUSTMENT[goal]);
  const floor = MIN_KCAL[sex];
  const floorApplied = raw < floor;
  return { kcal: Math.round(Math.max(raw, floor)), floorApplied };
}

export function computePlan(input: PlanInput): NutritionPlan {
  const basal = bmr(input);
  const total = basal * ACTIVITY_FACTORS[input.activityLevel];
  const { kcal, floorApplied } = targetKcal(total, input.goal, input.sex);
  const { warnings, ...macros } = defaultMacros(kcal, input.weightKg, input.goal);
  if (floorApplied) warnings.push('kcal_floor_applied');
  return { bmr: Math.round(basal), tdee: Math.round(total), kcal, warnings, ...macros };
}
