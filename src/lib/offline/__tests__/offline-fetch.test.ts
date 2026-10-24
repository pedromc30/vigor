import { ResponseCache } from '../cache';
import { OfflineQueue, type KV } from '../queue';
import { createFlusher, createOfflineFetch, isNetworkError, NetworkError, type OfflineDeps } from '../offline-fetch';
import { SyncStore } from '../sync-store';

const ORIGIN = 'https://x.supabase.co';
const memory = (): KV => {
  const d: Record<string, string> = {};
  return { getItem: async (k) => d[k] ?? null, setItem: async (k, v) => void (d[k] = v), removeItem: async (k) => void delete d[k] };
};
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
const JWT = `${b64({ alg: 'HS256' })}.${b64({ sub: 'user-1', role: 'authenticated' })}.sig`;
declare const Buffer: { from(s: string): { toString(enc: string): string } };

/** Servidor falso mínimo con interruptor de conexión. */
function setup(opts: { timeoutMs?: number; token?: string | null } = {}) {
  const server = {
    online: true,
    hang: false,
    log: [] as { method: string; path: string; body: unknown; auth: string }[],
    tables: { meal_logs: [] as Record<string, unknown>[], workout_sessions: [] as Record<string, unknown>[], routines: [{ id: 'r1', name: 'A' }] as Record<string, unknown>[] },
  };
  const baseFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (server.hang) return new Promise<Response>(() => undefined);
    if (!server.online) throw new TypeError('Network request failed');
    const u = new URL(String(input));
    const method = init?.method ?? 'GET';
    const h = new Headers(init?.headers);
    server.log.push({ method, path: u.pathname + u.search, body: init?.body ? JSON.parse(String(init.body)) : null, auth: h.get('authorization') ?? '' });
    const table = u.pathname.split('/').pop() as keyof typeof server.tables;
    const rows = server.tables[table];
    const j = (s: number, b: unknown) => new Response(JSON.stringify(b), { status: s, headers: { 'content-type': 'application/json' } });
    if (!rows) return j(200, { ok: true });
    if (method === 'GET') {
      const d = u.searchParams.get('log_date');
      const id = u.searchParams.get('id');
      let out = rows;
      if (d) out = out.filter((r) => `eq.${r.log_date}` === d);
      if (id) out = out.filter((r) => `eq.${r.id}` === id);
      return j(200, out);
    }
    if (method === 'POST') {
      const body = JSON.parse(String(init!.body));
      for (const r of Array.isArray(body) ? body : [body]) {
        if (rows.some((x) => x.id === r.id)) return j(409, { code: '23505' });
        rows.push(r);
      }
      return j(201, []);
    }
    if (method === 'PATCH') {
      const id = u.searchParams.get('id')!.slice(3);
      Object.assign(rows.find((r) => r.id === id) ?? {}, JSON.parse(String(init!.body)));
      return new Response(null, { status: 204 });
    }
    if (method === 'DELETE') {
      const id = u.searchParams.get('id')!.slice(3);
      server.tables[table] = rows.filter((r) => r.id !== id);
      return new Response(null, { status: 204 });
    }
    return j(400, {});
  }) as typeof fetch;

  const store = new SyncStore();
  const queue = new OfflineQueue(memory());
  const deps: OfflineDeps = {
    baseFetch,
    queue,
    cache: new ResponseCache(memory()),
    store,
    getAuth: async () => ({ token: opts.token === undefined ? JWT : opts.token, userId: 'user-1' }),
    apiKey: 'anon-key',
    origin: ORIGIN,
    timeoutMs: opts.timeoutMs ?? 5000,
  };
  const f = createOfflineFetch(deps);
  const flush = createFlusher(deps);
  const call = (method: string, path: string, body?: unknown, headers: Record<string, string> = {}) =>
    f(ORIGIN + path, { method, headers: { apikey: 'anon-key', authorization: `Bearer ${JWT}`, ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
  return { server, store, queue, f, flush, call, deps };
}

const LOG = { user_id: 'user-1', log_date: '2026-10-24', meal: 'desayuno', name: 'Tostada', quantity_g: 50, kcal: 120, protein_g: 4, carbs_g: 20, fat_g: 2 };

describe('lecturas', () => {
  it('con red guarda la respuesta y sin red la devuelve', async () => {
    const t = setup();
    t.server.tables.meal_logs.push({ id: 'a', log_date: '2026-10-24', name: 'Arroz' });
    const online = await (await t.call('GET', '/rest/v1/meal_logs?log_date=eq.2026-10-24')).json();
    t.server.online = false;
    const off = await t.call('GET', '/rest/v1/meal_logs?log_date=eq.2026-10-24');
    expect(off.status).toBe(200);
    expect(await off.json()).toEqual(online);
    expect(t.store.getState().online).toBe(false);
  });

  it('una consulta sin copia guardada falla igual que sin red (no inventa datos)', async () => {
    const t = setup();
    t.server.online = false;
    await expect(t.call('GET', '/rest/v1/routines?select=*')).rejects.toThrow();
  });

  it('las respuestas de error no se guardan ni se disfrazan', async () => {
    const t = setup();
    const r = await t.call('GET', '/rest/v1/nada');
    expect(r.ok).toBe(true); // el servidor falso responde 200 a tablas desconocidas
    t.server.online = false;
    await expect(t.call('GET', '/rest/v1/otra?x=1')).rejects.toThrow();
  });

  it('vuelve a marcar «en línea» cuando una petición funciona', async () => {
    const t = setup();
    t.server.online = false;
    await expect(t.call('GET', '/rest/v1/routines')).rejects.toThrow();
    expect(t.store.getState().online).toBe(false);
    t.server.online = true;
    await t.call('GET', '/rest/v1/routines');
    expect(t.store.getState().online).toBe(true);
  });

  it('una consulta que no responde a tiempo se trata como sin conexión', async () => {
    const t = setup({ timeoutMs: 20 });
    t.server.hang = true;
    await expect(t.call('GET', '/rest/v1/routines')).rejects.toThrow();
    expect(t.store.getState().online).toBe(false);
  });
});

describe('escrituras sin conexión', () => {
  it('se encolan, se ven al instante en las lecturas y se envían al volver la red', async () => {
    const t = setup();
    t.server.tables.meal_logs.push({ id: 'old', log_date: '2026-10-24', name: 'Café' });
    await t.call('GET', '/rest/v1/meal_logs?log_date=eq.2026-10-24'); // calienta la caché
    t.server.online = false;

    const w = await t.call('POST', '/rest/v1/meal_logs', [LOG]);
    expect(w.status).toBe(201);
    expect(t.queue.count).toBe(1);
    expect(t.store.getState().pending).toBe(1);

    const rows = (await (await t.call('GET', '/rest/v1/meal_logs?log_date=eq.2026-10-24')).json()) as { id: string; name: string }[];
    expect(rows.map((r) => r.name)).toEqual(['Café', 'Tostada']);
    expect(rows[1].id).toMatch(/^[0-9a-f-]{36}$/); // id creado en el móvil

    t.server.online = true;
    const r = await t.flush();
    expect(r).toMatchObject({ sent: 1, stopped: null });
    expect(t.queue.count).toBe(0);
    expect(t.store.getState()).toMatchObject({ pending: 0, online: true });
    expect(t.store.getState().version).toBe(1);
    expect(t.server.tables.meal_logs.map((r) => r.name)).toEqual(['Café', 'Tostada']);
    expect(t.server.tables.meal_logs[1].id).toBe(rows[1].id); // el mismo id que se vio en pantalla
  });

  it('al enviar usa el token actual, no el de cuando se hizo el cambio', async () => {
    const t = setup({ token: 'token-nuevo' });
    t.server.online = false;
    await t.call('POST', '/rest/v1/meal_logs', [LOG]);
    t.server.online = true;
    await t.flush();
    expect(t.server.log.at(-1)!.auth).toBe('Bearer token-nuevo');
  });

  it('sin sesión no envía nada y conserva la cola', async () => {
    const t = setup({ token: null });
    t.server.online = false;
    await t.call('POST', '/rest/v1/meal_logs', [LOG]);
    t.server.online = true;
    expect(await t.flush()).toMatchObject({ sent: 0, stopped: 'auth' });
    expect(t.queue.count).toBe(1);
    expect(t.server.log).toHaveLength(0);
  });

  it('crear una sesión sin red devuelve la fila con id y valores por defecto; modificarla se fusiona', async () => {
    const t = setup();
    t.server.online = false;
    const created = await t.call('POST', '/rest/v1/workout_sessions?select=id', [{ user_id: 'user-1', routine_name: 'Empuje', plan: [{ x: 1 }] }], {
      prefer: 'return=representation',
      accept: 'application/vnd.pgrst.object+json',
    });
    const row = (await created.json()) as { id: string; started_at: string; finished_at: null; plan: unknown[] };
    expect(created.status).toBe(201);
    expect(row).toMatchObject({ finished_at: null, plan: [{ x: 1 }] });
    expect(row.id).toBeTruthy();

    // se puede leer como `maybeSingle`/`single`
    const get = await t.call('GET', `/rest/v1/workout_sessions?select=*&id=eq.${row.id}`, undefined, { accept: 'application/vnd.pgrst.object+json' });
    expect(((await get.json()) as { id: string }).id).toBe(row.id);
    const missing = await t.call('GET', '/rest/v1/workout_sessions?select=*&id=eq.otro', undefined, { accept: 'application/vnd.pgrst.object+json' });
    expect(missing.status).toBe(406);

    await t.call('PATCH', `/rest/v1/workout_sessions?id=eq.${row.id}`, { finished_at: '2026-10-24T11:00:00Z' });
    expect(t.queue.count).toBe(1); // fusionado en la creación
    const get2 = await t.call('GET', `/rest/v1/workout_sessions?select=*&id=eq.${row.id}`, undefined, { accept: 'application/vnd.pgrst.object+json' });
    expect(((await get2.json()) as { finished_at: string }).finished_at).toBe('2026-10-24T11:00:00Z');

    t.server.online = true;
    await t.flush();
    expect(t.server.tables.workout_sessions).toHaveLength(1);
    expect(t.server.tables.workout_sessions[0]).toMatchObject({ id: row.id, finished_at: '2026-10-24T11:00:00Z' });
    expect(t.server.log.filter((l) => l.method === 'POST')).toHaveLength(1); // una sola petición
  });

  it('borrar algo creado sin red no envía nada', async () => {
    const t = setup();
    t.server.online = false;
    const c = await t.call('POST', '/rest/v1/meal_logs?select=*', [LOG], { prefer: 'return=representation' });
    const [row] = (await c.json()) as { id: string }[];
    await t.call('DELETE', `/rest/v1/meal_logs?id=eq.${row.id}`);
    expect(t.queue.count).toBe(0);
    const list = (await (await t.call('GET', '/rest/v1/meal_logs?log_date=eq.2026-10-24')).json()) as unknown[];
    expect(list).toEqual([]);
  });

  it('con cambios pendientes, las nuevas escrituras esperan su turno aunque haya red', async () => {
    const t = setup();
    t.server.online = false;
    await t.call('POST', '/rest/v1/meal_logs', [{ ...LOG, name: 'Primero' }]);
    t.server.online = true;
    await t.call('POST', '/rest/v1/meal_logs', [{ ...LOG, name: 'Segundo' }]);
    expect(t.server.log).toHaveLength(0); // aún nada ha llegado al servidor
    expect(t.queue.count).toBe(2);
    await t.flush();
    expect(t.server.tables.meal_logs.map((r) => r.name)).toEqual(['Primero', 'Segundo']);
  });

  it('con red y cola vacía la escritura va directa (con id propio)', async () => {
    const t = setup();
    const r = await t.call('POST', '/rest/v1/meal_logs', [LOG]);
    expect(r.status).toBe(201);
    expect(t.queue.count).toBe(0);
    expect((t.server.log[0].body as { id: string }[])[0].id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('si la petición llegó pero no se supo (timeout), el reenvío no duplica', async () => {
    const t = setup({ timeoutMs: 20 });
    // el servidor guarda la fila pero tarda más que el límite en contestar
    const realFetch = t.deps.baseFetch;
    let first = true;
    t.deps.baseFetch = (async (i: RequestInfo | URL, init?: RequestInit) => {
      if (first && init?.method === 'POST') {
        first = false;
        await realFetch(i, init);
        return new Promise<Response>(() => undefined);
      }
      return realFetch(i, init);
    }) as typeof fetch;
    const f = createOfflineFetch(t.deps);
    const flush = createFlusher(t.deps);
    await f(ORIGIN + '/rest/v1/meal_logs', { method: 'POST', headers: { authorization: `Bearer ${JWT}` }, body: JSON.stringify([LOG]) });
    expect(t.queue.count).toBe(1);
    expect(t.server.tables.meal_logs).toHaveLength(1);
    const r = await flush();
    expect(r).toMatchObject({ sent: 1, failures: [] }); // el 409 cuenta como ya aplicado
    expect(t.server.tables.meal_logs).toHaveLength(1);
  });

  it('las tablas que no se pueden usar sin red siguen fallando sin red', async () => {
    const t = setup();
    t.server.online = false;
    await expect(t.call('POST', '/rest/v1/routines', [{ name: 'X' }])).rejects.toThrow();
    expect(t.queue.count).toBe(0);
  });

  it('auth y rpc pasan sin tocarse', async () => {
    const t = setup();
    t.server.online = false;
    await expect(t.f(ORIGIN + '/auth/v1/token', { method: 'POST' })).rejects.toThrow();
    await expect(t.f(ORIGIN + '/rest/v1/rpc/save_routine', { method: 'POST', body: '{}' })).rejects.toThrow();
    expect(t.queue.count).toBe(0);
  });
});

describe('isNetworkError', () => {
  it('reconoce los fallos de red típicos', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
    expect(isNetworkError(new NetworkError('timeout'))).toBe(true);
    const abort = new Error('x');
    abort.name = 'AbortError';
    expect(isNetworkError(abort)).toBe(true);
    expect(isNetworkError(new Error('Unexpected token'))).toBe(false);
  });
});
