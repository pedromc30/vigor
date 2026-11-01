-- Mejoras del módulo de entreno:
--   · rango de repeticiones por ejercicio de rutina (reps_min / reps_max; reps_target = reps_max se mantiene)
--   · tipo de serie (normal, aproximación, dropset) y orden propio de las series dentro de un ejercicio
-- Es aditiva y retrocompatible: los datos existentes se conservan y la versión anterior de la app sigue funcionando.

-- ---------- Rutinas: objetivo de repeticiones fijo o en rango ----------
alter table public.routine_exercises
  add column reps_min smallint,
  add column reps_max smallint;

-- Las filas existentes eran de repeticiones fijas: mínimo = máximo = reps_target.
update public.routine_exercises set reps_min = reps_target, reps_max = reps_target;

alter table public.routine_exercises
  alter column reps_min set not null,
  alter column reps_max set not null,
  add constraint routine_exercises_reps_min_check check (reps_min between 1 and 100),
  add constraint routine_exercises_reps_max_check check (reps_max between 1 and 100),
  add constraint routine_exercises_reps_range_check check (reps_min <= reps_max),
  -- reps_target se conserva (lo leen la versión anterior de la app y las exportaciones): siempre es el máximo.
  add constraint routine_exercises_reps_target_is_max check (reps_target = reps_max);

-- Guarda una rutina completa. Acepta reps_min / reps_max; si no vienen (versión anterior de la app),
-- se usa reps_target como valor fijo.
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
    (routine_id, user_id, exercise_id, day_index, position, sets, reps_target, reps_min, reps_max, rest_seconds, notes)
  select v_id, v_user, i.exercise_id, i.day_index, i.position, i.sets,
         coalesce(i.reps_max, i.reps_target),
         coalesce(i.reps_min, i.reps_max, i.reps_target),
         coalesce(i.reps_max, i.reps_target),
         i.rest_seconds, coalesce(i.notes, '')
    from jsonb_to_recordset(p_items) as i(
      exercise_id uuid, day_index smallint, position smallint, sets smallint,
      reps_target smallint, reps_min smallint, reps_max smallint, rest_seconds smallint, notes text);

  return v_id;
end;
$$;

revoke all on function public.save_routine(uuid, text, text, text[], smallint[], jsonb) from public, anon;
grant execute on function public.save_routine(uuid, text, text, text[], smallint[], jsonb) to authenticated;

-- ---------- Series: tipo y orden ----------
alter table public.workout_sets
  add column set_type text not null default 'normal'
    check (set_type in ('normal', 'warmup', 'dropset')),
  -- Posición de la serie dentro de su ejercicio. set_index sigue siendo su identidad (única por ejercicio y sesión);
  -- sort_order solo manda en el orden en pantalla, así se pueden insertar series intermedias sin renumerar identidades.
  add column sort_order smallint;

-- Las series ya guardadas conservan su orden actual.
update public.workout_sets set sort_order = set_index;
