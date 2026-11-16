// Dieta en texto libre (por ejemplo, el texto leído de una foto) → la misma estructura que una dieta en Excel o PDF.
// Reconoce: una línea por día («Lunes»), una por comida con su contenido («Desayuno: avena 40 g, leche 200 ml»; el
// contenido puede seguir en las líneas de debajo) y, si la hay, una línea «Total: … kcal …». Funciones puras.
import { averageOfDays, type DayTargets } from './day-targets';
import { MAX_ENTRIES, type ImportEntry, type ImportTargets, type ParsedDiet, mealOf, parseDietSheets, splitItems, weekdayOf } from './diet-import';
import { dayTargetsFromTotals, parseTotals, type DayTotals } from './diet-pdf';

const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

interface Block {
  weekday: number;
  meal: string;
  text: string;
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const clean = (s: string) => s.replace(/^[\s•·*\-–—>▪●○]+/, '').replace(/\s+/g, ' ').trim();

/** «Lunes», «LUNES:», «Día 1 - Lunes», «Lunes · entreno» → 1..7, o null. Solo líneas cortas. */
function dayHeading(line: string): number | null {
  if (words(line).length > 6) return null;
  const whole = weekdayOf(line.replace(/[:.]+$/, ''));
  if (whole !== null) return whole;
  const first = words(line)[0]?.replace(/[:.,;·\-–—]+$/, '');
  const d = first ? weekdayOf(first) : null;
  if (d === null) return null;
  // «Lunes · entreno», «Lunes - 2.100 kcal»: el día va solo o seguido de un separador
  const rest = line.trim().slice(words(line)[0].length).trim();
  return !rest || /^[:·\-–—(]/.test(rest) || /kcal|entreno|descanso|trabajo/i.test(rest) ? d : null;
}

/** «Desayuno: avena…» o «Desayuno» → comida y el texto que hay detrás, o null. */
function mealHeading(line: string): { label: string; rest: string } | null {
  const m = /^([^:\-–—]{3,30}?)\s*[:\-–—]\s*(.*)$/.exec(line);
  if (m && words(m[1]).length <= 4 && mealOf(m[1]) !== null) return { label: clean(m[1]), rest: clean(m[2]) };
  if (words(line).length <= 3 && mealOf(line) !== null) return { label: clean(line), rest: '' };
  return null;
}

/** «avena 40 g, leche 200 ml» → dos alimentos. Solo se parte por comas si todos los trozos llevan cantidad (si no, es una descripción: «pollo, a la plancha»). */
const commaItems = (item: string): string[] => {
  const parts = item.split(/\s*,\s+/).filter(Boolean);
  return parts.length > 1 && parts.every((x) => /\d/.test(x)) ? parts : [item];
};

const clip = (t: string) => (t.length > 160 ? t.slice(0, 159).trimEnd() + '…' : t);

/**
 * Lee el texto de una dieta. `defaultWeekday` (1 = lunes … 7 = domingo) es el día que se usa para lo que aparezca antes de
 * cualquier título de día (por ejemplo, una foto de un solo día que no dice cuál es).
 */
export function parseDietText(text: string, defaultWeekday?: number): ParsedDiet {
  const blocks: Block[] = [];
  const totals = new Map<number, DayTotals>();
  const skipped: string[] = [];
  let day: number | null = defaultWeekday ?? null;
  let open: Block | null = null;
  const flush = () => {
    if (open) blocks.push(open);
    open = null;
  };

  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const d = dayHeading(line);
    if (d !== null) {
      flush();
      day = d;
      continue;
    }
    const tot = parseTotals(clean(line));
    if (tot) {
      flush();
      if (day !== null) totals.set(day, tot);
      continue;
    }
    const meal = mealHeading(clean(line));
    if (meal) {
      flush();
      if (day === null) {
        skipped.push(clean(line));
        continue;
      }
      open = { weekday: day, meal: meal.label, text: meal.rest };
      continue;
    }
    if (open) (open as Block).text = [(open as Block).text, clean(line)].filter(Boolean).join('; ');
    else if (clean(line).length > 2 && skipped.length < 12) skipped.push(clean(line));
  }
  flush();

  const entries: ImportEntry[] = [];
  for (const b of blocks) {
    if (!b.text.trim()) continue;
    const items = splitItems(b.text.replace(/\s·\s/g, ' + ')).flatMap(commaItems);
    const rows = [['Día', 'Comida', 'Alimento'], ...items.map((item) => [DAY_NAMES[b.weekday - 1], b.meal, clip(item)])];
    entries.push(...parseDietSheets([{ name: 'Foto', rows }]).entries);
  }

  const dayTargets: DayTargets | null = dayTargetsFromTotals(totals);
  const targets: ImportTargets = dayTargets ? averageOfDays(dayTargets) : {};
  const notes: string[] = ['Texto leído de una foto: puede tener errores. Revisa cada día antes de aplicar.'];
  if (entries.length) notes.push('Las comidas se importan sin calorías ni macros (la foto no las trae por comida): puedes completarlas en el planificador.');
  if (!blocks.length && day === null) notes.push('No he encontrado ningún día de la semana. Escribe el día («Lunes») en una línea antes de sus comidas, o elige un día abajo.');
  if (entries.length > MAX_ENTRIES) notes.push(`El texto tiene más de ${MAX_ENTRIES} alimentos: solo se importan los ${MAX_ENTRIES} primeros.`);
  return { layout: 'photo', sheet: null, entries: entries.slice(0, MAX_ENTRIES), targets, ...(dayTargets ? { dayTargets } : {}), skipped, notes };
}
