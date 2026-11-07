// Interpreta una hoja de cálculo con una dieta y la convierte en entradas del planificador semanal y objetivos diarios.
// Reconoce los formatos habituales de las dietas en Excel (ver `parseDietSheets`). Funciones puras.
import type { Meal } from './diet-math';
import type { EntryDraft } from './diet';
import type { Sheet } from './spreadsheet';

export interface ImportEntry {
  weekday: number; // 1 = lunes … 7 = domingo
  meal: Meal;
  name: string;
  quantity_g: number | null;
  servings: number | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

export interface ImportTargets {
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
}

export type ImportLayout = 'grid' | 'transposed' | 'list' | 'pdf' | 'none';

export interface ParsedDiet {
  layout: ImportLayout;
  sheet: string | null;
  entries: ImportEntry[];
  targets: ImportTargets;
  /** Textos que se han leído pero no se han podido colocar (comida o día no reconocidos). */
  skipped: string[];
  /** Avisos para el usuario: lo que la app ha tenido que suponer. */
  notes: string[];
}

export const MAX_ENTRIES = 400;

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

// ---------- Días y comidas ----------

const WEEKDAYS: [RegExp, number][] = [
  [/^lun(es)?\.?$/, 1],
  [/^mar(tes)?\.?$/, 2],
  [/^mie(rcoles)?\.?$/, 3],
  [/^jue(ves)?\.?$/, 4],
  [/^vie(rnes)?\.?$/, 5],
  [/^sab(ado)?\.?$/, 6],
  [/^dom(ingo)?\.?$/, 7],
];

/** «Lunes», «lun.», «MIÉ», «Dia 1 - Lunes»… → 1..7, o null. Solo se aceptan celdas cortas: no frases que contengan un día. */
export function weekdayOf(text: string): number | null {
  const t = fold(text).replace(/^dia \d+\s*[-:.]?\s*/, '').replace(/[:.]$/, '');
  for (const [re, n] of WEEKDAYS) if (re.test(t)) return n;
  return null;
}

/** Nombre de comida de la dieta → comida de la app, o null. «Almuerzo» se toma como comida (la del mediodía). */
export function mealOf(text: string): Meal | null {
  const t = fold(text).replace(/[:.]$/, '');
  if (!t || t.length > 40) return null;
  if (/^desayuno\b/.test(t)) return 'desayuno';
  if (/^(media manana|almuerzo de media|tentempie|snack|aperitivo|picoteo|pre[- ]?entreno|post[- ]?entreno|recena|antes de dormir|a media manana|colacion|toma de la manana)/.test(t)) return 'snacks';
  if (/^(comida|almuerzo|plato principal|lunch)\b/.test(t)) return 'comida';
  if (/^merienda\b/.test(t)) return 'merienda';
  if (/^cena\b/.test(t)) return 'cena';
  return null;
}

// ---------- Números y cantidades ----------

/** «1.850», «1850», «12,5», «12.5», «1 850» → número; null si no es un número. */
export function parseNumber(text: string): number | null {
  let t = text.trim().replace(/\s+/g, '');
  if (!/^\d[\d.,]*$/.test(t)) return null;
  const lastComma = t.lastIndexOf(',');
  const lastDot = t.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // el último separador es el decimal
    t = lastComma > lastDot ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  } else if (lastComma >= 0 || lastDot >= 0) {
    const sep = lastComma >= 0 ? ',' : '.';
    const parts = t.split(sep);
    // «1.850» (un solo separador y tres cifras después) es un millar; en otro caso es decimal
    t = parts.length === 2 && parts[1].length === 3 && parts[0].length <= 3 && parts[0] !== '0' ? parts.join('') : parts.join('.');
    if (parts.length > 2) t = parts.join('');
  }
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/** Número con unidad opcional pegada o suelta: «220», «220 g», «1.850 kcal». */
export function numberWithUnit(text: string): number | null {
  const m = /^(\d[\d.,\s]*?)\s*(?:kcal|g|gr|gramos)?\.?$/i.exec(text.trim());
  return m ? parseNumber(m[1]) : null;
}

/** Gramos de un texto: «200 g de pollo», «pollo (200g)», «150 gr», «250 ml de leche» (1 ml ≈ 1 g). */
export function gramsIn(text: string): { grams: number; rest: string } | null {
  const m = /(\d+(?:[.,]\d+)?)\s*(?:g|gr|grs|gramos?|ml|cc)\b\.?/i.exec(text);
  if (!m) return null;
  const grams = parseNumber(m[1]);
  if (grams === null || grams <= 0 || grams > 5000) return null;
  const rest = (text.slice(0, m.index) + ' ' + text.slice(m.index + m[0].length)).replace(/[()]/g, ' ').replace(/\s+(de|del)\s*$/i, '').replace(/^\s*(de|del)\s+/i, '').replace(/\s+/g, ' ').replace(/\b(de|del) (de|del)\b/gi, '$2').replace(/([:,]) (?:de|del) /gi, '$1 ').replace(/^[\s,;:–-]+|[\s,;:–-]+$/g, '');
  return { grams, rest: rest || text.trim() };
}

/** Trozos de una celda de comida: uno por línea o separados por «;» o «+» (las comas se dejan: forman parte de la descripción). */
export function splitItems(cell: string): string[] {
  return cell
    .split(/\r?\n|;|\s\+\s/)
    .map((s) => s.replace(/^[\s•·*\-–—]+/, '').trim())
    .filter((s) => s.length > 0 && !/^[-–—x/.\s]*$/i.test(s) && !/^(libre|ninguno|nada|n\/a|-)$/i.test(fold(s)));
}

function entryFromText(weekday: number, meal: Meal, text: string): ImportEntry {
  const g = gramsIn(text);
  const name = (g ? `${g.rest}` : text).slice(0, 160).trim() || text.slice(0, 160);
  return {
    weekday,
    meal,
    name,
    quantity_g: g ? g.grams : null,
    servings: g ? null : 1,
    kcal: 0,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
  };
}

// ---------- Estructuras de la hoja ----------

const cellsOf = (rows: string[][]) => rows.map((r) => r.map((c) => c ?? ''));

interface Attempt {
  layout: ImportLayout;
  entries: ImportEntry[];
  skipped: string[];
  notes: string[];
}

/** Días en columnas y comidas en filas (la plantilla más habitual). */
function parseGrid(rows: string[][]): Attempt | null {
  const headerRow = rows.findIndex((r) => r.filter((c) => weekdayOf(c) !== null).length >= 3);
  if (headerRow < 0) return null;
  const dayCols = rows[headerRow].map((c, j) => [j, weekdayOf(c)] as const).filter(([, d]) => d !== null) as [number, number][];
  const firstDayCol = dayCols[0][0];
  const entries: ImportEntry[] = [];
  const skipped: string[] = [];
  let currentMeal: Meal | null = null;
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    // la comida está en las columnas a la izquierda de los días; si la celda está vacía, sigue la anterior (celdas combinadas)
    const label = row.slice(0, firstDayCol).map((c) => c.trim()).find((c) => c !== '');
    if (label) {
      const meal = mealOf(label);
      if (meal) currentMeal = meal;
      else if (!numericOnly(label)) {
        currentMeal = null;
        // una fila con otro rótulo (p. ej. «Total kcal», «Notas») no es comida
        if (dayCols.some(([j]) => (row[j] ?? '').trim() !== '') && !/total|kcal|calor|nota|objetivo|prote|hidrat|carbo|grasa|agua|suplement|observ/.test(fold(label))) {
          skipped.push(`${label}: ${dayCols.map(([j]) => row[j]).filter(Boolean).join(' / ')}`.slice(0, 120));
        }
        continue;
      }
    }
    if (!currentMeal) continue;
    for (const [j, day] of dayCols) {
      for (const item of splitItems(row[j] ?? '')) entries.push(entryFromText(day, currentMeal, item));
    }
  }
  return entries.length ? { layout: 'grid', entries, skipped, notes: [] } : null;
}

