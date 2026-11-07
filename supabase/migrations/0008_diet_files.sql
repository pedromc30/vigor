-- Archivos de dieta: documentos que adjunta el usuario (p. ej. la dieta que le da su dietista).
-- Es aditiva: no toca ninguna tabla existente. Mismo esquema de privacidad que las fotos de progreso.

create table public.diet_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  -- nombre que ve el usuario (el archivo se guarda en Storage con un nombre seguro generado)
  name text not null check (char_length(name) between 1 and 120),
  storage_path text not null unique,
  mime_type text not null,
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  check (storage_path like user_id::text || '/%')
);

create index diet_files_user_idx on public.diet_files (user_id, created_at desc);

alter table public.diet_files enable row level security;

create policy "diet_files_select_own" on public.diet_files
  for select to authenticated using (user_id = (select auth.uid()));
create policy "diet_files_insert_own" on public.diet_files
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "diet_files_update_own" on public.diet_files
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "diet_files_delete_own" on public.diet_files
  for delete to authenticated using (user_id = (select auth.uid()));

-- Bucket privado (no público): solo se accede con URL firmadas temporales. Hasta 10 MB por archivo.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'diet-files', 'diet-files', false, 10485760,
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
  ]
)
on conflict (id) do nothing;

-- Cada usuario solo ve, sube y borra archivos dentro de su carpeta «<user_id>/…».
create policy "diet_files_files_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'diet-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "diet_files_files_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'diet-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "diet_files_files_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'diet-files' and (storage.foldername(name))[1] = (select auth.uid())::text);
