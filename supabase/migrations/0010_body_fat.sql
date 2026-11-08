-- % de grasa corporal opcional, para calcular el gasto basal con Katch-McArdle (masa magra).
-- Es aditiva y opcional: sin valor, la app sigue usando Mifflin-St Jeor.
alter table public.profiles
  add column if not exists body_fat_pct numeric(4, 1) check (body_fat_pct between 3 and 60);