const numericOnly = (s: string) => /^[\d\s.,]+$/.test(s);

/** Días en filas y comidas en columnas. */
function parseTransposed(rows: string[][]): Attempt | null {
  const headerRow = rows.findIndex((r) => r.filter((c) => mealOf(c) !== null).length >= 2);
  if (headerRow < 0) return null;
  const mealCols = rows[headerRow].map((c, j) => [j, mealOf(c)] as const).filter(([, m]) => m !== null) as [number, Meal][];
  const firstMealCol = mealCols[0][0];
  const entries: ImportEntry[] = [];
  const skipped: string[] = [];
  let weekdays = 0;
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i];
    const label = row.slice(0, firstMealCol).map((c) => c.trim()).find((c) => c !== '');
    const day = label ? weekdayOf(label) : null;
    if (day === null) continue;
    weekdays++;
    for (const [j, meal] of mealCols) for (const item of splitItems(row[j] ?? '')) entries.push(entryFromText(day, meal, item));
  }
  return weekdays >= 3 && entries.length ? { layout: 'transposed', entries, skipped, notes: [] } : null;
}

const COLUMN_NAMES: Record<'day' | 'meal' | 'food' | 'qty' | 'kcal' | 'protein' | 'carbs' | 'fat', RegExp> = {
  day: /^(dia|dia de la semana|jornada)$/,
  meal: /^(comida|toma|momento|ingesta|horario)$/,
  food: /^(alimento|alimentos|plato|platos|descripcion|menu|receta|producto)$/,
  qty: /^(cantidad|gramos|g|gr|racion|raciones|peso|porcion|cantidad \(g\)|gramos \(g\))$/,
  kcal: /^(kcal|calorias|calorias \(kcal\)|energia|energia \(kcal\))$/,
  protein: /^(proteinas?|proteinas? \(g\)|prot\.?|p)$/,
  carbs: /^(hidratos?( de carbono)?|carbohidratos?|carbohidratos? \(g\)|hidratos? \(g\)|hc|ch|carbs?)$/,
  fat: /^(grasas?|grasas? \(g\)|lipidos|lipidos \(g\)|g\.?)$/,
};

