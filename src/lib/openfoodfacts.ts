// Cliente de Open Food Facts. Límites oficiales: 15 consultas/min de producto y 10/min de búsqueda
// (por IP; en apps móviles se aplican por usuario). Hay que identificar la app con un User-Agent propio.
import type { Per100 } from './diet-math';

const BASE = 'https://world.openfoodfacts.org';
const USER_AGENT = 'Vigor/1.0 (app de entreno y dieta)';
const FIELDS = 'code,product_name,product_name_es,generic_name,brands,nutriments,serving_quantity,allergens_tags';
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
    public kind: 'rate_limit' | 'network' | 'server',
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
 * Convierte un producto de OFF en un alimento utilizable. Devuelve null si faltan datos mínimos
 * (nombre o calorías) o si los valores son absurdos (por ejemplo, más de 100 g de proteína por 100 g).
 */
export function parseOffProduct(raw: unknown): OffFood | null {
  const p = raw as Record<string, any> | null;
  if (!p || typeof p !== 'object') return null;
  const n = (p.nutriments ?? {}) as Record<string, unknown>;

  const kj = num(n['energy_100g']);
  const kcal = num(n['energy-kcal_100g']) ?? (kj != null ? kj / 4.184 : null);
  const name = String(p.product_name_es || p.product_name || p.generic_name || '').trim();
  if (!name || kcal == null) return null;

  const protein = num(n['proteins_100g']) ?? 0;
  const carbs = num(n['carbohydrates_100g']) ?? 0;
  const fat = num(n['fat_100g']) ?? 0;
  if (!inRange(kcal, 1000) || !inRange(protein, 100) || !inRange(carbs, 100) || !inRange(fat, 100)) return null;

  const serving = num(p.serving_quantity);
  const code = typeof p.code === 'string' && /^[0-9]{6,14}$/.test(p.code) ? p.code : null;
  const brand = String(p.brands ?? '').split(',')[0].trim();
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
    if (res.status === 429 || res.status === 503) throw new OffError('rate_limit', 'Demasiadas consultas');
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

/** Busca productos por texto (resultados en español cuando existen). Se cachea por consulta. */
export async function searchOff(query: string): Promise<OffFood[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const cached = searchCache.get(q);
  if (cached) return cached;
  const url =
    `${BASE}/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1` +
    `&page_size=25&lc=es&fields=${FIELDS}`;
  const data = await getJson(url);
  const list = (Array.isArray(data?.products) ? data.products : []).map(parseOffProduct).filter(Boolean) as OffFood[];
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
