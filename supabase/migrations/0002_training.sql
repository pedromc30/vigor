-- Fase 2: entreno (ejercicios, rutinas, sesiones y series) con RLS.

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  -- null = catálogo común (solo lectura); con valor = ejercicio propio del usuario
  user_id uuid references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 80),
  muscle_group text not null check (muscle_group in (
    'pecho', 'espalda', 'hombros', 'biceps', 'triceps', 'antebrazos',
    'cuadriceps', 'isquiotibiales', 'gluteos', 'gemelos', 'core')),
  equipment text not null check (equipment in (
    'barra', 'mancuernas', 'maquina', 'polea', 'peso_corporal', 'kettlebell', 'banda', 'otro')),
  description text not null default '' check (char_length(description) <= 1000),
  created_at timestamptz not null default now()
);

create unique index exercises_catalog_name_key on public.exercises (lower(name)) where user_id is null;
create unique index exercises_user_name_key on public.exercises (user_id, lower(name)) where user_id is not null;

alter table public.exercises enable row level security;

create policy "exercises_select" on public.exercises
  for select to authenticated using (user_id is null or user_id = (select auth.uid()));
create policy "exercises_insert_own" on public.exercises
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "exercises_update_own" on public.exercises
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exercises_delete_own" on public.exercises
  for delete to authenticated using (user_id = (select auth.uid()));

-- Rutinas: una rutina tiene varios días; schedule[i] es el día de la semana ISO (1=lun..7=dom)
-- en que se programa el día i, o 0 si no tiene día fijo.
create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  notes text not null default '' check (char_length(notes) <= 1000),
  day_names text[] not null,
  schedule smallint[] not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(day_names) between 1 and 7),
  check (cardinality(schedule) = cardinality(day_names))
);

alter table public.routines enable row level security;

create policy "routines_select_own" on public.routines
  for select to authenticated using (user_id = (select auth.uid()));
create policy "routines_insert_own" on public.routines
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "routines_update_own" on public.routines
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "routines_delete_own" on public.routines
  for delete to authenticated using (user_id = (select auth.uid()));

create trigger routines_set_updated_at
  before update on public.routines
  for each row execute function public.set_updated_at();

create table public.routine_exercises (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  day_index smallint not null check (day_index between 0 and 6),
  position smallint not null check (position >= 0),
  sets smallint not null check (sets between 1 and 20),
  reps_target smallint not null check (reps_target between 1 and 100),
  rest_seconds smallint not null default 90 check (rest_seconds between 0 and 900),
  notes text not null default '' check (char_length(notes) <= 500)
);

create index routine_exercises_routine_idx on public.routine_exercises (routine_id, day_index, position);
create index routine_exercises_exercise_idx on public.routine_exercises (exercise_id);

alter table public.routine_exercises enable row level security;

create policy "routine_exercises_select_own" on public.routine_exercises
  for select to authenticated using (user_id = (select auth.uid()));
create policy "routine_exercises_insert_own" on public.routine_exercises
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid()))
  );
create policy "routine_exercises_update_own" on public.routine_exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid()))
  );
create policy "routine_exercises_delete_own" on public.routine_exercises
  for delete to authenticated using (user_id = (select auth.uid()));

-- Guarda una rutina completa (cabecera + ejercicios) en una sola transacción.
-- p_id null = crear. Corre con los permisos del usuario, así que aplica RLS.
create or replace function public.save_routine(
  p_id uuid,
  p_name text,
  p_notes text,
  p_day_names text[],
  p_schedule smallint[],
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
    insert into public.routines (user_id, name, notes, day_names, schedule)
    values (v_user, p_name, p_notes, p_day_names, p_schedule)
    returning id into v_id;
  else
    update public.routines
       set name = p_name, notes = p_notes, day_names = p_day_names, schedule = p_schedule
     where id = p_id and user_id = v_user
    returning id into v_id;
    if v_id is null then
      raise exception 'routine not found';
    end if;
    delete from public.routine_exercises where routine_id = v_id;
  end if;

  insert into public.routine_exercises
    (routine_id, user_id, exercise_id, day_index, position, sets, reps_target, rest_seconds, notes)
  select v_id, v_user, i.exercise_id, i.day_index, i.position, i.sets, i.reps_target,
         i.rest_seconds, coalesce(i.notes, '')
    from jsonb_to_recordset(p_items) as i(
      exercise_id uuid, day_index smallint, position smallint, sets smallint,
      reps_target smallint, rest_seconds smallint, notes text);

  return v_id;
end;
$$;

revoke all on function public.save_routine(uuid, text, text, text[], smallint[], jsonb) from public, anon;
grant execute on function public.save_routine(uuid, text, text, text[], smallint[], jsonb) to authenticated;

-- Sesiones de entreno. `plan` es una copia del plan en el momento de empezar:
-- [{exercise_id, name, muscle_group, sets, reps_target, rest_seconds, notes}]
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  routine_id uuid references public.routines (id) on delete set null,
  routine_name text not null check (char_length(routine_name) between 1 and 120),
  plan jsonb not null default '[]'::jsonb,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  notes text not null default '' check (char_length(notes) <= 1000),
  check (finished_at is null or finished_at >= started_at)
);

