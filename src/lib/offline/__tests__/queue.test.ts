import { OfflineQueue, flushQueue, type KV, type NewRequest, type QueuedRequest } from '../queue';

const memory = (): KV & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: async (k) => data[k] ?? null, setItem: async (k, v) => void (data[k] = v), removeItem: async (k) => void delete data[k] };
};

const post = (table: string, rows: object[], extra: Partial<NewRequest> = {}): NewRequest => ({
  table, method: 'POST', path: `/rest/v1/${table}`, headers: { prefer: 'return=representation' }, body: JSON.stringify(rows), userId: 'u1', ...extra,
});
const patch = (table: string, id: string, body: object): NewRequest => ({ table, method: 'PATCH', path: `/rest/v1/${table}?id=eq.${id}`, headers: {}, body: JSON.stringify(body), userId: 'u1' });
const del = (table: string, id: string): NewRequest => ({ table, method: 'DELETE', path: `/rest/v1/${table}?id=eq.${id}`, headers: {}, body: null, userId: 'u1' });

describe('OfflineQueue', () => {
  it('guarda en disco y se recupera al cargar, conservando el orden y la numeración', async () => {
    const kv = memory();
    const q = new OfflineQueue(kv);
    await q.enqueue(post('meal_logs', [{ id: 'a' }]));
    await q.enqueue(post('water_logs', [{ id: 'b' }]));
    const q2 = new OfflineQueue(kv);
    await q2.load();
    expect(q2.items.map((i) => [i.seq, i.table])).toEqual([[1, 'meal_logs'], [2, 'water_logs']]);
    await q2.enqueue(post('water_logs', [{ id: 'c' }]));
    expect(q2.items[2].seq).toBe(3);
  });

  it('clear() vacía la cola y elimina su clave del almacenamiento', async () => {
    const kv = memory();
    const q = new OfflineQueue(kv);
    await q.enqueue(post('meal_logs', [{ id: 'a' }]));
    expect(kv.data['vigor.queue.v1']).toBeDefined();
    await q.clear();
    expect(q.count).toBe(0);
    expect(kv.data['vigor.queue.v1']).toBeUndefined();
  });

  it('un almacenamiento corrupto no rompe la carga', async () => {
    const kv = memory();
    kv.data['vigor.queue.v1'] = '{no es json';
    const q = new OfflineQueue(kv);
    await q.load();
    expect(q.count).toBe(0);
  });

  it('borrar una fila creada y no enviada elimina la creación y no encola nada', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue(post('workout_sets', [{ id: 's1', reps: 8 }, { id: 's2', reps: 9 }]));
    const r = await q.enqueue(del('workout_sets', 's1'));
    expect(r.merged).toBe(true);
    expect(JSON.parse(q.items[0].body!)).toEqual([{ id: 's2', reps: 9 }]);
    await q.enqueue(del('workout_sets', 's2'));
    expect(q.count).toBe(0);
  });

  it('borrar también descarta las modificaciones pendientes de esa fila', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue(patch('meal_logs', 'x', { kcal: 1 })); // la fila ya estaba en el servidor
    const r = await q.enqueue(del('meal_logs', 'x'));
    expect(r.merged).toBe(false); // hay que borrarla en el servidor
    expect(q.items.map((i) => i.method)).toEqual(['DELETE']);
  });

  it('modificar una fila no enviada fusiona el cambio en su creación', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue(post('workout_sessions', [{ id: 'ss', routine_name: 'A' }]));
    const r = await q.enqueue(patch('workout_sessions', 'ss', { finished_at: 'fin' }));
    expect(r.merged).toBe(true);
    expect(q.count).toBe(1);
    expect(JSON.parse(q.items[0].body!)).toEqual([{ id: 'ss', routine_name: 'A', finished_at: 'fin' }]);
  });

  it('dos modificaciones seguidas de la misma fila del servidor se fusionan', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue(patch('meal_logs', 'm', { kcal: 100 }));
    await q.enqueue(patch('meal_logs', 'm', { quantity_g: 50 }));
    expect(q.count).toBe(1);
    expect(JSON.parse(q.items[0].body!)).toEqual({ kcal: 100, quantity_g: 50 });
  });

  it('no mezcla cambios de otro usuario ni de otra tabla', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue(post('meal_logs', [{ id: 'a' }], { userId: 'otro' }));
    await q.enqueue(patch('meal_logs', 'a', { kcal: 1 }));
    expect(q.count).toBe(2);
  });

  it('pendingOps interpreta los upserts y el cuerpo', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue({ table: 'body_metrics', method: 'POST', path: '/rest/v1/body_metrics?on_conflict=user_id%2Cmeasured_on', headers: { prefer: 'resolution=merge-duplicates' }, body: '[{"id":"1"}]', userId: 'u1' });
    await q.enqueue(post('meal_logs', [{ id: 'z' }]));
    const [op] = q.pendingOps('body_metrics');
    expect(op.upsertKeys).toEqual(['user_id', 'measured_on']);
    expect(q.pendingOps('meal_logs')[0].upsertKeys).toBeNull();
    expect(q.pendingOps('water_logs')).toEqual([]);
  });
});

