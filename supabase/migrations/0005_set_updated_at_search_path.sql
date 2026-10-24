-- Fija el search_path de la función de los triggers de updated_at (aviso "function_search_path_mutable"
-- del asesor de seguridad de Supabase). La función solo usa now(), que vive en pg_catalog y siempre se resuelve.
alter function public.set_updated_at() set search_path = '';
