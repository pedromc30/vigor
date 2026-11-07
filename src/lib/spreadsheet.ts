// Lectura de hojas de cálculo en el dispositivo: Excel moderno (.xlsx) y CSV. Sin servidores ni dependencias nativas.
// Un .xlsx es un ZIP con XML; aquí solo se leen las celdas con su texto (no fórmulas, estilos ni gráficos).
import { strFromU8, unzipSync } from 'fflate';

export interface Sheet {
  name: string;
  /** Filas de celdas ya como texto (vacío si no hay nada). */
  rows: string[][];
}

export const MAX_ROWS = 2000;
export const MAX_COLS = 60;
const MAX_UNZIPPED = 20 * 1024 * 1024; // tope contra «bombas» zip

export class SpreadsheetError extends Error {}

// ---------- Texto ----------

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeXml(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-z]+);/g, (m, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
    }
    return ENTITIES[e] ?? m;
  });
}

/** UTF-8 estricto: devuelve null si los bytes no son UTF-8 válido (para caer a Windows-1252). */
export function decodeUtf8Strict(bytes: Uint8Array): string | null {
  let out = '';
  let i = 0;
  while (i < bytes.length) {
    const b = bytes[i];
    let cp: number;
    let extra: number;
    if (b < 0x80) (cp = b), (extra = 0);
    else if (b >= 0xc2 && b <= 0xdf) (cp = b & 0x1f), (extra = 1);
    else if (b >= 0xe0 && b <= 0xef) (cp = b & 0x0f), (extra = 2);
    else if (b >= 0xf0 && b <= 0xf4) (cp = b & 0x07), (extra = 3);
    else return null;
    if (i + extra >= bytes.length) return null; // secuencia cortada al final
    for (let k = 1; k <= extra; k++) {
      const c = bytes[i + k];
      if (c === undefined || (c & 0xc0) !== 0x80) return null;
      cp = (cp << 6) | (c & 0x3f);
    }
    if ((extra === 2 && cp < 0x800) || (extra === 3 && (cp < 0x10000 || cp > 0x10ffff))) return null;
    out += String.fromCodePoint(cp);
    i += extra + 1;
  }
  return out;
}

const CP1252: Record<number, string> = { 0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—', 0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ' };

/** Texto de un CSV: UTF-8 (con o sin BOM) o, si no lo es, Windows-1252 (lo habitual al exportar desde Excel en español). */
export function decodeText(bytes: Uint8Array): string {
  const start = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 3 : 0;
  const body = bytes.subarray(start);
  const utf8 = decodeUtf8Strict(body);
  if (utf8 !== null) return utf8;
  let out = '';
  for (const b of body) out += CP1252[b] ?? String.fromCharCode(b);
  return out;
}

// ---------- CSV ----------

/** Separador más probable (; , o tabulador) según la primera línea con contenido, sin contar lo entrecomillado. */
export function detectDelimiter(text: string): string {
  const line = text.split(/\r\n|\n|\r/).find((l) => l.trim() !== '') ?? '';
  const count = (d: string) => {
    let n = 0;
    let quoted = false;
    for (const c of line) {
      if (c === '"') quoted = !quoted;
      else if (!quoted && c === d) n++;
    }
    return n;
  };
  const best = [';', ',', '\t'].map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ';';
}

/** CSV según RFC 4180: campos entrecomillados con «""», saltos de línea dentro de comillas y cualquier separador. */
export function parseCsv(text: string, delimiter = detectDelimiter(text)): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  const endField = () => (row.push(field), (field = ''));
  const endRow = () => {
    endField();
    if (row.some((c) => c.trim() !== '')) rows.push(row.slice(0, MAX_COLS).map((c) => c.trim()));
    row = [];
  };
  for (let i = 0; i < text.length && rows.length < MAX_ROWS; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') (field += '"'), i++;
        else quoted = false;
      } else field += c;
    } else if (c === '"' && field === '') quoted = true;
    else if (c === delimiter) endField();
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      endRow();
    } else field += c;
  }
  if (field !== '' || row.length) endRow();
  return rows;
}

// ---------- Excel (.xlsx) ----------

/** «B3» → { col: 1, row: 2 } (índices desde 0). */
export function cellRef(ref: string): { col: number; row: number } | null {
  const m = /^([A-Z]{1,3})(\d{1,7})$/.exec(ref);
  if (!m) return null;
  let col = 0;
  for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64);
  return { col: col - 1, row: Number(m[2]) - 1 };
}

