import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';
import { fetchProfile, upsertProfile, type Profile, type ProfileUpdate } from '../lib/profile';

interface AuthContextValue {
  /** true mientras se restaura la sesión y se carga el perfil */
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Error al cargar el perfil (p. ej. sin conexión); la sesión sigue siendo válida. */
  profileError: string | null;
  onboarded: boolean;
  refreshProfile: () => Promise<void>;
  saveProfile: (values: ProfileUpdate) => Promise<Profile>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [sessionReady, setSessionReady] = useState(!isSupabaseConfigured);
  // Usuario cuyo perfil ya se ha intentado cargar; evita un instante «con sesión pero sin perfil».
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  const load = useCallback(async (id: string) => {
    setProfileError(null);
    try {
      setProfile(await fetchProfile(id));
    } catch {
      setProfileError('No se pudo cargar tu perfil. Comprueba tu conexión.');
    } finally {
      setLoadedFor(id);
    }
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileError(null);
      setLoadedFor(null);
      return;
    }
    void load(userId);
  }, [userId, load]);

  const refreshProfile = useCallback(async () => {
    if (userId) await load(userId);
  }, [userId, load]);

  const saveProfile = useCallback(
    async (values: ProfileUpdate) => {
      if (!userId) throw new Error('No hay sesión');
      const saved = await upsertProfile(userId, values);
      setProfile(saved);
      return saved;
    },
    [userId],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      loading: !sessionReady || (!!userId && loadedFor !== userId),
      session,
      profile,
      profileError,
      onboarded: !!profile?.onboarding_completed_at,
      refreshProfile,
      saveProfile,
      signOut,
    }),
    [sessionReady, userId, loadedFor, session, profile, profileError, refreshProfile, saveProfile, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
