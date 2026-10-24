// Lógica pura para reproducir en el móvil lo esencial de una consulta PostgREST (filtros, orden, límites)
// y para aplicar encima los cambios pendientes de enviar. Sin dependencias de React Native.

export type Row = Record<string, unknown>;

/** Tablas cuyas escrituras se pueden hacer sin conexión y sincronizar después. */
export const QUEUEABLE_TABLES = ['workout_sessions', 'workout_sets', 'meal_logs', 'water_logs', 'body_metrics'] as const;
export const isQueueable = (table: string) => (QUEUEABLE_TABLES as readonly string[]).includes(table);

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

export function parseRestUrl(url: string): { table: string; params: URLSearchParams; path: string } | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const m = u.pathname.match(/^\/rest\/v1\/([A-Za-z0-9_]+)$/); // las llamadas a funciones (/rpc/…) no se tocan
  return m ? { table: m[1], params: u.searchParams, path: u.pathname + u.search } : null;
}

/** UUID v4 para ids creados en el móvil (no es un secreto: la seguridad la da RLS). */
export function newId(rand: () => number = Math.random): string {
  const hex = (n: number) => Array.from({ length: n }, () => Math.floor(rand() * 16).toString(16)).join('');
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${(8 + Math.floor(rand() * 4)).toString(16)}${hex(3)}-${hex(12)}`;
}

function sameValue(v: unknown, q: string): boolean {
  if (typeof v === 'number') return Number(q) === v;
  if (typeof v === 'boolean') return String(v) === q;
  return String(v) === q;
}

function compare(v: unknown, q: string): number {
  if (typeof v === 'number') return v - Number(q);
  const a = String(v);
  return a < q ? -1 : a > q ? 1 : 0;
}

function parseIn(q: string): string[] {
  const inner = q.replace(/^\(/, '').replace(/\)$/, '');
  return inner.split(',').map((s) => s.trim().replace(/^"|"$/g, ''));
}

/** ¿Cumple la fila los filtros de la consulta? Los operadores que no se conocen no descartan la fila. */
export function matchesFilters(row: Row, params: URLSearchParams): boolean {
  for (const [key, expr] of params) {
    if (RESERVED.has(key) || key.includes('.') || key === 'or' || key === 'and') continue;
    const v = row[key];
    const dot = expr.indexOf('.');
    const op = dot < 0 ? expr : expr.slice(0, dot);
    const arg = dot < 0 ? '' : expr.slice(dot + 1);
    switch (op) {
      case 'eq':
        if (v == null || !sameValue(v, arg)) return false;
        break;
      case 'neq':
        if (v != null && sameValue(v, arg)) return false;
        break;
      case 'gt':
        if (v == null || !(compare(v, arg) > 0)) return false;
        break;
      case 'gte':
        if (v == null || !(compare(v, arg) >= 0)) return false;
        break;
      case 'lt':
        if (v == null || !(compare(v, arg) < 0)) return false;
        break;
      case 'lte':
        if (v == null || !(compare(v, arg) <= 0)) return false;
        break;
      case 'in':
        if (v == null || !parseIn(arg).some((x) => sameValue(v, x))) return false;
        break;
      case 'is':
        if (arg === 'null' && v != null) return false;
        if (arg === 'true' && v !== true) return false;
        if (arg === 'false' && v !== false) return false;
        break;
      case 'not':
        if (arg === 'is.null' && v == null) return false;
        if (arg.startsWith('eq.') && v != null && sameValue(v, arg.slice(3))) return false;
        break;
      default:
        break;
    }
  }
  return true;
}

function sortRows(rows: Row[], order: string): Row[] {
  const keys = order.split(',').map((p) => {
    const [col, ...mods] = p.split('.');
    const desc = mods.includes('desc');
    const nulls = mods.includes('nullsfirst') ? 'first' : mods.includes('nullslast') ? 'last' : desc ? 'first' : 'last';
    return { col, desc, nulls };
  });
  return [...rows].sort((a, b) => {
    for (const { col, desc, nulls } of keys) {
      const x = a[col];
      const y = b[col];
      if (x == null || y == null) {
        if (x == null && y == null) continue;
        // nulls 'first': el nulo va antes; 'last': va después
        const xIsNull = x == null;
        return nulls === 'first' ? (xIsNull ? -1 : 1) : xIsNull ? 1 : -1;
      }
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x) < String(y) ? -1 : String(x) > String(y) ? 1 : 0;
      if (c !== 0) return desc ? -c : c;
    }
    return 0;
  });
}

/** Filtra, ordena y limita como lo haría el servidor. `offset=false` omite el desplazamiento (filas ya paginadas). */
export function applyQuery(rows: Row[], params: URLSearchParams, opts: { offset?: boolean } = {}): Row[] {
  let out = rows.filter((r) => matchesFilters(r, params));
  const order = params.get('order');
  if (order) out = sortRows(out, order);
  const offset = opts.offset === false ? 0 : Number(params.get('offset') ?? 0);
  if (offset > 0) out = out.slice(offset);
  const limit = params.get('limit');
  if (limit != null && Number(limit) >= 0) out = out.slice(0, Number(limit));
  return out;
}

export function defaultsFor(table: string, nowIso: string): Row {
  switch (table) {
    case 'workout_sessions':
      return { routine_id: null, plan: [], started_at: nowIso, finished_at: null, notes: '' };
    case 'workout_sets':
      return { rpe: null, target_reps: null, created_at: nowIso };
    case 'meal_logs':
      return { food_id: null, recipe_id: null, quantity_g: null, servings: null, created_at: nowIso };
    case 'water_logs':
      return { created_at: nowIso };
    case 'body_metrics':
      return { weight_kg: null, waist_cm: null, hip_cm: null, arm_cm: null, thigh_cm: null, created_at: nowIso, updated_at: nowIso };
    default:
      return {};
  }
}

export interface PendingOp {
  table: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  params: URLSearchParams;
  body: unknown;
  /** Columnas de conflicto si es un «upsert» (Prefer: resolution=merge-duplicates). */
  upsertKeys: string[] | null;
}

/** Aplica los cambios pendientes, en orden, sobre unas filas conocidas. */
export function applyPending(rows: Row[], ops: PendingOp[], nowIso: string): Row[] {
  let out = rows.map((r) => ({ ...r }));
  for (const op of ops) {
    if (op.method === 'POST') {
      const incoming = (Array.isArray(op.body) ? op.body : [op.body]) as Row[];
      for (const r of incoming) {
        if (op.upsertKeys) {
          const keys = op.upsertKeys;
          const i = out.findIndex((x) => keys.every((k) => x[k] != null && String(x[k]) === String(r[k])));
          if (i >= 0) {
            const { id: _newId, ...rest } = r; // al fusionar se conserva el id que ya tenía la fila
            out[i] = { ...out[i], ...rest };
            continue;
          }
        } else if (r.id != null && out.some((x) => x.id === r.id)) {
          continue; // ya está (reintento)
        }
        out.push({ ...defaultsFor(op.table, nowIso), ...r });
      }
    } else if (op.method === 'PATCH') {
      out = out.map((x) => (matchesFilters(x, op.params) ? { ...x, ...(op.body as Row) } : x));
    } else {
      out = out.filter((x) => !matchesFilters(x, op.params));
    }
  }
  return out;
}

/** El valor de `id=eq.<uuid>` de una consulta, si lo tiene. */
export function idFilter(params: URLSearchParams): string | null {
  const v = params.get('id');
  return v && v.startsWith('eq.') ? v.slice(3) : null;
}

/** Id del usuario (campo `sub`) de un JWT, o null si no es un JWT de usuario. */
export function userIdFromJwt(authorization: string | null | undefined): string | null {
  const token = (authorization ?? '').replace(/^Bearer\s+/i, '');
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = decodeURIComponent(
      atobSafe(b64)
        .split('')
        .map((c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0'))
        .join(''),
    );
    const sub = (JSON.parse(json) as { sub?: string; role?: string }).sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

function atobSafe(b64: string): string {
  const padded = b64 + '==='.slice((b64.length + 3) % 4);
  if (typeof atob === 'function') return atob(padded);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let bits = 0;
  let acc = 0;
  for (const c of padded.replace(/=+$/, '')) {
    acc = (acc << 6) | chars.indexOf(c);
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out += String.fromCharCode((acc >> bits) & 0xff);
    }
  }
  return out;
}
