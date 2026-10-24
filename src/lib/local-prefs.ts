import AsyncStorage from '@react-native-async-storage/async-storage';

/** Preferencias guardadas solo en este dispositivo (nunca en Supabase). Los fallos se ignoran. */
export async function loadPref<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export async function savePref(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // sin almacenamiento: la preferencia no persistirá
  }
}
