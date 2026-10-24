import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/** Carga datos al enfocar la pantalla (y al volver a ella). */
export function useFocusData<T>(load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setData(await load());
    } catch {
      setError('No se pudieron cargar los datos. Comprueba tu conexión.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useFocusEffect(
    useCallback(() => {
      void reload();
    }, [reload]),
  );

  return { data, error, loading, reload };
}
