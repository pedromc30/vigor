// Capa que se interpone en las peticiones de Supabase para funcionar sin conexión:
//  - Lecturas: se guarda la última respuesta de cada consulta y, sin red, se devuelve esa (más los cambios pendientes).
//  - Escrituras de las tablas «encolables»: sin red se guardan en una cola, se ven al instante y se envían en
//    orden al volver la conexión. Las demás escrituras (rutinas, recetas, perfil…) siguen necesitando red.
import { OfflineQueue, flushQueue, type FlushResult, type QueuedRequest } from './queue';
import { ResponseCache } from './cache';
import { SyncStore } from './sync-store';
import { applyPending, applyQuery, isQueueable, newId, parseRestUrl, userIdFromJwt, type Row } from './rest-query';

export interface OfflineDeps {
  baseFetch: typeof fetch;
  queue: OfflineQueue;
  cache: ResponseCache;
  store: SyncStore;
  /** Access token vigente (o null) e id del usuario, para reenviar la cola con credenciales frescas. */
  getAuth(): Promise<{ token: string | null; userId: string | null }>;
  /** Clave pública (anon/publishable) que va en la cabecera `apikey`. */
  apiKey: string;
  origin: string;
  now?: () => number;
  timeoutMs?: number;
}

const JSON_HEADERS = { 'content-type': 'application/json' };

export class NetworkError extends Error {}

export function isNetworkError(e: unknown): boolean {
  if (e instanceof NetworkError) return true;
  const msg = e instanceof Error ? e.message : String(e);
  return (
    e instanceof TypeError ||
    (e instanceof Error && e.name === 'AbortError') ||
    /network request failed|failed to fetch|fetch failed|network error|load failed|timeout/i.test(msg)
  );
}

function headersToObject(h: HeadersInit | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!h) return out;
  if (typeof (h as Headers).forEach === 'function' && !Array.isArray(h)) (h as Headers).forEach((v, k) => (out[k.toLowerCase()] = v));
  else if (Array.isArray(h)) for (const [k, v] of h) out[k.toLowerCase()] = v;
  else for (const [k, v] of Object.entries(h)) out[k.toLowerCase()] = String(v);
  return out;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

const NOT_ONE_ROW = {
  code: 'PGRST116',
  details: 'The result contains 0 rows',
  hint: null,
  message: 'JSON object requested, multiple (or no) rows returned',
};

/** Da forma de respuesta a unas filas según lo que pidió el cliente (lista, o un solo objeto). */
function shaped(rows: Row[], wantsObject: boolean, status = 200): Response {
  if (!wantsObject) return json(status, rows);
  return rows.length === 1 ? json(status, rows[0]) : json(406, NOT_ONE_ROW);
}

