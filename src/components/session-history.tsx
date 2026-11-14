import { Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Card, ErrorText, Text } from "./ui";
import { listFinishedSessions } from "../lib/training";
import { formatDuration, formatKg, setVolume } from "../lib/training-math";
import { useFocusData } from "../lib/use-focus-data";

/** Lista de sesiones terminadas (las 40 últimas); al tocar una se abre su detalle. */
export function SessionHistory() {
  const router = useRouter();
  const { data, error, loading } = useFocusData(() => listFinishedSessions(40));
  return (
    <>
      <ErrorText>{error}</ErrorText>
      {loading && !data ? <Text muted>Cargando…</Text> : null}
      {data && !data.length ? (
        <Card>
          <Text variant="heading">Aún no has terminado ninguna sesión</Text>
          <Text muted>
            Cuando termines tu primer entreno aparecerá aquí, con su duración,
            series y volumen.
          </Text>
        </Card>
      ) : null}
      {data?.map(({ session, sets: allSets }) => {
        const sets = allSets.filter((s) => s.set_type !== "warmup"); // la aproximación no cuenta
        const volume = sets.reduce(
          (sum, s) => sum + setVolume({ weightKg: s.weight_kg, reps: s.reps }),
          0,
        );
        const seconds =
          (new Date(session.finished_at!).getTime() -
            new Date(session.started_at).getTime()) /
          1000;
        return (
          <Pressable
            key={session.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/session/[id]",
                params: { id: session.id },
              })
            }
          >
            <Card>
              <Text variant="label">{session.routine_name}</Text>
              <Text variant="caption" muted>
                {new Date(session.started_at).toLocaleDateString("es-ES", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {formatDuration(seconds)} · {sets.length} series ·{" "}
                {formatKg(Math.round(volume))} kg
              </Text>
            </Card>
          </Pressable>
        );
      })}
    </>
  );
}
