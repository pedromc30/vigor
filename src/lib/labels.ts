import type { ActivityLevel, Goal, Sex } from './nutrition';
import type { DietPreference } from './profile';

export const SEX_LABELS: Record<Sex, string> = { male: 'Hombre', female: 'Mujer' };

export const ACTIVITY_LABELS: Record<ActivityLevel, { title: string; hint: string }> = {
  sedentary: { title: 'Sedentario', hint: 'Poco o ningún ejercicio, trabajo de oficina' },
  light: { title: 'Ligero', hint: 'Ejercicio 1-3 días por semana' },
  moderate: { title: 'Moderado', hint: 'Ejercicio 3-5 días por semana' },
  active: { title: 'Activo', hint: 'Ejercicio intenso 6-7 días por semana' },
  very_active: { title: 'Muy activo', hint: 'Entrenamiento doble o trabajo físico exigente' },
};

export const GOAL_LABELS: Record<Goal, { title: string; hint: string }> = {
  lose_fat: { title: 'Perder grasa', hint: 'Déficit calórico del ~17 %' },
  maintain: { title: 'Mantener', hint: 'Calorías de mantenimiento' },
  gain_muscle: { title: 'Ganar músculo', hint: 'Superávit calórico del ~7,5 %' },
};

export const DIET_LABELS: Record<DietPreference, string> = {
  omnivore: 'Omnívoro',
  vegetarian: 'Vegetariano',
  vegan: 'Vegano',
};

// Los 14 alérgenos de declaración obligatoria en la UE + lactosa (intolerancia frecuente).
export const ALLERGEN_OPTIONS: { key: string; label: string }[] = [
  { key: 'gluten', label: 'Gluten' },
  { key: 'lactosa', label: 'Lactosa' },
  { key: 'lacteos', label: 'Lácteos' },
  { key: 'huevo', label: 'Huevo' },
  { key: 'pescado', label: 'Pescado' },
  { key: 'crustaceos', label: 'Crustáceos' },
  { key: 'moluscos', label: 'Moluscos' },
  { key: 'cacahuete', label: 'Cacahuete' },
  { key: 'frutos_secos', label: 'Frutos de cáscara' },
  { key: 'soja', label: 'Soja' },
  { key: 'apio', label: 'Apio' },
  { key: 'mostaza', label: 'Mostaza' },
  { key: 'sesamo', label: 'Sésamo' },
  { key: 'sulfitos', label: 'Sulfitos' },
  { key: 'altramuces', label: 'Altramuces' },
];

export const TRAINING_DAYS = [0, 1, 2, 3, 4, 5, 6, 7];

export const MUSCLE_GROUPS = [
  'pecho',
  'espalda',
  'hombros',
  'biceps',
  'triceps',
  'antebrazos',
  'cuadriceps',
  'isquiotibiales',
  'gluteos',
  'gemelos',
  'core',
] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  pecho: 'Pecho',
  espalda: 'Espalda',
  hombros: 'Hombros',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  antebrazos: 'Antebrazos',
  cuadriceps: 'Cuádriceps',
  isquiotibiales: 'Isquiotibiales',
  gluteos: 'Glúteos',
  gemelos: 'Gemelos',
  core: 'Core',
};

export const EQUIPMENT = ['barra', 'mancuernas', 'maquina', 'polea', 'peso_corporal', 'kettlebell', 'banda', 'otro'] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barra: 'Barra',
  mancuernas: 'Mancuernas',
  maquina: 'Máquina',
  polea: 'Polea',
  peso_corporal: 'Peso corporal',
  kettlebell: 'Kettlebell',
  banda: 'Banda elástica',
  otro: 'Otro',
};

/** Día de la semana ISO (1 = lunes … 7 = domingo); 0 = sin día fijo. */
export const WEEKDAY_SHORT: Record<number, string> = { 1: 'L', 2: 'M', 3: 'X', 4: 'J', 5: 'V', 6: 'S', 7: 'D' };
export const WEEKDAY_LONG: Record<number, string> = {
  1: 'lunes',
  2: 'martes',
  3: 'miércoles',
  4: 'jueves',
  5: 'viernes',
  6: 'sábado',
  7: 'domingo',
};
