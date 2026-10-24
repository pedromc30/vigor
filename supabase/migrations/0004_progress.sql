-- Fase 4: progreso (peso, perímetros y fotos privadas).

-- Una fila por día; cada medida es opcional pero la fila debe tener al menos una.
create table public.body_metrics (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  measured_on date not null,
  weight_kg numeric(5, 1) check (weight_kg between 30 and 300),
  waist_cm numeric(4, 1) check (waist_cm between 30 and 250),
  hip_cm numeric(4, 1) check (hip_cm between 30 and 250),
  arm_cm numeric(4, 1) check (arm_cm between 10 and 100),
  thigh_cm numeric(4, 1) check (thigh_cm between 20 and 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, measured_on),
  check (weight_kg is not null or waist_cm is not null or hip_cm is not null or arm_cm is not null or thigh_cm is not null)
);

alter table public.body_metrics enable row level security;

create policy "body_metrics_select_own" on public.body_metrics
  for select to authenticated using (user_id = (select auth.uid()));
create policy "body_metrics_insert_own" on public.body_metrics
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "body_metrics_update_own" on public.body_metrics
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "body_metrics_delete_own" on public.body_metrics
  for delete to authenticated using (user_id = (select auth.uid()));

create trigger body_metrics_set_updated_at
  before update on public.body_metrics
  for each row execute function public.set_updated_at();

-- Fotos de progreso: el archivo vive en un bucket PRIVADO y la ruta empieza por el id del usuario.
create table public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  taken_on date not null,
  storage_path text not null unique,
  note text not null default '' check (char_length(note) <= 200),
  created_at timestamptz not null default now(),
  check (storage_path like user_id::text || '/%')
);

create index progress_photos_user_idx on public.progress_photos (user_id, taken_on desc);

alter table public.progress_photos enable row level security;

create policy "progress_photos_select_own" on public.progress_photos
  for select to authenticated using (user_id = (select auth.uid()));
create policy "progress_photos_insert_own" on public.progress_photos
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "progress_photos_update_own" on public.progress_photos
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "progress_photos_delete_own" on public.progress_photos
  for delete to authenticated using (user_id = (select auth.uid()));

-- Bucket privado (no público): solo se accede con URL firmadas temporales.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

-- Cada usuario solo ve, sube y borra archivos dentro de su carpeta «<user_id>/…».
create policy "progress_photos_files_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_files_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress_photos_files_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
