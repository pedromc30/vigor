// Dieta en PDF → la misma estructura que una dieta en Excel. Reconoce el formato «un título por día + tabla de comidas»:
//   «Lunes · trabajo + entreno», «Total: ~2.860 kcal · 217 g proteína · 358 g hidratos · 57 g grasa» y una tabla
//   «Comida | Qué comer». Funciones puras; la lectura del PDF está en pdf-text.ts.
import { MAX_ENTRIES, type ImportEntry, type ImportTargets, type ParsedDiet, mealOf, parseDietSheets, splitItems, weekdayOf } from './diet-import';
import { type PdfLine, readPdfLines } from './pdf-text';
import { SpreadsheetError } from './spreadsheet';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export interface DayTotals {
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

/** «Total: ~2.860 kcal · 217 g proteína · 358 g hidratos · 57 g grasa» → cifras del día. */
export function parseTotals(text: string): DayTotals | null {
  const t = text.toLowerCase();
  if (!/^total\b/.test(t)) return null;
  const n = (re: RegExp) => {
    const m = re.exec(t);
    return m ? Number(m[1].replace(/\./g, '').replace(',', '.')) : undefined;
  };
  const out: DayTotals = {
    kcal: n(/(\d[\d.,]*)\s*kcal/),
    protein_g: n(/(\d[\d.,]*)\s*g\s*prote/),
    carbs_g: n(/(\d[\d.,]*)\s*g\s*(?:hidratos|carbohidratos)/),
    fat_g: n(/(\d[\d.,]*)\s*g\s*grasa/),
  };
  return Object.values(out).some((v) => v !== undefined) ? out : null;
}

/** Una comida de la tabla: su texto y, si el PDF las trae, las calorías y los macros de la comida entera. */
export interface PdfMealBlock {
  weekday: number;
  meal: string;
  text: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

/** «45 g · 81 g · 15 g» → proteína, hidratos y grasa. */
export function parseMacros(text: string): { protein_g: number; carbs_g: number; fat_g: number } | null {
  const m = /^(\d+(?:[.,]\d+)?)\s*g\s*[·|/-]\s*(\d+(?:[.,]\d+)?)\s*g\s*[·|/-]\s*(\d+(?:[.,]\d+)?)\s*g$/i.exec(text.trim());
  if (!m) return null;
  const n = (x: string) => Number(x.replace(',', '.'));
  return { protein_g: n(m[1]), carbs_g: n(m[2]), fat_g: n(m[3]) };
}

/** Líneas del PDF → comidas por día y totales de cada día. */
export function pdfLinesToBlocks(pages: PdfLine[][]): { blocks: PdfMealBlock[]; totals: Map<number, DayTotals> } {
  const blocks: PdfMealBlock[] = [];
  const totals = new Map<number, DayTotals>();
  let day: number | null = null;
  let open: PdfMealBlock | null = null;
  let textX = 0;
  const flush = () => {
    if (open) blocks.push(open);
    open = null;
  };
  for (const line of pages.flat()) {
    const first = line[0].text;
    const head = /^(.+?)\s·\s/.exec(first);
    const headDay = head ? weekdayOf(head[1]) : null;
    if (headDay !== null && line.length === 1) {
      flush();
      day = headDay;
      continue;
    }
    if (/^tabla de equivalencias/i.test(first.normalize('NFD').replace(/[̀-ͯ]/g, ''))) {
      flush();
      day = null;
      continue;
    }
    if (day === null) continue;
    const tot = parseTotals(first);
    if (tot) {
      flush();
      totals.set(day, tot);
      continue;
    }
    // «Media mañana» se parte en dos líneas: la primera solo dice «Media»
    const meal = line.length >= 2 ? (mealOf(first) ?? (/^media$/i.test(first) ? 'snacks' : null)) : null;
    if (meal !== null) {
      flush();
      if (/^qu[eé] comer$/i.test(line[1].text)) continue; // cabecera de la tabla
      textX = line[1].x;
      open = { weekday: day, meal: first, text: line[1].text };
      // columnas opcionales a la derecha: calorías y «proteína · hidratos · grasa» de la comida
      for (const c of line.slice(2)) {
        const macros = parseMacros(c.text);
        if (macros) Object.assign(open, macros);
        else if (/^\d{2,5}$/.test(c.text)) open.kcal = Number(c.text);
      }
      if (open.kcal === undefined || open.protein_g === undefined) delete open.kcal, delete open.protein_g, delete open.carbs_g, delete open.fat_g;
      continue;
    }
    if (!open) continue;
    // continuación de una celda: el texto de la comida (y, si el nombre de la comida ocupa dos líneas, su segunda palabra)
    if (line.length === 1 && line[0].x < textX - 20) {
      open.meal += ' ' + line[0].text; // segunda palabra del nombre de la comida, sola en su línea
      continue;
    }
    const cell = line.length >= 2 ? line[1] : line[0];
    if (Math.abs(cell.x - textX) <= 3 && line.length <= 2) {
      if (line.length === 2 && line[0].x < textX - 20) open.meal += ' ' + line[0].text;
      open.text += ' ' + cell.text;
    } else flush();
  }
  flush();
  return { blocks, totals };
}

/** Objetivos diarios a partir de los totales de cada día: la media semanal (la app tiene un solo objetivo diario). */
export function averageTargets(totals: Map<number, DayTotals>): { targets: ImportTargets; varies: boolean } {
  const targets: ImportTargets = {};
  let varies = false;
  for (const k of ['kcal', 'protein_g', 'carbs_g', 'fat_g'] as const) {
    const v = [...totals.values()].map((t) => t[k]).filter((x): x is number => x !== undefined);
    if (!v.length) continue;
    targets[k] = Math.round(v.reduce((a, b) => a + b, 0) / v.length);
    if (Math.max(...v) - Math.min(...v) > 0.05 * targets[k]!) varies = true;
  }
  return { targets, varies };
}

const clip = (t: string) => (t.length > 160 ? t.slice(0, 159).trimEnd() + '…' : t);

/** Lee un PDF con una dieta. Lanza `SpreadsheetError` (mensaje para el usuario) si no se puede leer. */
export function parseDietPdf(bytes: Uint8Array): ParsedDiet {
  let pages: PdfLine[][];
  try {
    pages = readPdfLines(bytes);
  } catch (e) {
    throw new SpreadsheetError(e instanceof Error ? e.message : 'No se pudo leer el PDF.');
  }
  const { blocks, totals } = pdfLinesToBlocks(pages);
  const entries: ImportEntry[] = [];
  const skipped: string[] = [];
  for (const b of blocks) {
    const meal = mealOf(b.meal);
    if (meal === null) continue;
    if (b.kcal !== undefined) {
      // con calorías y macros de la comida entera: una sola entrada, para que sumen lo que dice el PDF
      entries.push({ weekday: b.weekday, meal, name: clip(b.text.replace(/\s+/g, ' ').trim()), quantity_g: null, servings: 1, kcal: b.kcal, protein_g: b.protein_g ?? 0, carbs_g: b.carbs_g ?? 0, fat_g: b.fat_g ?? 0 });
    } else {
      const rows = [['Día', 'Comida', 'Alimento'], ...splitItems(b.text.replace(/\s·\s/g, ' + ')).map((item) => [DAY_NAMES[b.weekday - 1], b.meal, item])];
      entries.push(...parseDietSheets([{ name: 'PDF', rows }]).entries);
    }
  }
  const { targets, varies } = averageTargets(totals);
  const notes: string[] = [];
  if (entries.some((e) => e.kcal > 0)) notes.push('Cada comida del PDF entra como una sola entrada, con las calorías y los macros que indica el PDF para esa comida.');
  else if (entries.length) notes.push('Este PDF no trae calorías por comida: las comidas se importan sin calorías ni macros.');
  if (varies) notes.push('El PDF indica totales distintos cada día. La app tiene un único objetivo diario: se propone la media semanal.');
  if (entries.length > MAX_ENTRIES) notes.push(`El archivo tiene más de ${MAX_ENTRIES} alimentos: solo se importan los ${MAX_ENTRIES} primeros.`);
  return { layout: 'pdf', sheet: null, entries: entries.slice(0, MAX_ENTRIES), targets, skipped, notes };
}
