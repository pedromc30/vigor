import type { Failure } from './queue';

export interface SyncState {
  online: boolean;
  pending: number;
  syncing: boolean;
  failures: Failure[];
  /** Aumenta cada vez que termina una sincronización con cambios: las pantallas se recargan al verlo. */
  version: number;
}

type Listener = () => void;

/** Estado observable de la sincronización (sin depender de React). */
export class SyncStore {
  private state: SyncState = { online: true, pending: 0, syncing: false, failures: [], version: 0 };
  private listeners = new Set<Listener>();

  getState = (): SyncState => this.state;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  set(patch: Partial<SyncState>): void {
    const next = { ...this.state, ...patch };
    const changed = (Object.keys(next) as (keyof SyncState)[]).some((k) => next[k] !== this.state[k]);
    if (!changed) return;
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  bumpVersion(): void {
    this.set({ version: this.state.version + 1 });
  }

  dismissFailures(): void {
    this.set({ failures: [] });
  }
}
