import { applyPending, applyQuery, idFilter, isQueueable, matchesFilters, newId, parseRestUrl, userIdFromJwt, type PendingOp, type Row } from '../rest-query';

const q = (s: string) => new URLSearchParams(s);
const NOW = '2026-10-24T10:00:00.000Z';

describe('parseRestUrl', () => {
  it('reconoce tablas y descarta auth, storage y rpc', () => {
    expect(parseRestUrl('https://x.supabase.co/rest/v1/meal_logs?log_date=eq.2026-10-24')).toMatchObject({ table: 'meal_logs', path: '/rest/v1/meal_logs?log_date=eq.2026-10-24' });
    expect(parseRestUrl('https://x.supabase.co/rest/v1/rpc/save_routine')).toBeNull();
    expect(parseRestUrl('https://x.supabase.co/auth/v1/token?grant_type=refresh_token')).toBeNull();
    expect(parseRestUrl('https://x.supabase.co/storage/v1/object/a')).toBeNull();
    expect(parseRestUrl('no es una url')).toBeNull();
  });
  it('isQueueable', () => {
    expect(isQueueable('workout_sets')).toBe(true);
    expect(isQueueable('routines')).toBe(false);
  });
});

describe('newId', () => {
  it('genera UUID v4 con formato válido y distintos', () => {
    const a = newId();
    const b = newId();
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(a).not.toBe(b);
  });
});

describe('matchesFilters', () => {
  const row: Row = { id: 'a', log_date: '2026-10-24', kcal: 250.5, done: true, finished_at: null, meal: 'comida', n: 3 };
  it.each([
    ['log_date=eq.2026-10-24', true],
    ['log_date=eq.2026-10-25', false],
    ['kcal=eq.250.5', true],
    ['kcal=gte.250', true],
    ['kcal=gt.250.5', false],
    ['kcal=lt.300&kcal=gte.100', true],
    ['log_date=lt.2026-10-24', false],
    ['log_date=lte.2026-10-24', true],
    ['meal=neq.cena', true],
    ['meal=neq.comida', false],
    ['finished_at=is.null', true],
    ['log_date=is.null', false],
    ['finished_at=not.is.null', false],
    ['log_date=not.is.null', true],
    ['meal=in.(desayuno,comida)', true],
    ['meal=in.(desayuno,cena)', false],
    ['n=eq.3', true],
    ['done=is.true', true],
    ['select=*&order=id&limit=3', true],
    ['workout_sessions.finished_at=not.is.null', true], // filtro sobre una relación: no se puede evaluar → no descarta
    ['raro=algo.desconocido', true],
  ])('%s → %s', (query, expected) => {
    expect(matchesFilters(row, q(query))).toBe(expected);
  });
});

describe('applyQuery', () => {
  const rows: Row[] = [
    { id: 1, d: '2026-10-22', created_at: 'b', v: 3 },
    { id: 2, d: '2026-10-24', created_at: 'a', v: null },
    { id: 3, d: '2026-10-23', created_at: 'c', v: 1 },
    { id: 4, d: '2026-10-24', created_at: 'd', v: 2 },
  ];
  const ids = (r: Row[]) => r.map((x) => x.id);
  it('filtra y ordena asc/desc con varios criterios', () => {
    expect(ids(applyQuery(rows, q('order=d.desc,created_at.asc')))).toEqual([2, 4, 3, 1]);
    expect(ids(applyQuery(rows, q('d=gte.2026-10-23&order=created_at.desc')))).toEqual([4, 3, 2]);
  });
  it('nulos: al final en ascendente y al principio en descendente (como Postgres)', () => {
    expect(ids(applyQuery(rows, q('order=v.asc')))).toEqual([3, 4, 1, 2]);
    expect(ids(applyQuery(rows, q('order=v.desc')))).toEqual([2, 1, 4, 3]);
    expect(ids(applyQuery(rows, q('order=v.asc.nullsfirst')))).toEqual([2, 3, 4, 1]);
  });
  it('limit y offset', () => {
    expect(ids(applyQuery(rows, q('order=id.asc&limit=2')))).toEqual([1, 2]);
    expect(ids(applyQuery(rows, q('order=id.asc&offset=1&limit=2')))).toEqual([2, 3]);
    expect(ids(applyQuery(rows, q('order=id.asc&offset=1&limit=2'), { offset: false }))).toEqual([1, 2]);
  });
});

