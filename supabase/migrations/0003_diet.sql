-- Fase 3: dieta (alimentos, recetas, diario por comidas, agua, favoritas y planificador semanal).

-- Objetivo de agua diario (ml), editable desde Perfil.
alter table public.profiles
  add column water_goal_ml integer not null default 2500 check (water_goal_ml between 500 and 10000);

-- Alimentos del usuario: creados a mano o guardados desde Open Food Facts. Valores por 100 g.
create table public.foods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  source text not null default 'custom' check (source in ('custom', 'off')),
  barcode text check (barcode ~ '^[0-9]{6,14}$'),
  name text not null check (char_length(name) between 1 and 120),
  brand text not null default '' check (char_length(brand) <= 120),
  serving_g numeric(7, 2) not null default 100 check (serving_g > 0 and serving_g <= 5000),
  kcal_100g numeric(7, 2) not null check (kcal_100g between 0 and 1000),
  protein_100g numeric(6, 2) not null check (protein_100g between 0 and 100),
  carbs_100g numeric(6, 2) not null check (carbs_100g between 0 and 100),
  fat_100g numeric(6, 2) not null check (fat_100g between 0 and 100),
  allergens text[] not null default '{}',
  created_at timestamptz not null default now()
);

create unique index foods_user_barcode_key on public.foods (user_id, barcode) where barcode is not null;
create index foods_user_name_idx on public.foods (user_id, lower(name));

alter table public.foods enable row level security;

create policy "foods_select_own" on public.foods
  for select to authenticated using (user_id = (select auth.uid()));
create policy "foods_insert_own" on public.foods
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "foods_update_own" on public.foods
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "foods_delete_own" on public.foods
  for delete to authenticated using (user_id = (select auth.uid()));

-- Recetas: `servings` es el número de raciones que salen; los macros por ración se calculan en la app.
create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  servings numeric(5, 2) not null default 1 check (servings > 0 and servings <= 100),
  notes text not null default '' check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

alter table public.recipes enable row level security;

create policy "recipes_select_own" on public.recipes
  for select to authenticated using (user_id = (select auth.uid()));
create policy "recipes_insert_own" on public.recipes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "recipes_update_own" on public.recipes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recipes_delete_own" on public.recipes
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.recipe_items (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  food_id uuid not null references public.foods (id) on delete restrict,
  grams numeric(8, 2) not null check (grams > 0 and grams <= 20000),
  position smallint not null default 0 check (position >= 0)
);

create index recipe_items_recipe_idx on public.recipe_items (recipe_id, position);
create index recipe_items_food_idx on public.recipe_items (food_id);

alter table public.recipe_items enable row level security;

create policy "recipe_items_select_own" on public.recipe_items
  for select to authenticated using (user_id = (select auth.uid()));
create policy "recipe_items_insert_own" on public.recipe_items
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid()))
  );
create policy "recipe_items_update_own" on public.recipe_items
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.recipes r where r.id = recipe_id and r.user_id = (select auth.uid()))
    and exists (select 1 from public.foods f where f.id = food_id and f.user_id = (select auth.uid()))
  );
create policy "recipe_items_delete_own" on public.recipe_items
  for delete to authenticated using (user_id = (select auth.uid()));

