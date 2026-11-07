// Tipos y límites de los archivos de dieta adjuntos. Lógica pura, sin dependencias de React ni de Supabase.

export const DIET_FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB (el mismo límite del espacio de almacenamiento)

export interface DietFileType {
  ext: string;
  mime: string;
  label: string;
  icon: 'document-text-outline' | 'image-outline' | 'grid-outline' | 'document-outline';
}

export const DIET_FILE_TYPES: DietFileType[] = [
  { ext: 'pdf', mime: 'application/pdf', label: 'PDF', icon: 'document-text-outline' },
  { ext: 'jpg', mime: 'image/jpeg', label: 'Imagen', icon: 'image-outline' },
  { ext: 'jpeg', mime: 'image/jpeg', label: 'Imagen', icon: 'image-outline' },
  { ext: 'png', mime: 'image/png', label: 'Imagen', icon: 'image-outline' },
  { ext: 'webp', mime: 'image/webp', label: 'Imagen', icon: 'image-outline' },
  { ext: 'doc', mime: 'application/msword', label: 'Word', icon: 'document-outline' },
  { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', label: 'Word', icon: 'document-outline' },
  { ext: 'xls', mime: 'application/vnd.ms-excel', label: 'Excel', icon: 'grid-outline' },
  { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', label: 'Excel', icon: 'grid-outline' },
  { ext: 'csv', mime: 'text/csv', label: 'CSV', icon: 'grid-outline' },
  { ext: 'txt', mime: 'text/plain', label: 'Texto', icon: 'document-text-outline' },
];

/** Tipos MIME distintos aceptados (para el selector de archivos). */
export const DIET_FILE_MIMES = [...new Set(DIET_FILE_TYPES.map((t) => t.mime))];

const extOf = (name: string) => (name.includes('.') ? name.split('.').pop()!.toLowerCase() : '');

/** Nombre para mostrar: sin ruta, sin espacios de más y con un máximo de 120 caracteres (conservando la extensión). */
export function cleanFileName(name: string): string {
  const base = name.split(/[\\/]/).pop()!.replace(/\s+/g, ' ').trim();
  if (base.length <= 120) return base;
  const ext = extOf(base);
  const keep = ext ? 120 - ext.length - 1 : 120;
  return ext ? `${base.slice(0, keep)}.${ext}` : base.slice(0, keep);
}

export type ResolvedDietFile = { ok: true; name: string; mime: string; ext: string; type: DietFileType } | { ok: false; error: string };

/**
 * Comprueba un archivo elegido: tipo permitido (por su tipo MIME o, si el sistema no lo da, por su extensión) y tamaño.
 * Devuelve el nombre limpio y el tipo que se guardará.
 */
export function resolveDietFile(file: { name: string; mimeType?: string | null; size?: number | null }): ResolvedDietFile {
  const name = cleanFileName(file.name || 'archivo');
  const byExt = DIET_FILE_TYPES.find((t) => t.ext === extOf(name));
  const mimeType = file.mimeType?.toLowerCase();
  const byMime = mimeType ? DIET_FILE_TYPES.find((t) => t.mime === mimeType) : undefined;
  // Windows da a los .csv el tipo de Excel: manda la extensión.
  const type = byExt?.ext === 'csv' ? byExt : (byMime ?? byExt);
  if (!type) return { ok: false, error: 'Este tipo de archivo no está permitido. Puedes adjuntar PDF, imágenes, Word, Excel o texto.' };
  if (file.size != null && file.size <= 0) return { ok: false, error: 'El archivo está vacío.' };
  if (file.size != null && file.size > DIET_FILE_MAX_BYTES) {
    return { ok: false, error: `El archivo pesa ${formatSize(file.size)} y el máximo es ${formatSize(DIET_FILE_MAX_BYTES)}.` };
  }
  // La extensión guardada es la del tipo reconocido (la del nombre si coincide, p. ej. jpeg): no depende de un nombre mal puesto.
  return { ok: true, name, mime: type.mime, ext: byExt?.mime === type.mime ? byExt.ext : type.ext, type };
}

/** 250 000 → «244 KB»; 1 300 000 → «1,2 MB». */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(Math.round((bytes / (1024 * 1024)) * 10) / 10).toString().replace('.', ',')} MB`;
}

/** Ruta en el almacenamiento: carpeta del usuario y un nombre generado y seguro (el nombre real va en la tabla). */
export function storagePath(userId: string, ext: string, now: number, rand: string): string {
  return `${userId}/${now}-${rand}.${ext}`;
}

/** Icono y etiqueta de un tipo MIME guardado. */
export function typeOf(mime: string): DietFileType {
  return DIET_FILE_TYPES.find((t) => t.mime === mime) ?? { ext: '', mime, label: 'Archivo', icon: 'document-outline' };
}

/** ¿Se puede leer este archivo para rellenar la dieta? Excel moderno (.xlsx), CSV y PDF con texto. */
export function canImportDiet(file: { name: string; mime_type?: string }): boolean {
  const ext = extOf(file.name);
  return ext === 'xlsx' || ext === 'csv' || ext === 'pdf' || file.mime_type === 'application/pdf' || file.mime_type === 'text/csv' || file.mime_type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
}
