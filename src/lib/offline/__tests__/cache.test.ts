import { ResponseCache } from '../cache';
import type { KV } from '../queue';

const memory = (): KV & { data: Record<string, string> } => {
  const data: Record<string, string> = {};
  return { data, getItem: async (k) => data[k] ?? null, setItem: async (k, v) => void (data[k] = v), removeItem: async (k) => void delete data[k] };
};

describe('ResponseCache', () => {
  it('guarda y devuelve por clave, también tras reiniciar (otra instancia)', async () => {
    const kv = memory();
    const c = new ResponseCache(kv);
    await c.set('https://x/rest/v1/a?x=1|a', '[1]');
    expect(await c.get('https://x/rest/v1/a?x=1|a')).toBe('[1]');
    expect(await c.get('https://x/rest/v1/a?x=2|a')).toBeNull();
    expect(await new ResponseCache(kv).get('https://x/rest/v1/a?x=1|a')).toBe('[1]');
  });

  it('descarta las entradas más antiguas al superar el máximo', async () => {
    const kv = memory();
    const c = new ResponseCache(kv, { maxEntries: 2, maxBytes: 1000 });
    await c.set('k1', 'uno');
    await c.set('k2', 'dos');
    await c.set('k3', 'tres');
    expect(await c.get('k1')).toBeNull();
    expect(await c.get('k2')).toBe('dos');
    expect(await c.get('k3')).toBe('tres');
    expect(Object.keys(kv.data).filter((k) => k !== 'vigor.cache.v1:index')).toHaveLength(2); // sin entradas huérfanas
  });

  it('volver a guardar una clave la renueva y no ocupa dos huecos', async () => {
    const c = new ResponseCache(memory(), { maxEntries: 2, maxBytes: 1000 });
    await c.set('k1', 'a');
    await c.set('k2', 'b');
    await c.set('k1', 'a2'); // k1 pasa a ser la más reciente
    await c.set('k3', 'c');
    expect(await c.get('k1')).toBe('a2');
    expect(await c.get('k2')).toBeNull();
  });

  it('no guarda respuestas demasiado grandes', async () => {
    const c = new ResponseCache(memory(), { maxEntries: 5, maxBytes: 10 });
    await c.set('k', 'x'.repeat(11));
    expect(await c.get('k')).toBeNull();
  });

  it('un fallo de almacenamiento (sin espacio) no rompe nada', async () => {
    const kv = memory();
    kv.setItem = async () => {
      throw new Error('full');
    };
    const c = new ResponseCache(kv);
    await expect(c.set('k', 'v')).resolves.toBeUndefined();
    expect(await c.get('k')).toBeNull();
  });

  it('clear() elimina todo, incluido el índice', async () => {
    const kv = memory();
    const c = new ResponseCache(kv);
    await c.set('k1', 'a');
    await c.set('k2', 'b');
    await c.clear();
    expect(await c.get('k1')).toBeNull();
    expect(Object.keys(kv.data)).toEqual([]);
  });
});
