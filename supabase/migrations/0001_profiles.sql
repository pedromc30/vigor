-- Fase 1: perfil de usuario, RLS y borrado de cuenta.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  sex text check (sex in ('male', 'female')),
  age smallint check (age between 18 and 100),
  height_cm numeric(5, 1) check (height_cm between 120 and 230),
  weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'active', 'very_active')),
  goal text check (goal in ('lose_fat', 'maintain', 'gain_muscle')),
  training_days_per_week smallint check (training_days_per_week between 0 and 7),
  diet_preference text check (diet_preference in ('omnivore', 'vegetarian', 'vegan')),
  allergies text[] not null default '{}',

  -- Objetivos diarios (calculados o editados a mano)
  target_kcal integer check (target_kcal between 500 and 10000),
  target_protein_g integer check (target_protein_g between 0 and 1000),
  target_fat_g integer check (target_fat_g between 0 and 1000),
  target_carbs_g integer check (target_carbs_g between 0 and 2000),
  targets_manual boolean not null default false,

  -- RGPD: consentimiento explícito para tratar datos de salud
  health_consent_at timestamptz,
  consent_version text,
  onboarding_completed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated using (id = (select auth.uid()));

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Borrado de cuenta (RGPD): elimina el usuario de auth; las tablas con
-- "on delete cascade" sobre auth.users se vacían solas.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
