const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP: Record<string, number> = Object.fromEntries([...ALPHABET].map((c, i) => [c, i]));

/** Decodifica base64 (sin depender de atob) a bytes. Ignora saltos de línea y el relleno «=». */
export function base64ToBytes(input: string): Uint8Array {
  const clean = input.replace(/[\r\n\s=]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = LOOKUP[clean[i]];
    const b = LOOKUP[clean[i + 1]];
    const c = clean[i + 2] === undefined ? undefined : LOOKUP[clean[i + 2]];
    const d = clean[i + 3] === undefined ? undefined : LOOKUP[clean[i + 3]];
    if (a === undefined || b === undefined || c === undefined && clean[i + 2] !== undefined || d === undefined && clean[i + 3] !== undefined) {
      throw new Error('base64 no válido');
    }
    out[o++] = (a << 2) | (b >> 4);
    if (c !== undefined) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d !== undefined) out[o++] = ((c! & 3) << 6) | d;
  }
  return out.slice(0, o);
}