describe('OfflineQueue con una sola fila (el cuerpo es un objeto, no una lista)', () => {
  const postOne = (table: string, row: object): NewRequest => ({ ...post(table, []), body: JSON.stringify(row) });

  it('modificar una fila creada fusiona el cambio y conserva el objeto', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue(postOne('workout_sessions', { id: 'ss', routine_name: 'A' }));
    const r = await q.enqueue(patch('workout_sessions', 'ss', { finished_at: 'fin' }));
    expect(r.merged).toBe(true);
    expect(JSON.parse(q.items[0].body!)).toEqual({ id: 'ss', routine_name: 'A', finished_at: 'fin' });
  });

  it('borrar una fila creada elimina la creación', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue(postOne('workout_sets', { id: 's1', reps: 8 }));
    const r = await q.enqueue(del('workout_sets', 's1'));
    expect(r.merged).toBe(true);
    expect(q.count).toBe(0);
  });

  it('borrar una de varias deja el resto', async () => {
    const q = new OfflineQueue(memory());
    await q.enqueue(post('meal_logs', [{ id: 'a' }, { id: 'b' }]));
    await q.enqueue(del('meal_logs', 'a'));
    expect(JSON.parse(q.items[0].body!)).toEqual([{ id: 'b' }]);
  });
});

describe('flushQueue', () => {
  const setup = async (reqs: NewRequest[]) => {
    const q = new OfflineQueue(memory());
    for (const r of reqs) await q.enqueue(r);
    return q;
  };
  const deps = (send: (r: QueuedRequest) => Promise<{ status: number }>, user: string | null = 'u1') => ({ send, currentUserId: () => user });

  it('envía en orden y vacía la cola', async () => {
    const q = await setup([post('workout_sessions', [{ id: 'a' }]), post('workout_sets', [{ id: 'b' }]), patch('workout_sessions', 'zz', { notes: 'x' })]);
    const order: string[] = [];
    const r = await flushQueue(q, deps(async (req) => (order.push(`${req.method} ${req.table}`), { status: 201 })));
    expect(r).toMatchObject({ sent: 3, failures: [], stopped: null });
    expect(order).toEqual(['POST workout_sessions', 'POST workout_sets', 'PATCH workout_sessions']);
    expect(q.count).toBe(0);
  });

  it('se detiene sin red y conserva lo que falta (y lo ya enviado se quita)', async () => {
    const q = await setup([post('meal_logs', [{ id: 'a' }]), post('meal_logs', [{ id: 'b' }]), post('water_logs', [{ id: 'c' }])]);
    let n = 0;
    const r = await flushQueue(q, deps(async () => { if (++n === 2) throw new TypeError('Network request failed'); return { status: 201 }; }));
    expect(r).toMatchObject({ sent: 1, stopped: 'offline' });
    expect(q.items.map((i) => i.table)).toEqual(['meal_logs', 'water_logs']);
  });

  it('un 409 al crear cuenta como ya aplicado (reintento de una petición que sí llegó)', async () => {
    const q = await setup([post('meal_logs', [{ id: 'a' }])]);
    const r = await flushQueue(q, deps(async () => ({ status: 409 })));
    expect(r).toMatchObject({ sent: 1, failures: [] });
    expect(q.count).toBe(0);
  });

  it('un rechazo definitivo (4xx) se registra como fallo, se descarta y continúa con el resto', async () => {
    const q = await setup([post('meal_logs', [{ id: 'a' }]), post('water_logs', [{ id: 'b' }])]);
    const r = await flushQueue(q, deps(async (req) => ({ status: req.table === 'meal_logs' ? 422 : 201 })));
    expect(r.sent).toBe(1);
    expect(r.failures).toHaveLength(1);
    expect(r.failures[0]).toMatchObject({ table: 'meal_logs', status: 422 });
    expect(q.count).toBe(0);
  });

  it('401 detiene el envío sin descartar nada', async () => {
    const q = await setup([post('meal_logs', [{ id: 'a' }])]);
    const r = await flushQueue(q, deps(async () => ({ status: 401 })));
    expect(r.stopped).toBe('auth');
    expect(q.count).toBe(1);
  });

  it('un 5xx se reintenta y, tras demasiados intentos, se descarta para no bloquear la cola', async () => {
    const q = await setup([post('meal_logs', [{ id: 'a' }]), post('water_logs', [{ id: 'b' }])]);
    const send = async (req: QueuedRequest) => ({ status: req.table === 'meal_logs' ? 500 : 201 });
    const d = { ...deps(send), maxAttempts: 3 };
    expect((await flushQueue(q, d)).stopped).toBe('server');
    expect((await flushQueue(q, d)).stopped).toBe('server');
    const last = await flushQueue(q, d);
    expect(last.failures).toHaveLength(1);
    expect(last.sent).toBe(1);
    expect(q.count).toBe(0);
  });

  it('no envía cambios de otro usuario', async () => {
    const q = await setup([post('meal_logs', [{ id: 'a' }], { userId: 'otro' })]);
    const send = jest.fn(async () => ({ status: 201 }));
    const r = await flushQueue(q, deps(send, 'u1'));
    expect(r.stopped).toBe('user');
    expect(send).not.toHaveBeenCalled();
    expect(q.count).toBe(1);
  });
});
