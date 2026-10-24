import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorText, Screen, Text } from '../src/components/ui';
import { listFinishedSessions } from '../src/lib/training';
import { formatDuration, formatKg, setVolume } from '../src/lib/training-math';
import { useFocusData } from '../src/lib/use-focus-data';

export default function History() {
  const router = useRouter();
  const { data, error, loading } = useFocusData(() => listFinishedSessions(40));

  return (
    <Screen>
      <Text variant="title">Historial</Text>
      <ErrorText>{error}</ErrorText>
      {loading ? <Text muted>Cargando…</Text> : null}
      {data && !data.length ? <Text muted>Todavía no has terminado ninguna sesión.</Text> : null}
      {data?.map(({ session, sets }) => {
        const volume = sets.reduce((sum, s) => sum + setVolume({ weightKg: s.weight_kg, reps: s.reps }), 0);
        const seconds = (new Date(session.finished_at!).getTime() - new Date(session.started_at).getTime()) / 1000;
        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            onPress={() => router.push({ pathname: '/session/[id]', params: { id: session.id } })}
          >
            <Card>
              <Text variant="label">{session.routine_name}</Text>
              <Text variant="caption" muted>
                {new Date(session.started_at).toLocaleDateString('es-ES', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'short',
                })}{' '}
                · {formatDuration(seconds)} · {sets.length} series · {formatKg(Math.round(volume))} kg
              </Text>
            </Card>
          </Pressable>
        );
      })}
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
