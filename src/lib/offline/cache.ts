import type { KV } from './queue';

interface IndexEntry {
  k: string;
  t: number;
}

const hash = (s: string) => {
  let h1 = 5381;
  let h2 = 52711;
  for (let i = 0; i < s.length; i++) {
    h1 = (h1 * 33) ^ s.charCodeAt(i);
    h2 = (h2 * 31) ^ s.charCodeAt(i);
  }
  return `${(h1 >>> 0).toString(36)}${(h2 >>> 0).toString(36)}${s.length.toString(36)}`;
};

/**
 * Última respuesta de cada consulta, para poder leer sin conexión. Es una caché acotada (pocas entradas, de
 * tamaño limitado) para no llenar el almacenamiento del dispositivo.
 */
export class ResponseCache {
  private index: IndexEntry[] = [];
  private loaded = false;

  constructor(
    private kv: KV,
    private opts: { maxEntries: number; maxBytes: number; prefix?: string; now?: () => number } = { maxEntries: 150, maxBytes: 250_000 },
  ) {}

  private get prefix() {
    return this.opts.prefix ?? 'vigor.cache.v1:';
  }
  private now() {
    return (this.opts.now ?? Date.now)();
  }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const raw = await this.kv.getItem(this.prefix + 'index');
      this.index = raw ? (JSON.parse(raw) as IndexEntry[]) : [];
    } catch {
      this.index = [];
    }
  }

  private saveIndex() {
    return this.kv.setItem(this.prefix + 'index', JSON.stringify(this.index)).catch(() => undefined);
  }

  async get(key: string): Promise<string | null> {
    await this.load();
    const k = hash(key);
    if (!this.index.some((e) => e.k === k)) return null;
    try {
      return await this.kv.getItem(this.prefix + k);
    } catch {
      return null;
    }
  }

  async set(key: string, text: string): Promise<void> {
    if (text.length > this.opts.maxBytes) return;
    await this.load();
    const k = hash(key);
    try {
      await this.kv.setItem(this.prefix + k, text);
    } catch {
      return; // sin espacio: simplemente no se cachea
    }
    this.index = this.index.filter((e) => e.k !== k);
    this.index.push({ k, t: this.now() });
    while (this.index.length > this.opts.maxEntries) {
      const old = this.index.shift()!;
      await this.kv.removeItem(this.prefix + old.k).catch(() => undefined);
    }
    await this.saveIndex();
  }

  async clear(): Promise<void> {
    await this.load();
    for (const e of this.index) await this.kv.removeItem(this.prefix + e.k).catch(() => undefined);
    this.index = [];
    await this.kv.removeItem(this.prefix + 'index').catch(() => undefined);
  }
}
