// Dieta en PDF → la misma estructura que una dieta en Excel. Reconoce el formato «un título por día + tabla de comidas»:
//   «Lunes · trabajo + entreno», «Total: ~2.860 kcal · 217 g proteína · 358 g hidratos · 57 g grasa» y una tabla
//   «Comida | Qué comer». Funciones puras; la lectura del PDF está en pdf-text.ts.
import { type ParsedDiet, type ImportTargets, mealOf, parseDietSheets, splitItems, weekdayOf } from './diet-import';
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

/** Líneas del PDF → filas «Día · Comida · Alimento» y totales por día. */
export function pdfLinesToRows(pages: PdfLine[][]): { rows: string[][]; totals: Map<number, DayTotals> } {
  const rows: string[][] = [['Día', 'Comida', 'Alimento']];
  const totals = new Map<number, DayTotals>();
  let day: number | null = null;
  let open: { meal: string; text: string; x: number } | null = null;
  const flush = () => {
    if (open && day !== null) for (const item of splitItems(open.text.replace(/\s·\s/g, ' + '))) rows.push([DAY_NAMES[day - 1], open.meal, item]);
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
    const meal = line.length >= 2 ? mealOf(first) : null;
    if (meal !== null) {
      flush();
      if (/^qu[eé] comer$/i.test(line[1].text)) continue; // cabecera de la tabla
      open = { meal: first, text: line.slice(1).map((c) => c.text).join(' '), x: line[1].x };
      continue;
    }
    // segunda línea de una misma celda: solo texto en la columna de «Qué comer»
    if (open && line.length === 1 && Math.abs(line[0].x - open.x) <= 3) open.text += ' ' + first;
    else flush();
  }
  flush();
  return { rows, totals };
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

/** Lee un PDF con una dieta. Lanza `SpreadsheetError` (mensaje para el usuario) si no se puede leer. */
export function parseDietPdf(bytes: Uint8Array): ParsedDiet {
  let pages: PdfLine[][];
  try {
    pages = readPdfLines(bytes);
  } catch (e) {
    throw new SpreadsheetError(e instanceof Error ? e.message : 'No se pudo leer el PDF.');
  }
  const { rows, totals } = pdfLinesToRows(pages);
  const parsed = parseDietSheets([{ name: 'PDF', rows }]);
  const { targets, varies } = averageTargets(totals);
  const notes = parsed.notes.filter((n) => !/^El archivo no trae calor/.test(n));
  if (parsed.entries.length) notes.unshift('Los PDF no traen calorías por alimento: las comidas se importan sin calorías ni macros.');
  if (varies) notes.push('El PDF indica totales distintos cada día. La app tiene un único objetivo diario: se propone la media semanal.');
  return { ...parsed, layout: 'pdf', sheet: null, targets: { ...parsed.targets, ...targets }, notes };
}
