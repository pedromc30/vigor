import { supabase } from './supabase';
import { storagePath } from './diet-file-types';
import { selectAll } from './progress';

const BUCKET = 'diet-files';

export interface DietFile {
  id: string;
  name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export async function listDietFiles(): Promise<DietFile[]> {
  const { data, error } = await supabase.from('diet_files').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as DietFile[];
}

/** Sube el archivo al espacio privado y registra su fila; si falla la fila no se deja el archivo huérfano. */
export async function uploadDietFile(userId: string, file: { name: string; mime: string; ext: string; bytes: Uint8Array }): Promise<DietFile> {
  const path = storagePath(userId, file.ext, Date.now(), Math.random().toString(36).slice(2, 8));
  const up = await supabase.storage.from(BUCKET).upload(path, file.bytes, { contentType: file.mime, upsert: false });
  if (up.error) throw new Error(up.error.message);
  const { data, error } = await supabase
    .from('diet_files')
    .insert({ user_id: userId, name: file.name, storage_path: path, mime_type: file.mime, size_bytes: file.bytes.byteLength })
    .select('*')
    .single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(error.message);
  }
  return data as DietFile;
}

/** Descarga el contenido de un archivo guardado (por su URL firmada) para leerlo en el dispositivo. */
export async function downloadDietFile(file: DietFile): Promise<Uint8Array> {
  const res = await fetch(await dietFileUrl(file.storage_path));
  if (!res.ok) throw new Error('No se pudo descargar el archivo.');
  return new Uint8Array(await res.arrayBuffer());
}

/** URL temporal (1 h) para abrir o descargar el archivo: el espacio no es público. */
export async function dietFileUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) throw new Error(error?.message ?? 'No se pudo preparar el archivo.');
  return data.signedUrl;
}

/** Borra primero el archivo y después la fila; si falla el archivo no se toca la fila. */
export async function deleteDietFile(file: DietFile): Promise<void> {
  const rm = await supabase.storage.from(BUCKET).remove([file.storage_path]);
  if (rm.error) throw new Error(rm.error.message);
  const { error } = await supabase.from('diet_files').delete().eq('id', file.id);
  if (error) throw new Error(error.message);
}

/** Borra todos los archivos de dieta del usuario (Storage no se vacía solo al borrar la cuenta). */
export async function deleteAllDietFiles(): Promise<void> {
  const rows = await selectAll<{ storage_path: string }>((from, to) =>
    supabase.from('diet_files').select('storage_path').order('id').range(from, to),
  );
  const paths = rows.map((r) => r.storage_path);
  for (let i = 0; i < paths.length; i += 100) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths.slice(i, i + 100));
    if (error) throw new Error(error.message);
  }
}
