import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { createOfflineRuntime } from './offline/runtime';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

// Capa sin conexión: caché de lecturas y cola de escrituras (ver src/lib/offline).
export const offline = createOfflineRuntime({
  url: url ?? 'http://localhost',
  anonKey: anonKey ?? 'missing',
  getSession: () => supabase.auth.getSession() as never,
});

export const supabase = createClient(url ?? 'http://localhost', anonKey ?? 'missing', {
  global: { fetch: offline.fetch },
  // Sin reintentos automáticos: sin red una consulta tardaría ~11 s en fallar; la capa sin conexión ya gestiona los fallos.
  db: { retry: false },
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
