// Cliente de Open Food Facts. Límites oficiales: 15 consultas/min de producto y 10/min de búsqueda
// (por IP; en apps móviles se aplican por usuario). Hay que identificar la app con un User-Agent propio.
// La búsqueda por texto usa Search-a-licious; el endpoint antiguo (cgi/search.pl) está en desuso y
// devuelve 503 con frecuencia, así que solo se usa como reserva.
import type { Per100 } from './diet-math';

const BASE = 'https://world.openfoodfacts.org';
const SEARCH_URL = 'https://search.openfoodfacts.org/search';
const USER_AGENT = 'Vigor/1.0 (app de entreno y dieta)';
const FIELDS = 'code,product_name,product_name_es,generic_name,brands,nutriments,serving_quantity,allergens_tags';
const SEARCH_FIELDS = 'code,product_name,brands,nutriments,serving_quantity,allergens_tags';
const TIMEOUT_MS = 10000;

export interface OffFood extends Per100 {
  barcode: string | null;
  name: string;
  brand: string;
  serving_g: number;
  allergens: string[];
}

export class OffError extends Error {
  constructor(
    public kind: 'rate_limit' | 'network' | 'unavailable' | 'server',
    message: string,
  ) {
    super(message);
  }
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

const inRange = (n: number, max: number) => n >= 0 && n <= max;

/**
 * Los campos de texto pueden llegar como cadena, como lista o como objeto por idioma
 * ({ es: '…', main: '…' }); devuelve el mejor texto disponible.
 */
function text(v: unknown): string {
  if (typeof v === 'string') return v.trim();
  if (Array.isArray(v)) return v.map(text).find(Boolean) ?? '';
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    for (const k of ['es', 'main', 'en']) {
      const t = text(o[k]);
      if (t) return t;
    }
    return Object.values(o).map(text).find(Boolean) ?? '';
  }
  return '';
}

/**
 * Convierte un producto de OFF en un alimento utilizable. Devuelve null si faltan datos mínimos
 * (nombre o calorías) o si los valores son absurdos (por ejemplo, más de 100 g de proteína por 100 g).
 */
export function parseOffProduct(raw: unknown): OffFood | null {
  const p = raw as Record<string, any> | null;
  if (!p || typeof p !== 'object') return null;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;

  const kj = num(n['energy_100g']);
  const kcal = num(n['energy-kcal_100g']) ?? (kj != null ? kj / 4.184 : null);
  const name = text(p.product_name_es) || text(p.product_name) || text(p.generic_name);
  if (!name || kcal == null) return null;

  const protein = num(n['proteins_100g']) ?? 0;
  const carbs = num(n['carbohydrates_100g']) ?? 0;
  const fat = num(n['fat_100g']) ?? 0;
  if (!inRange(kcal, 1000) || !inRange(protein, 100) || !inRange(carbs, 100) || !inRange(fat, 100)) return null;

  const serving = num(p.serving_quantity);
  const code = typeof p.code === 'string' && /^[0-9]{6,14}$/.test(p.code) ? p.code : null;
  const brand = text(p.brands).split(',')[0].trim();
  const allergens = Array.isArray(p.allergens_tags)
    ? p.allergens_tags.filter((t: unknown) => typeof t === 'string').map((t: string) => t.replace(/^[a-z]{2}:/, ''))
    : [];

  return {
    barcode: code,
    name: name.slice(0, 120),
    brand: brand.slice(0, 120),
    serving_g: serving != null && serving > 0 && serving <= 5000 ? serving : 100,
    kcal_100g: Math.round(kcal * 100) / 100,
    protein_100g: Math.round(protein * 100) / 100,
    carbs_100g: Math.round(carbs * 100) / 100,
    fat_100g: Math.round(fat * 100) / 100,
    allergens,
  };
}

async function getJson(url: string): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: ctrl.signal });
    if (res.status === 429) throw new OffError('rate_limit', 'Demasiadas consultas');
    if (res.status >= 500) throw new OffError('unavailable', `Servicio no disponible (${res.status})`);
    if (!res.ok) throw new OffError('server', `Error ${res.status}`);
    return await res.json();
  } catch (e) {
    if (e instanceof OffError) throw e;
    throw new OffError('network', 'Sin conexión');
  } finally {
    clearTimeout(timer);
  }
}

const searchCache = new Map<string, OffFood[]>();

async function searchSalicious(q: string): Promise<unknown[]> {
  const data = await getJson(`${SEARCH_URL}?q=${encodeURIComponent(q)}&page_size=30&fields=${SEARCH_FIELDS}`);
  if (!Array.isArray(data?.hits)) throw new OffError('server', 'Respuesta inesperada');
  return data.hits;
}

async function searchLegacy(q: string): Promise<unknown[]> {
  const data = await getJson(
    `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=30&lc=es&fields=${FIELDS}`,
  );
  if (!Array.isArray(data?.products)) throw new OffError('server', 'Respuesta inesperada');
  return data.products;
}

/**
 * Busca productos por texto. Se cachea por consulta. Si el buscador principal falla por un error
 * de servidor o de red se prueba el antiguo; si limita las consultas (429) no se insiste.
 */
export async function searchOff(query: string): Promise<OffFood[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const cached = searchCache.get(q);
  if (cached) return cached;

  let raw: unknown[];
  try {
    raw = await searchSalicious(q);
  } catch (e) {
    if (e instanceof OffError && e.kind === 'rate_limit') throw e;
    raw = await searchLegacy(q);
  }
  const list = raw.map(parseOffProduct).filter(Boolean) as OffFood[];
  searchCache.set(q, list);
  return list;
}

/** Busca un producto por código de barras. Devuelve null si no existe o no tiene datos nutricionales. */
export async function getOffByBarcode(barcode: string): Promise<OffFood | null> {
  const code = barcode.trim();
  if (!/^[0-9]{6,14}$/.test(code)) return null;
  const data = await getJson(`${BASE}/api/v2/product/${code}.json?fields=${FIELDS}`);
  if (data?.status === 0 || !data?.product) return null;
  return parseOffProduct({ code, ...data.product });
}
