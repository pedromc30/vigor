-- Objetivos por ejercicio y logros (objetivos conseguidos y récords personales).
-- Es aditiva: no toca ninguna tabla existente.

-- ---------- Objetivos ----------
-- Un objetivo es «peso × repeticiones» sobre un ejercicio y se cumple con una serie normal que alcance ambos valores.
--   kind = 'weight': el objetivo es una carga (p. ej. sentadilla 100 kg × 1).
--   kind = 'reps'  : el objetivo son repeticiones con un peso dado (p. ej. dominadas 12 reps con peso corporal = 0 kg).
-- El progreso en % se calcula en la app a partir del historial.
create table public.exercise_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind text not null check (kind in ('weight', 'reps')),
  target_weight_kg numeric(6, 2) not null check (target_weight_kg between 0 and 1000),
  target_reps smallint not null check (target_reps between 1 and 200),
  achieved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- un objetivo de carga necesita una carga (el peso corporal, 0 kg, solo tiene sentido en objetivos de repeticiones)
  check (kind <> 'weight' or target_weight_kg > 0)
);

create index exercise_goals_user_exercise_idx on public.exercise_goals (user_id, exercise_id);

alter table public.exercise_goals enable row level security;

create policy "exercise_goals_select_own" on public.exercise_goals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "exercise_goals_insert_own" on public.exercise_goals
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid())))
  );
create policy "exercise_goals_update_own" on public.exercise_goals
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid())))
  );
create policy "exercise_goals_delete_own" on public.exercise_goals
  for delete to authenticated using (user_id = (select auth.uid()));

create trigger exercise_goals_set_updated_at
  before update on public.exercise_goals
  for each row execute function public.set_updated_at();

-- ---------- Logros ----------
-- Un logro es un objetivo conseguido ('goal') o un récord personal: de carga, de repeticiones o de 1RM estimado.
-- Está ligado a la serie que lo consiguió: si esa serie o su sesión se borran, el logro desaparece con ellas.
create table public.achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete cascade,
  kind text not null check (kind in ('goal', 'pr_weight', 'pr_reps', 'pr_1rm')),
  -- valor del logro: kg (pr_weight, pr_1rm, goal de carga) o repeticiones (pr_reps, goal de repeticiones)
  value numeric(8, 2) not null check (value >= 0),
  -- la serie que lo consiguió
  weight_kg numeric(6, 2) not null check (weight_kg between 0 and 1000),
  reps smallint not null check (reps between 1 and 200),
  -- si se borra el objetivo, el logro se conserva en el historial
  goal_id uuid references public.exercise_goals (id) on delete set null,
  set_id uuid references public.workout_sets (id) on delete cascade,
  session_id uuid references public.workout_sessions (id) on delete cascade,
  achieved_at timestamptz not null default now()
);

create index achievements_user_date_idx on public.achievements (user_id, achieved_at desc);
create index achievements_set_idx on public.achievements (set_id);
-- Una serie no puede registrar dos veces el mismo récord, y un objetivo solo se consigue una vez a la vez.
create unique index achievements_set_kind_key on public.achievements (set_id, kind) where kind <> 'goal' and set_id is not null;
create unique index achievements_goal_key on public.achievements (goal_id) where goal_id is not null;

alter table public.achievements enable row level security;

create policy "achievements_select_own" on public.achievements
  for select to authenticated using (user_id = (select auth.uid()));
create policy "achievements_insert_own" on public.achievements
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.exercises e where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid())))
    and (set_id is null or exists (select 1 from public.workout_sets s where s.id = set_id and s.user_id = (select auth.uid())))
    and (goal_id is null or exists (select 1 from public.exercise_goals g where g.id = goal_id and g.user_id = (select auth.uid())))
  );
create policy "achievements_delete_own" on public.achievements
  for delete to authenticated using (user_id = (select auth.uid()));

-- Si desaparece el logro de un objetivo (porque se deshace o se borra la serie que lo consiguió), el objetivo vuelve a
-- estar pendiente. Se hace en la base de datos para cubrir todos los caminos (deshacer serie, borrar sesión…).
create or replace function public.reopen_goal_when_achievement_removed()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.kind = 'goal' and old.goal_id is not null then
    update public.exercise_goals set achieved_at = null where id = old.goal_id;
  end if;
  return old;
end;
$$;

create trigger achievements_reopen_goal
  after delete on public.achievements
  for each row execute function public.reopen_goal_when_achievement_removed();
