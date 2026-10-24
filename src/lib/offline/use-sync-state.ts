import { useSyncExternalStore } from 'react';
import { offline } from '../supabase';
import type { SyncState } from './sync-store';

/** Estado de la sincronización (en línea, cambios pendientes, errores) para las pantallas. */
export function useSyncState(): SyncState {
  return useSyncExternalStore(offline.store.subscribe, offline.store.getState, offline.store.getState);
}