-- Guarda una receta completa (cabecera + ingredientes) en una sola transacción.
create or replace function public.save_recipe(
  p_id uuid,
  p_name text,
  p_servings numeric,
  p_notes text,
  p_items jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
  v_user uuid := auth.uid();
begin
  if v_user is null then
    raise exception 'not authenticated';
  end if;

  if p_id is null then
    insert into public.recipes (user_id, name, servings, notes)
    values (v_user, p_name, p_servings, p_notes)
    returning id into v_id;
  else
    update public.recipes
       set name = p_name, servings = p_servings, notes = p_notes
     where id = p_id and user_id = v_user
    returning id into v_id;
    if v_id is null then
      raise exception 'recipe not found';
    end if;
    delete from public.recipe_items where recipe_id = v_id;
  end if;

  insert into public.recipe_items (recipe_id, user_id, food_id, grams, position)
  select v_id, v_user, i.food_id, i.grams, i.position
    from jsonb_to_recordset(p_items) as i(food_id uuid, grams numeric, position smallint);

  return v_id;
end;
$$;

revoke all on function public.save_recipe(uuid, text, numeric, text, jsonb) from public, anon;
grant execute on function public.save_recipe(uuid, text, numeric, text, jsonb) to authenticated;

-- Diario. Cada fila guarda una copia (snapshot) de nombre y macros del momento, de modo que
-- editar o borrar un alimento después no cambia el historial.
create table public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  meal text not null check (meal in ('desayuno', 'comida', 'merienda', 'cena', 'snacks')),
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  quantity_g numeric(8, 2) check (quantity_g > 0),
  servings numeric(6, 2) check (servings > 0),
  kcal numeric(8, 2) not null check (kcal >= 0),
  protein_g numeric(7, 2) not null check (protein_g >= 0),
  carbs_g numeric(7, 2) not null check (carbs_g >= 0),
  fat_g numeric(7, 2) not null check (fat_g >= 0),
  created_at timestamptz not null default now(),
  check (quantity_g is not null or servings is not null)
);

create index meal_logs_user_date_idx on public.meal_logs (user_id, log_date);

alter table public.meal_logs enable row level security;

create policy "meal_logs_select_own" on public.meal_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "meal_logs_insert_own" on public.meal_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meal_logs_update_own" on public.meal_logs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "meal_logs_delete_own" on public.meal_logs
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.water_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  log_date date not null,
  ml integer not null check (ml between 1 and 5000),
  created_at timestamptz not null default now()
);

create index water_logs_user_date_idx on public.water_logs (user_id, log_date);

alter table public.water_logs enable row level security;

create policy "water_logs_select_own" on public.water_logs
  for select to authenticated using (user_id = (select auth.uid()));
create policy "water_logs_insert_own" on public.water_logs
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "water_logs_update_own" on public.water_logs
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "water_logs_delete_own" on public.water_logs
  for delete to authenticated using (user_id = (select auth.uid()));

-- Comidas favoritas: lista de alimentos (con sus macros) que se puede añadir a cualquier día.
create table public.favorite_meals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 50),
  created_at timestamptz not null default now()
);

alter table public.favorite_meals enable row level security;

create policy "favorite_meals_select_own" on public.favorite_meals
  for select to authenticated using (user_id = (select auth.uid()));
create policy "favorite_meals_insert_own" on public.favorite_meals
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "favorite_meals_update_own" on public.favorite_meals
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "favorite_meals_delete_own" on public.favorite_meals
  for delete to authenticated using (user_id = (select auth.uid()));

-- Planificador semanal (opcional): mismo formato que el diario pero por día de la semana ISO (1 = lunes).
create table public.meal_plan_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  weekday smallint not null check (weekday between 1 and 7),
  meal text not null check (meal in ('desayuno', 'comida', 'merienda', 'cena', 'snacks')),
  food_id uuid references public.foods (id) on delete set null,
  recipe_id uuid references public.recipes (id) on delete set null,
  name text not null check (char_length(name) between 1 and 160),
  quantity_g numeric(8, 2) check (quantity_g > 0),
  servings numeric(6, 2) check (servings > 0),
  kcal numeric(8, 2) not null check (kcal >= 0),
  protein_g numeric(7, 2) not null check (protein_g >= 0),
  carbs_g numeric(7, 2) not null check (carbs_g >= 0),
  fat_g numeric(7, 2) not null check (fat_g >= 0),
  created_at timestamptz not null default now(),
  check (quantity_g is not null or servings is not null)
);

create index meal_plan_entries_user_idx on public.meal_plan_entries (user_id, weekday);

alter table public.meal_plan_entries enable row level security;

create policy "meal_plan_entries_select_own" on public.meal_plan_entries
  for select to authenticated using (user_id = (select auth.uid()));
create policy "meal_plan_entries_insert_own" on public.meal_plan_entries
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "meal_plan_entries_update_own" on public.meal_plan_entries
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "meal_plan_entries_delete_own" on public.meal_plan_entries
  for delete to authenticated using (user_id = (select auth.uid()));