export function createOfflineFetch(deps: OfflineDeps): typeof fetch {
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? 12000;

  const withTimeout = <T,>(p: Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const t = setTimeout(() => reject(new NetworkError('timeout')), timeoutMs);
      p.then(
        (v) => (clearTimeout(t), resolve(v)),
        (e) => (clearTimeout(t), reject(e)),
      );
    });

  const markOnline = () => {
    if (!deps.store.getState().online) deps.store.set({ online: true });
  };
  const markOffline = () => deps.store.set({ online: false });

  async function handleGet(input: RequestInfo | URL, init: RequestInit | undefined, url: string, table: string, params: URLSearchParams, headers: Record<string, string>) {
    const wantsObject = (headers.accept ?? '').includes('vnd.pgrst.object');
    const key = `${url}|${wantsObject ? 'o' : 'a'}`;
    const overlayable = isQueueable(table) && !(params.get('select') ?? '').includes('(');
    const pending = overlayable ? deps.queue.pendingOps(table) : [];

    // `base` son filas de esa misma consulta (ya paginadas) si `hasBase`; si no, solo hay lo creado en el móvil.
    const compose = (base: Row[], hasBase: boolean) => {
      const merged = pending.length ? applyPending(base, pending, new Date(now()).toISOString()) : base;
      return applyQuery(merged, params, { offset: !hasBase });
    };

    try {
      const res = await withTimeout(deps.baseFetch(input as RequestInfo, init));
      markOnline();
      if (!res.ok) return res;
      const text = await res.clone().text();
      void deps.cache.set(key, text);
      if (!pending.length) return res;
      let parsed: Row | Row[];
      try {
        parsed = JSON.parse(text) as Row | Row[];
      } catch {
        return res; // cuerpo vacío o no JSON: se devuelve tal cual
      }
      return shaped(compose(Array.isArray(parsed) ? parsed : [parsed], true), wantsObject);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      markOffline();
      const cached = await deps.cache.get(key);
      if (cached) {
        if (!overlayable || !pending.length) return new Response(cached, { status: 200, headers: JSON_HEADERS });
        const parsed = JSON.parse(cached) as Row | Row[];
        return shaped(compose(Array.isArray(parsed) ? parsed : [parsed], true), wantsObject);
      }
      if (overlayable) return shaped(compose([], false), wantsObject); // solo lo creado en el móvil
      throw e;
    }
  }

  async function handleMutation(
    input: RequestInfo | URL,
    init: RequestInit,
    parsed: NonNullable<ReturnType<typeof parseRestUrl>>,
    method: 'POST' | 'PATCH' | 'DELETE',
    headers: Record<string, string>,
  ) {
    const { table, params, path } = parsed;
    let body = typeof init.body === 'string' ? init.body : null;
    let rows: Row[] = [];
    if (method === 'POST' && body) {
      const raw = JSON.parse(body) as Row | Row[];
      rows = (Array.isArray(raw) ? raw : [raw]).map((r) => (r.id ? r : { ...r, id: newId() })); // ids propios: reenviar es seguro
      body = JSON.stringify(Array.isArray(raw) ? rows : rows[0]);
    }
    const prefer = headers.prefer ?? '';
    const wantsRepresentation = prefer.includes('return=representation');
    const wantsObject = (headers.accept ?? '').includes('vnd.pgrst.object');
    const upsertKeys = method === 'POST' && prefer.includes('resolution=merge-duplicates') ? (params.get('on_conflict')?.split(',') ?? ['id']) : null;

    // Con cambios pendientes se mantiene el orden: nada se envía por delante de la cola.
    if (deps.queue.count === 0) {
      try {
        const res = await withTimeout(deps.baseFetch(input as RequestInfo, { ...init, body: body ?? undefined }));
        markOnline();
        return res;
      } catch (e) {
        if (!isNetworkError(e)) throw e;
        markOffline();
      }
    }

    const auth = headers.authorization ?? '';
    const userId = userIdFromJwt(auth) ?? (await deps.getAuth()).userId;
    const keep: Record<string, string> = {};
    for (const k of ['apikey', 'content-type', 'prefer', 'accept']) if (headers[k]) keep[k] = headers[k];
    await deps.queue.enqueue({ table, method, path, headers: keep, body, userId });
    deps.store.set({ pending: deps.queue.count });

    if (method === 'POST' && wantsRepresentation) {
      const nowIso = new Date(now()).toISOString();
      const out = applyPending([], [{ table, method, params, body: rows, upsertKeys: null }], nowIso);
      return shaped(out, wantsObject, 201);
    }
    return new Response(null, { status: method === 'POST' ? 201 : 204 });
  }

  const offlineFetch = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url;
    const parsed = parseRestUrl(url);
    if (!parsed || !url.startsWith(deps.origin)) return deps.baseFetch(input as RequestInfo, init);
    const method = (init?.method ?? 'GET').toUpperCase();
    const headers = headersToObject(init?.headers);

    if (method === 'GET') return handleGet(input, init, url, parsed.table, parsed.params, headers);
    if (isQueueable(parsed.table) && (method === 'POST' || method === 'PATCH' || method === 'DELETE')) {
      return handleMutation(input, init ?? {}, parsed, method, headers);
    }
    return deps.baseFetch(input as RequestInfo, init);
  }) as typeof fetch;

  return offlineFetch;
}

/** Envía la cola con credenciales actuales. Se puede llamar muchas veces: solo corre un envío a la vez. */
export function createFlusher(deps: OfflineDeps) {
  let running: Promise<FlushResult | null> | null = null;
  const timeoutMs = deps.timeoutMs ?? 12000;

  const send = async (req: QueuedRequest): Promise<{ status: number }> => {
    const { token } = await deps.getAuth();
    const headers: Record<string, string> = { ...req.headers, apikey: req.headers.apikey ?? deps.apiKey, authorization: `Bearer ${token ?? deps.apiKey}` };
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = setTimeout(() => ctrl?.abort(), timeoutMs);
    try {
      const res = await deps.baseFetch(deps.origin + req.path, { method: req.method, headers, body: req.body ?? undefined, signal: ctrl?.signal });
      return { status: res.status };
    } finally {
      clearTimeout(timer);
    }
  };

  return async function flush(): Promise<FlushResult | null> {
    if (running) return running;
    if (deps.queue.count === 0) return null;
    running = (async () => {
      deps.store.set({ syncing: true });
      try {
        const { userId, token } = await deps.getAuth();
        if (!token) return { sent: 0, failures: [], stopped: 'auth' as const };
        const result = await flushQueue(deps.queue, { send, currentUserId: () => userId });
        deps.store.set({
          pending: deps.queue.count,
          online: result.stopped === 'offline' ? false : true,
          failures: result.failures.length ? [...deps.store.getState().failures, ...result.failures] : deps.store.getState().failures,
        });
        if (result.sent > 0 || result.failures.length) deps.store.bumpVersion();
        return result;
      } finally {
        deps.store.set({ syncing: false });
        running = null;
      }
    })();
    return running;
  };
}
