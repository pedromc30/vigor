import { idFilter, type PendingOp, type Row } from './rest-query';

export interface KV {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface QueuedRequest {
  seq: number;
  table: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  /** Ruta y consulta relativas al host (/rest/v1/tabla?…). */
  path: string;
  headers: Record<string, string>;
  body: string | null;
  userId: string | null;
  createdAt: number;
  attempts: number;
}

export type NewRequest = Omit<QueuedRequest, 'seq' | 'attempts' | 'createdAt'>;

const paramsOf = (path: string) => new URLSearchParams(path.split('?')[1] ?? '');

/** El cuerpo de una creación puede ser una fila (objeto) o varias (lista); se conserva su forma al reescribirlo. */
function readRows(body: string): { rows: Row[]; single: boolean } {
  const parsed = JSON.parse(body) as Row | Row[];
  return Array.isArray(parsed) ? { rows: parsed, single: false } : { rows: [parsed], single: true };
}
const writeRows = (rows: Row[], single: boolean) => JSON.stringify(single ? rows[0] : rows);

/** Cola de escrituras pendientes, guardada en el dispositivo. */
export class OfflineQueue {
  items: QueuedRequest[] = [];
  private nextSeq = 1;
  private writing: Promise<void> = Promise.resolve();

  constructor(
    private kv: KV,
    private key = 'vigor.queue.v1',
    private now: () => number = Date.now,
  ) {}

  async load(): Promise<void> {
    try {
      const raw = await this.kv.getItem(this.key);
      this.items = raw ? (JSON.parse(raw) as QueuedRequest[]) : [];
    } catch {
      this.items = [];
    }
    this.nextSeq = this.items.reduce((m, i) => Math.max(m, i.seq), 0) + 1;
  }

  get count(): number {
    return this.items.length;
  }

  private persist(): Promise<void> {
    const snapshot = JSON.stringify(this.items);
    // Se encadenan las escrituras para que no se pisen entre sí.
    this.writing = this.writing.then(() => this.kv.setItem(this.key, snapshot)).catch(() => undefined);
    return this.writing;
  }

  /**
   * Añade una petición compactando lo que se pueda:
   *  - borrar una fila creada y aún no enviada elimina esa creación (y sus modificaciones) en vez de enviar nada;
   *  - modificar una fila aún no enviada fusiona el cambio dentro de la petición que la crea o de otra modificación.
   */
  async enqueue(req: NewRequest): Promise<{ merged: boolean }> {
    const id = idFilter(paramsOf(req.path));
    const sameTable = (q: QueuedRequest) => q.table === req.table && q.userId === req.userId;

    if (id && req.method === 'DELETE') {
      let cancelled = false;
      for (const q of [...this.items]) {
        if (!sameTable(q)) continue;
        if (q.method === 'POST' && q.body) {
          const { rows, single } = readRows(q.body);
          const kept = rows.filter((r) => r.id !== id);
          if (kept.length !== rows.length) {
            cancelled = true;
            if (kept.length) q.body = writeRows(kept, single && kept.length === 1);
            else this.items = this.items.filter((x) => x !== q);
          }
        } else if (q.method === 'PATCH' && idFilter(paramsOf(q.path)) === id) {
          this.items = this.items.filter((x) => x !== q);
        }
      }
      if (cancelled) {
        await this.persist();
        return { merged: true };
      }
    }

    if (id && req.method === 'PATCH' && req.body) {
      const patch = JSON.parse(req.body) as Row;
      for (const q of this.items) {
        if (!sameTable(q)) continue;
        if (q.method === 'POST' && q.body) {
          const { rows, single } = readRows(q.body);
          const row = rows.find((r) => r.id === id);
          if (row) {
            Object.assign(row, patch);
            q.body = writeRows(rows, single);
            await this.persist();
            return { merged: true };
          }
        }
        if (q.method === 'PATCH' && idFilter(paramsOf(q.path)) === id && q.body) {
          q.body = JSON.stringify({ ...(JSON.parse(q.body) as Row), ...patch });
          await this.persist();
          return { merged: true };
        }
      }
    }

    this.items.push({ ...req, seq: this.nextSeq++, attempts: 0, createdAt: this.now() });
    await this.persist();
    return { merged: false };
  }

  async remove(seq: number): Promise<void> {
    this.items = this.items.filter((i) => i.seq !== seq);
    await this.persist();
  }

  async markAttempt(seq: number): Promise<number> {
    const it = this.items.find((i) => i.seq === seq);
    if (!it) return 0;
    it.attempts += 1;
    await this.persist();
    return it.attempts;
  }

  /** Vacía la cola y elimina su entrada del almacenamiento. */
  async clear(): Promise<void> {
    this.items = [];
    await this.writing;
    this.writing = this.kv.removeItem(this.key).catch(() => undefined);
    await this.writing;
  }

  /** Cambios pendientes de una tabla, listos para aplicarlos sobre filas conocidas. */
  pendingOps(table: string): PendingOp[] {
    return this.items
      .filter((i) => i.table === table)
      .map((i) => {
        const params = paramsOf(i.path);
        const upsert = (i.headers.prefer ?? '').includes('resolution=merge-duplicates');
        return {
          table,
          method: i.method,
          params,
          body: i.body ? JSON.parse(i.body) : null,
          upsertKeys: upsert ? (params.get('on_conflict')?.split(',') ?? ['id']) : null,
        };
      });
  }
}

export interface Failure {
  seq: number;
  table: string;
  method: string;
  status: number;
  /** Mensaje que devolvió el servidor, para saber por qué rechazó el cambio. */
  detail?: string;
  at: number;
}

export interface FlushDeps {
  /** Envía una petición. Lanza si no hay red. */
  send(req: QueuedRequest): Promise<{ status: number; detail?: string }>;
  currentUserId(): string | null;
  maxAttempts?: number;
}

export interface FlushResult {
  sent: number;
  failures: Failure[];
  stopped: null | 'offline' | 'auth' | 'server' | 'user';
}

/**
 * Envía la cola en orden. Se detiene al primer problema recuperable (sin red, sesión caducada, servidor caído)
 * y descarta —registrándolas— las peticiones que el servidor rechaza de forma definitiva (4xx).
 * Un 409 en una creación se considera ya aplicada (el reintento de una petición que sí llegó).
 */
export async function flushQueue(queue: OfflineQueue, deps: FlushDeps): Promise<FlushResult> {
  const result: FlushResult = { sent: 0, failures: [], stopped: null };
  const maxAttempts = deps.maxAttempts ?? 10;
  for (const item of [...queue.items]) {
    const user = deps.currentUserId();
    if (item.userId && user && item.userId !== user) {
      result.stopped = 'user';
      return result;
    }
    let status: number;
    let detail: string | undefined;
    try {
      ({ status, detail } = await deps.send(item));
    } catch {
      result.stopped = 'offline';
      return result;
    }
    if ((status >= 200 && status < 300) || (status === 409 && item.method === 'POST')) {
      await queue.remove(item.seq);
      result.sent++;
    } else if (status === 401) {
      result.stopped = 'auth';
      return result;
    } else if (status >= 500 || status === 429) {
      const attempts = await queue.markAttempt(item.seq);
      if (attempts >= maxAttempts) {
        result.failures.push({ seq: item.seq, table: item.table, method: item.method, status, at: Date.now() });
        await queue.remove(item.seq);
      } else {
        result.stopped = 'server';
        return result;
      }
    } else {
      result.failures.push({ seq: item.seq, table: item.table, method: item.method, status, detail, at: Date.now() });
      await queue.remove(item.seq);
    }
  }
  return result;
}