const op = (method: PendingOp['method'], query: string, body: unknown, upsertKeys: string[] | null = null, table = 'workout_sets'): PendingOp => ({
  table,
  method,
  params: q(query),
  body,
  upsertKeys,
});

describe('applyPending', () => {
  it('POST añade filas con valores por defecto sin pisar lo enviado', () => {
    const r = applyPending([], [op('POST', '', [{ id: 's1', session_id: 'x', weight_kg: 60, reps: 8 }])], NOW);
    expect(r).toEqual([{ rpe: null, target_reps: null, created_at: NOW, id: 's1', session_id: 'x', weight_kg: 60, reps: 8 }]);
  });
  it('un POST repetido con el mismo id no duplica la fila', () => {
    const o = op('POST', '', [{ id: 's1', reps: 8 }]);
    expect(applyPending([], [o, o], NOW)).toHaveLength(1);
  });
  it('upsert: fusiona por las columnas de conflicto y conserva el id existente', () => {
    const base: Row[] = [{ id: 'old', user_id: 'u', measured_on: '2026-10-24', weight_kg: 80, waist_cm: null }];
    const o = op('POST', 'on_conflict=user_id,measured_on', [{ id: 'new', user_id: 'u', measured_on: '2026-10-24', waist_cm: 85 }], ['user_id', 'measured_on'], 'body_metrics');
    const r = applyPending(base, [o], NOW);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ id: 'old', weight_kg: 80, waist_cm: 85 });
  });
  it('upsert sin fila previa inserta una nueva', () => {
    const o = op('POST', '', [{ id: 'n', user_id: 'u', measured_on: '2026-10-25', weight_kg: 79 }], ['user_id', 'measured_on'], 'body_metrics');
    expect(applyPending([], [o], NOW)[0]).toMatchObject({ id: 'n', weight_kg: 79, waist_cm: null });
  });
  it('PATCH y DELETE actúan sobre las filas que cumplen el filtro', () => {
    const base: Row[] = [{ id: 'a', finished_at: null }, { id: 'b', finished_at: null }];
    let r = applyPending(base, [op('PATCH', 'id=eq.a', { finished_at: 'ya' }, null, 'workout_sessions')], NOW);
    expect(r).toEqual([{ id: 'a', finished_at: 'ya' }, { id: 'b', finished_at: null }]);
    r = applyPending(r, [op('DELETE', 'id=eq.b', null, null, 'workout_sessions')], NOW);
    expect(r).toEqual([{ id: 'a', finished_at: 'ya' }]);
  });
  it('respeta el orden: insertar, modificar y borrar', () => {
    const r = applyPending([], [op('POST', '', [{ id: 'z', reps: 5 }]), op('PATCH', 'id=eq.z', { reps: 6 }), op('POST', '', [{ id: 'y', reps: 1 }]), op('DELETE', 'id=eq.y', null)], NOW);
    expect(r.map((x) => [x.id, x.reps])).toEqual([['z', 6]]);
  });
  it('no modifica las filas de entrada', () => {
    const base: Row[] = [{ id: 'a', v: 1 }];
    applyPending(base, [op('PATCH', 'id=eq.a', { v: 2 })], NOW);
    expect(base[0].v).toBe(1);
  });
});

describe('idFilter', () => {
  it('extrae el id de id=eq.<uuid>', () => {
    expect(idFilter(q('id=eq.abc'))).toBe('abc');
    expect(idFilter(q('id=in.(a,b)'))).toBeNull();
    expect(idFilter(q('session_id=eq.abc'))).toBeNull();
  });
});

describe('userIdFromJwt', () => {
  const b = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  it('lee el sub de un JWT (con y sin prefijo Bearer)', () => {
    const jwt = `${b({ alg: 'HS256' })}.${b({ sub: 'user-1', role: 'authenticated' })}.sig`;
    expect(userIdFromJwt(jwt)).toBe('user-1');
    expect(userIdFromJwt(`Bearer ${jwt}`)).toBe('user-1');
  });
  it('devuelve null con claves anónimas, vacío o basura', () => {
    expect(userIdFromJwt(`Bearer ${b({ alg: 'x' })}.${b({ role: 'anon' })}.s`)).toBeNull();
    expect(userIdFromJwt('sb_publishable_abc')).toBeNull();
    expect(userIdFromJwt('')).toBeNull();
    expect(userIdFromJwt(undefined)).toBeNull();
    expect(userIdFromJwt('a.@@@.c')).toBeNull();
  });
});
declare const Buffer: { from(s: string): { toString(enc: string): string } };