/** Una fila por alimento, con columnas de día, comida y alimento (y, si las hay, cantidad y nutrientes). */
function parseList(rows: string[][]): Attempt | null {
  for (let h = 0; h < Math.min(rows.length, 15); h++) {
    const header = rows[h].map(fold);
    const col = (k: keyof typeof COLUMN_NAMES) => header.findIndex((c) => COLUMN_NAMES[k].test(c));
    const day = col('day');
    const meal = col('meal');
    const food = col('food');
    if (day < 0 || meal < 0 || food < 0) continue;
    const qty = col('qty');
    const nutr = { kcal: col('kcal'), protein: col('protein'), carbs: col('carbs'), fat: header.findIndex((c, j) => j !== qty && /^(grasas?|grasas? \(g\)|lipidos|lipidos \(g\))$/.test(c)) };
    const entries: ImportEntry[] = [];
    const skipped: string[] = [];
    const notes: string[] = [];
    let carryDay: number | null = null;
    let carryMeal: Meal | null = null;
    for (let i = h + 1; i < rows.length; i++) {
      const row = rows[i];
      const text = (row[food] ?? '').trim();
      const d = weekdayOf(row[day] ?? '');
      if (d !== null) carryDay = d;
      const m = mealOf(row[meal] ?? '');
      if (m !== null) carryMeal = m;
      else if ((row[meal] ?? '').trim() !== '') carryMeal = null;
      if (!text) continue;
      if (carryDay === null || carryMeal === null) {
        skipped.push(`${(row[day] ?? '').trim()} ${(row[meal] ?? '').trim()}: ${text}`.trim().slice(0, 120));
        continue;
      }
      const e = entryFromText(carryDay, carryMeal, text);
      if (qty >= 0) {
        const q = parseNumber(row[qty] ?? '');
        if (q !== null && q > 0) Object.assign(e, { quantity_g: q, servings: null });
      }
      const num = (j: number) => (j >= 0 ? Math.min(parseNumber(row[j] ?? '') ?? 0, 99999) : 0);
      e.kcal = num(nutr.kcal);
      e.protein_g = num(nutr.protein);
      e.carbs_g = num(nutr.carbs);
      e.fat_g = num(nutr.fat);
      entries.push(e);
    }
    if (entries.length) {
      if (nutr.kcal >= 0) notes.push('Las calorías y los macros salen del archivo, tal como están en cada fila.');
      return { layout: 'list', entries, skipped, notes };
    }
  }
  return null;
}

// ---------- Objetivos diarios ----------

const TARGET_LABELS: [keyof ImportTargets, RegExp][] = [
  ['kcal', /(kcal|calorias|energia|valor energetico)/],
  ['protein_g', /(proteinas?)/],
  ['carbs_g', /(hidratos|carbohidratos)/],
  ['fat_g', /(grasas?|lipidos)/],
];
const TARGET_LIMITS: Record<keyof ImportTargets, [number, number]> = { kcal: [500, 10000], protein_g: [0, 1000], carbs_g: [0, 2000], fat_g: [0, 1000] };

/**
 * Objetivos diarios que la dieta indique de forma explícita: «Calorías: 2000 kcal», «Proteínas 150 g» o un rótulo con
 * el número en la celda de al lado. Las cabeceras de columna (p. ej. «Kcal» sobre una columna) no cuentan.
 */
