import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { ResponseCache } from './cache';
import { createFlusher, createOfflineFetch } from './offline-fetch';
import { OfflineQueue } from './queue';
import { SyncStore } from './sync-store';

const OWNER_KEY = 'vigor.offline.owner';
const POLL_MS = 15000;

/** Instancia real de la capa sin conexión (almacenamiento del dispositivo y red del sistema). */
export function createOfflineRuntime(opts: {
  url: string;
  anonKey: string;
  getSession: () => Promise<{ data: { session: { access_token: string; user: { id: string } } | null } }>;
}) {
  const store = new SyncStore();
  const queue = new OfflineQueue(AsyncStorage);
  const cache = new ResponseCache(AsyncStorage);
  const baseFetch: typeof fetch = (input, init) => fetch(input, init);

  const deps = {
    baseFetch,
    queue,
    cache,
    store,
    apiKey: opts.anonKey,
    origin: opts.url.replace(/\/$/, ''),
    getAuth: async () => {
      try {
        const { data } = await opts.getSession();
        return { token: data.session?.access_token ?? null, userId: data.session?.user.id ?? null };
      } catch {
        return { token: null, userId: null };
      }
    },
  };

  const ready = queue.load().then(() => store.set({ pending: queue.count }));
  const inner = createOfflineFetch(deps);
  const offlineFetch: typeof fetch = async (input, init) => {
    await ready;
    return inner(input, init);
  };
  const flush = createFlusher(deps);

  /** Comprueba si hay conexión con el servidor (cualquier respuesta HTTP vale). */
  async function probe(): Promise<boolean> {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      await baseFetch(`${deps.origin}/auth/v1/health`, { headers: { apikey: opts.anonKey }, signal: ctrl.signal });
      clearTimeout(t);
      store.set({ online: true });
      return true;
    } catch {
      store.set({ online: false });
      return false;
    }
  }

  async function tick() {
    await ready;
    if (queue.count > 0 || !store.getState().online) {
      if (!(await probe())) return;
    }
    if (queue.count > 0) await flush();
  }

  /** Reenvía lo pendiente al volver la red, al abrir la app y cada pocos segundos mientras haga falta. */
  function startSync(): () => void {
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && void tick());
    const unsub = store.subscribe(() => {
      const s = store.getState();
      if (s.online && s.pending > 0 && !s.syncing) void flush();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
      unsub();
    };
  }

  /** Borra la caché y la cola del dispositivo (al cerrar sesión o eliminar la cuenta). */
  async function clearAll() {
    await ready;
    await Promise.all([cache.clear(), queue.clear()]);
    await AsyncStorage.removeItem(OWNER_KEY).catch(() => undefined);
    store.set({ pending: 0, failures: [] });
  }

  /** Si entra un usuario distinto del que dejó datos en el dispositivo, se descartan esos datos. */
  async function adoptUser(userId: string) {
    await ready;
    const owner = await AsyncStorage.getItem(OWNER_KEY).catch(() => null);
    if (owner && owner !== userId) await clearAll();
    await AsyncStorage.setItem(OWNER_KEY, userId).catch(() => undefined);
  }

  return { fetch: offlineFetch, store, queue, flush, startSync, clearAll, adoptUser, probe };
}
