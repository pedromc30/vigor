// Lectura de texto de una foto (OCR) en el propio móvil: Google ML Kit en Android y Apple Vision en iOS.
// La imagen no se envía a ningún servidor ni se guarda.
import { extractTextFromImage, isSupported } from 'expo-text-extractor';

export const ocrSupported: boolean = isSupported;

/** Texto reconocido en la imagen, un bloque de texto por línea (de arriba abajo). Vacío si no encuentra texto. */
export async function readTextFromImage(uri: string): Promise<string> {
  const blocks = await extractTextFromImage(uri);
  return blocks.map((b) => b.trim()).filter(Boolean).join('\n');
}