export function findTargets(rows: string[][]): { targets: ImportTargets; notes: string[] } {
  const targets: ImportTargets = {};
  const notes: string[] = [];
  const set = (k: keyof ImportTargets, n: number) => {
    const [lo, hi] = TARGET_LIMITS[k];
    if (targets[k] === undefined && n >= lo && n <= hi) targets[k] = Math.round(n);
  };
  for (const row of rows) {
    for (let j = 0; j < row.length; j++) {
      const raw = (row[j] ?? '').trim();
      if (!raw || mealOf(raw) !== null || weekdayOf(raw) !== null) continue;
      const f = fold(raw);
      for (const [key, label] of TARGET_LABELS) {
        if (!label.test(f)) continue;
        // 1) número dentro del mismo texto: «Calorías diarias: 2.000 kcal», «Proteínas 150 g»
        const inline = /(?:^|[^\d.,])(\d[\d.,]*)\s*(?:kcal|g\b|gr\b|gramos)?\s*$/.exec(f) ?? /[:=]\s*(\d[\d.,]*)/.exec(f);
        const inlineN = inline ? parseNumber(inline[1]) : null;
        if (inlineN !== null && f.length <= 60) {
          set(key, inlineN);
          break;
        }
        // 2) rótulo solo y, a su derecha, los números hasta el siguiente rótulo: uno solo, o varios iguales
        const labelOnly = f.length <= 40 && !/\d/.test(f);
        if (labelOnly) {
          const run: number[] = [];
          for (let k = j + 1; k < row.length; k++) {
            const c = (row[k] ?? '').trim();
            if (c === '') continue;
            const n = numberWithUnit(c);
            if (n === null) break;
            run.push(n);
          }
          if (run.length >= 1 && run.every((n) => n === run[0])) set(key, run[0]);
          else if (run.length > 1 && key === 'kcal') notes.push('El archivo indica calorías distintas cada día: no se aplican como objetivo diario.');
        }
        break;
      }
    }
  }
  return { targets, notes: [...new Set(notes)] };
}

// ---------- Entrada principal ----------

/**
 * Lee una dieta de una o varias hojas. Formatos reconocidos:
 *  - «grid»: días (lunes…domingo) en las columnas y comidas (desayuno, comida, merienda, cena…) en las filas;
 *  - «transposed»: días en las filas y comidas en las columnas;
 *  - «list»: una fila por alimento con columnas de día, comida y alimento (y opcionalmente cantidad, kcal y macros).
 * Se usa la hoja que dé más alimentos. Las calorías y macros solo se rellenan si el archivo las trae (formato «list»);
 * en los demás casos las entradas quedan sin calorías para que las completes.
 */
export function parseDietSheets(sheets: Sheet[]): ParsedDiet {
  let best: (Attempt & { sheet: string; rows: string[][] }) | null = null;
  for (const s of sheets) {
    const rows = cellsOf(s.rows);
    for (const attempt of [parseList(rows), parseGrid(rows), parseTransposed(rows)]) {
      if (attempt && (!best || attempt.entries.length > best.entries.length)) best = { ...attempt, sheet: s.name, rows };
    }
  }
  const allRows = sheets.flatMap((s) => cellsOf(s.rows));
  const { targets, notes: targetNotes } = findTargets(best ? best.rows : allRows);
  if (!best) return { layout: 'none', sheet: null, entries: [], targets, skipped: [], notes: targetNotes };
  const notes = [...best.notes, ...targetNotes];
  let entries = best.entries;
  if (entries.length > MAX_ENTRIES) {
    notes.push(`El archivo tiene más de ${MAX_ENTRIES} alimentos: solo se importan los ${MAX_ENTRIES} primeros.`);
    entries = entries.slice(0, MAX_ENTRIES);
  }
  if (!entries.some((e) => e.kcal > 0)) notes.push('El archivo no trae calorías por alimento: las entradas se importan sin calorías ni macros.');
  return { layout: best.layout, sheet: best.sheet, entries, targets, skipped: best.skipped.slice(0, 20), notes };
}

/** Nombre legible del formato reconocido. */
export const LAYOUT_LABELS: Record<ImportLayout, string> = {
  grid: 'Días en columnas y comidas en filas',
  transposed: 'Días en filas y comidas en columnas',
  list: 'Una fila por alimento',
  pdf: 'PDF: un menú por día',
  none: 'Sin reconocer',
};

/** Entradas del planificador por día de la semana, listas para guardar. */
export function draftsByWeekday(entries: ImportEntry[], days: Set<number>): Map<number, EntryDraft[]> {
  const out = new Map<number, EntryDraft[]>();
  for (const e of entries) {
    if (!days.has(e.weekday)) continue;
    const list = out.get(e.weekday) ?? [];
    list.push({
      meal: e.meal,
      food_id: null,
      recipe_id: null,
      name: e.name,
      quantity_g: e.quantity_g,
      servings: e.servings,
      kcal: e.kcal,
      protein_g: e.protein_g,
      carbs_g: e.carbs_g,
      fat_g: e.fat_g,
    });
    out.set(e.weekday, list);
  }
  return out;
}

/** Días de la semana (1..7) con entradas, en orden. */
export const daysWithEntries = (entries: ImportEntry[]): number[] => [...new Set(entries.map((e) => e.weekday))].sort((a, b) => a - b);
