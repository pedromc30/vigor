import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { confirm } from '../confirm';
import { offline } from '../supabase';

/** Clave en la que supabase-js guarda la sesión: sb-<referencia-del-proyecto>-auth-token. */
function storageKey(): string | null {
  try {
    const host = new URL(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').hostname;
    return `sb-${host.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

/**
 * Sin red, si el token de acceso caducó, supabase-js no puede renovarlo y `getSession()` devuelve null aunque
 * la sesión siga guardada. Esta función recupera esa sesión guardada para poder usar la app con los datos del
 * dispositivo; al volver la red, supabase-js la renueva solo (o la cierra si el servidor la rechaza).
 */
export async function restoreStoredSession(): Promise<Session | null> {
  const key = storageKey();
  if (!key) return null;
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const s = JSON.parse(raw) as Session;
    return s?.user?.id && s.refresh_token ? s : null;
  } catch {
    return null;
  }
}

export async function removeStoredSession(): Promise<void> {
  const key = storageKey();
  if (key) await AsyncStorage.removeItem(key).catch(() => undefined);
}

/**
 * Antes de cerrar sesión: intenta enviar lo pendiente y, si no se puede, pide confirmación porque esos cambios
 * se perderían. Devuelve false si el usuario prefiere esperar.
 */
export async function confirmSignOut(): Promise<boolean> {
  if (offline.queue.count === 0) return true;
  await offline.flush();
  const n = offline.queue.count;
  if (n === 0) return true;
  return confirm(
    'Cambios sin enviar',
    `Tienes ${n} cambio${n === 1 ? '' : 's'} hecho${n === 1 ? '' : 's'} sin conexión que aún no se han enviado. Si cierras sesión ahora se perderán.`,
    'Cerrar sesión igualmente',
    true,
  );
}