create index workout_sessions_user_idx on public.workout_sessions (user_id, started_at desc);

alter table public.workout_sessions enable row level security;

create policy "workout_sessions_select_own" on public.workout_sessions
  for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_sessions_insert_own" on public.workout_sessions
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "workout_sessions_update_own" on public.workout_sessions
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_sessions_delete_own" on public.workout_sessions
  for delete to authenticated using (user_id = (select auth.uid()));

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  position smallint not null check (position >= 0),
  set_index smallint not null check (set_index >= 0),
  weight_kg numeric(6, 2) not null check (weight_kg between 0 and 1000),
  reps smallint not null check (reps between 1 and 200),
  rpe numeric(3, 1) check (rpe between 1 and 10),
  target_reps smallint check (target_reps between 1 and 100),
  created_at timestamptz not null default now(),
  unique (session_id, position, set_index)
);

create index workout_sets_user_exercise_idx on public.workout_sets (user_id, exercise_id, created_at desc);
create index workout_sets_user_date_idx on public.workout_sets (user_id, created_at desc);

alter table public.workout_sets enable row level security;

create policy "workout_sets_select_own" on public.workout_sets
  for select to authenticated using (user_id = (select auth.uid()));
create policy "workout_sets_insert_own" on public.workout_sets
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
create policy "workout_sets_update_own" on public.workout_sets
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid()))
  );
create policy "workout_sets_delete_own" on public.workout_sets
  for delete to authenticated using (user_id = (select auth.uid()));