const textOf = (xml: string) => {
  const noPhonetic = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  let out = '';
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
  for (let m = re.exec(noPhonetic); m; m = re.exec(noPhonetic)) out += decodeXml(m[1]);
  return out;
};

export function parseSharedStrings(xml: string): string[] {
  const out: string[] = [];
  const re = /<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) out.push(m[1] ? textOf(m[1]) : '');
  return out;
}

export function parseSheetXml(xml: string, shared: string[]): string[][] {
  const grid: string[][] = [];
  const re = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) {
    const attrs = m[1];
    const ref = /\br="([A-Z]+\d+)"/.exec(attrs);
    const pos = ref ? cellRef(ref[1]) : null;
    if (!pos || pos.row >= MAX_ROWS || pos.col >= MAX_COLS) continue;
    const inner = m[2] ?? '';
    const type = /\bt="([^"]+)"/.exec(attrs)?.[1] ?? 'n';
    let value = '';
    if (type === 'inlineStr') value = textOf(inner);
    else {
      const v = /<v\b[^>]*>([\s\S]*?)<\/v>/.exec(inner)?.[1];
      if (v !== undefined) {
        if (type === 's') value = shared[Number(v)] ?? '';
        else if (type === 'str') value = decodeXml(v);
        else if (type === 'n') value = v.trim();
        // booleanos y errores ('b', 'e') se ignoran
      }
    }
    value = value.trim();
    if (value === '') continue;
    (grid[pos.row] ??= [])[pos.col] = value;
  }
  // Huecos → cadenas vacías, para que todas las filas sean listas completas.
  let width = 0;
  for (let i = 0; i < grid.length; i++) width = Math.max(width, grid[i]?.length ?? 0); // las filas vacías son huecos del array
  return Array.from({ length: grid.length }, (_, i) => Array.from({ length: width }, (_, j) => grid[i]?.[j] ?? ''));
}

const dirname = (p: string) => p.slice(0, p.lastIndexOf('/') + 1);

export function readXlsx(bytes: Uint8Array): Sheet[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => {
        if (f.originalSize > MAX_UNZIPPED) throw new SpreadsheetError('El archivo es demasiado grande para leerlo.');
        return /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(f.name);
      },
    });
  } catch (e) {
    if (e instanceof SpreadsheetError) throw e;
    throw new SpreadsheetError('No se pudo abrir el archivo de Excel: parece dañado.');
  }
  const workbook = files['xl/workbook.xml'];
  if (!workbook) throw new SpreadsheetError('Este archivo no parece un Excel (.xlsx) válido.');
  const rels = files['xl/_rels/workbook.xml.rels'] ? strFromU8(files['xl/_rels/workbook.xml.rels']) : '';
  const target = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b([^>]*?)\/?>/g)) {
    const id = /\bId="([^"]+)"/.exec(m[1])?.[1];
    const t = /\bTarget="([^"]+)"/.exec(m[1])?.[1];
    if (id && t) target.set(id, t.startsWith('/') ? t.slice(1) : dirname('xl/workbook.xml') + t);
  }
  const shared = files['xl/sharedStrings.xml'] ? parseSharedStrings(strFromU8(files['xl/sharedStrings.xml'])) : [];
  const sheets: Sheet[] = [];
  const wbXml = strFromU8(workbook);
  for (const m of wbXml.matchAll(/<sheet\b([^>]*?)\/?>/g)) {
    const name = decodeXml(/\bname="([^"]*)"/.exec(m[1])?.[1] ?? `Hoja ${sheets.length + 1}`);
    const rid = /\br:id="([^"]+)"/.exec(m[1])?.[1];
    const path = rid ? target.get(rid) : undefined;
    const data = path ? files[path] : undefined;
    if (data && sheets.length < 12) sheets.push({ name, rows: parseSheetXml(strFromU8(data), shared) });
  }
  if (!sheets.length) throw new SpreadsheetError('El Excel no tiene hojas con datos.');
  return sheets;
}

// ---------- Entrada común ----------

/** Lee un archivo de hoja de cálculo por su contenido (no por su nombre): .xlsx, CSV o texto con separadores. */
export function readSpreadsheet(bytes: Uint8Array, fileName = ''): Sheet[] {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b) return readXlsx(bytes);
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) {
    throw new SpreadsheetError('Los Excel antiguos (.xls) no se pueden leer. Ábrelo en Excel y guárdalo como .xlsx o como CSV.');
  }
  const rows = parseCsv(decodeText(bytes));
  if (!rows.length) throw new SpreadsheetError('El archivo no tiene datos.');
  return [{ name: fileName || 'Hoja 1', rows }];
}
