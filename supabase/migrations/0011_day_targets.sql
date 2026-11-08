-- Objetivos de calorías y macros por día de la semana (p. ej. los que trae una dieta en PDF).
-- Formato: {"1": {"kcal": 2860, "protein_g": 217, "carbs_g": 358, "fat_g": 57}, ..., "7": {...}} (1 = lunes … 7 = domingo).
-- Es aditiva y opcional: sin valor, la app usa los objetivos generales de siempre.
alter table public.profiles
  add column if not exists day_targets jsonb check (day_targets is null or jsonb_typeof(day_targets) = 'object');