-- Catálogo común de ejercicios (user_id null).
insert into public.exercises (name, muscle_group, equipment, description) values
  ('Press de banca con barra', 'pecho', 'barra', 'Tumbado en el banco, baja la barra hasta rozar el pecho y empuja hasta extender los codos.'),
  ('Press inclinado con mancuernas', 'pecho', 'mancuernas', 'En banco inclinado, empuja las mancuernas desde la altura del pecho hasta estirar los brazos.'),
  ('Aperturas con mancuernas', 'pecho', 'mancuernas', 'Tumbado, abre los brazos con los codos ligeramente flexionados y vuelve a juntarlos sobre el pecho.'),
  ('Fondos en paralelas', 'pecho', 'peso_corporal', 'Sujeto en las paralelas, baja flexionando los codos con el torso inclinado y sube empujando.'),
  ('Flexiones', 'pecho', 'peso_corporal', 'Con el cuerpo recto y las manos al ancho de los hombros, baja el pecho al suelo y empuja.'),
  ('Cruce de poleas', 'pecho', 'polea', 'De pie entre dos poleas altas, junta las manos frente al pecho con los codos ligeramente flexionados.'),
  ('Press de pecho en máquina', 'pecho', 'maquina', 'Sentado, empuja las asas hacia delante hasta extender los brazos sin bloquear los codos.'),
  ('Dominadas', 'espalda', 'peso_corporal', 'Colgado de la barra, tira hasta pasar la barbilla por encima y baja de forma controlada.'),
  ('Jalón al pecho', 'espalda', 'polea', 'Sentado, tira de la barra hacia la parte alta del pecho llevando los codos hacia abajo.'),
  ('Remo con barra', 'espalda', 'barra', 'Con el torso inclinado y la espalda recta, tira de la barra hacia el abdomen.'),
  ('Remo con mancuerna a una mano', 'espalda', 'mancuernas', 'Apoyado en un banco, tira de la mancuerna hacia la cadera manteniendo el torso estable.'),
  ('Remo en polea baja', 'espalda', 'polea', 'Sentado, tira del agarre hacia el abdomen juntando los omóplatos.'),
  ('Peso muerto convencional', 'espalda', 'barra', 'Levanta la barra desde el suelo extendiendo caderas y rodillas con la espalda neutra.'),
  ('Remo en máquina', 'espalda', 'maquina', 'Sentado con el pecho apoyado, tira de las asas hacia atrás juntando los omóplatos.'),
  ('Press militar con barra', 'hombros', 'barra', 'De pie, empuja la barra desde los hombros hasta estirar los brazos sobre la cabeza.'),
  ('Press de hombros con mancuernas', 'hombros', 'mancuernas', 'Sentado, empuja las mancuernas desde los hombros hasta estirar los brazos.'),
  ('Elevaciones laterales', 'hombros', 'mancuernas', 'De pie, eleva las mancuernas hacia los lados hasta la altura de los hombros.'),
  ('Pájaros con mancuernas', 'hombros', 'mancuernas', 'Con el torso inclinado, abre los brazos hacia los lados para trabajar el deltoides posterior.'),
  ('Face pull', 'hombros', 'polea', 'Tira de la cuerda hacia la cara con los codos altos, separando las manos al final.'),
  ('Curl con barra', 'biceps', 'barra', 'De pie, flexiona los codos para subir la barra sin balancear el cuerpo.'),
  ('Curl con mancuernas alterno', 'biceps', 'mancuernas', 'Flexiona un codo cada vez girando la muñeca hacia arriba.'),
  ('Curl martillo', 'biceps', 'mancuernas', 'Con agarre neutro (palmas enfrentadas), flexiona los codos subiendo las mancuernas.'),
  ('Curl predicador', 'biceps', 'barra', 'Con los brazos apoyados en el banco predicador, flexiona los codos y baja de forma controlada.'),
  ('Press francés con barra', 'triceps', 'barra', 'Tumbado, flexiona solo los codos para bajar la barra hacia la frente y extiende.'),
  ('Extensión de tríceps en polea', 'triceps', 'polea', 'De pie, empuja la barra o cuerda hacia abajo extendiendo los codos pegados al cuerpo.'),
  ('Fondos en banco', 'triceps', 'peso_corporal', 'Con las manos apoyadas en un banco detrás de ti, baja flexionando los codos y sube.'),
  ('Extensión de tríceps sobre la cabeza', 'triceps', 'mancuernas', 'Con una mancuerna sujeta con ambas manos tras la nuca, extiende los codos hacia arriba.'),
  ('Curl de muñeca', 'antebrazos', 'barra', 'Con los antebrazos apoyados y las palmas hacia arriba, flexiona las muñecas para subir la barra.'),
  ('Sentadilla con barra', 'cuadriceps', 'barra', 'Con la barra sobre los trapecios, baja flexionando cadera y rodillas y sube empujando el suelo.'),
  ('Prensa de piernas', 'cuadriceps', 'maquina', 'Sentado en la máquina, empuja la plataforma con los pies y vuelve controlando.'),
  ('Extensión de cuádriceps', 'cuadriceps', 'maquina', 'Sentado, extiende las rodillas para elevar el rodillo y baja despacio.'),
  ('Zancadas con mancuernas', 'cuadriceps', 'mancuernas', 'Da un paso largo al frente, baja hasta que la rodilla trasera roce el suelo y vuelve.'),
  ('Sentadilla búlgara', 'cuadriceps', 'mancuernas', 'Con el pie trasero apoyado en un banco, baja flexionando la pierna delantera y sube.'),
  ('Sentadilla goblet', 'cuadriceps', 'kettlebell', 'Sujeta la pesa contra el pecho y haz una sentadilla profunda con el torso erguido.'),
  ('Curl femoral tumbado', 'isquiotibiales', 'maquina', 'Tumbado boca abajo, flexiona las rodillas llevando el rodillo hacia los glúteos.'),
  ('Peso muerto rumano', 'isquiotibiales', 'barra', 'Con las rodillas ligeramente flexionadas, baja la barra por las piernas llevando la cadera atrás.'),
  ('Hip thrust con barra', 'gluteos', 'barra', 'Con la espalda alta apoyada en un banco, sube la cadera con la barra hasta alinear tronco y muslos.'),
  ('Patada de glúteo en polea', 'gluteos', 'polea', 'Con una tobillera en la polea baja, extiende la pierna hacia atrás sin arquear la espalda.'),
  ('Puente de glúteo', 'gluteos', 'peso_corporal', 'Tumbado boca arriba con las rodillas flexionadas, eleva la cadera y aprieta los glúteos.'),
  ('Elevación de talones de pie', 'gemelos', 'maquina', 'De pie, sube sobre las puntas de los pies hasta el máximo y baja estirando el gemelo.'),
  ('Elevación de talones sentado', 'gemelos', 'maquina', 'Sentado con las rodillas flexionadas, eleva los talones empujando con la punta del pie.'),
  ('Plancha', 'core', 'peso_corporal', 'Apoyado en antebrazos y puntas de los pies, mantén el cuerpo recto y el abdomen contraído.'),
  ('Crunch abdominal', 'core', 'peso_corporal', 'Tumbado con las rodillas flexionadas, eleva los hombros del suelo contrayendo el abdomen.'),
  ('Elevación de piernas colgado', 'core', 'peso_corporal', 'Colgado de una barra, eleva las piernas sin balancear el cuerpo.'),
  ('Rueda abdominal', 'core', 'otro', 'De rodillas, rueda hacia delante extendiendo el cuerpo y vuelve contrayendo el abdomen.'),
  ('Press Pallof', 'core', 'polea', 'De lado a la polea, empuja el agarre al frente del pecho resistiendo la rotación del tronco.');
