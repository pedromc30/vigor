import { useState } from "react";
import { View } from "react-native";
import { useRouter } from "expo-router";
import { ActionSheet } from "../../src/components/action-sheet";
import { FloatingAction } from "../../src/components/floating-action";
import { ProgressView } from "../../src/components/progress-view";
import { SessionHistory } from "../../src/components/session-history";
import {
  Button,
  Card,
  ChipSingle,
  ErrorText,
  LinkRow,
  Screen,
  Text,
} from "../../src/components/ui";
import { MUSCLE_LABELS, WEEKDAY_LONG } from "../../src/lib/labels";
import {
  getActiveSession,
  getSetsSince,
  listRoutines,
  startSession,
} from "../../src/lib/training";
import {
  formatKg,
  volumeByMuscleGroup,
  weekStart,
} from "../../src/lib/training-math";
import { useFocusData } from "../../src/lib/use-focus-data";
import { useAuth } from "../../src/providers/AuthProvider";
import { spacing, useTheme } from "../../src/theme";

type Section = "rutinas" | "historial" | "progreso";

/** Entrenamientos: rutinas, historial de sesiones y progreso por ejercicio. La acción principal es empezar (o continuar) un entreno. */
export default function Entreno() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const { data, error, loading } = useFocusData(async () => {
    const [active, routines, weekSets] = await Promise.all([
      getActiveSession(),
      listRoutines(),
      getSetsSince(weekStart(new Date())),
    ]);
    return { active, routines, volume: volumeByMuscleGroup(weekSets) };
  });
  const [section, setSection] = useState<Section>("rutinas");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const startFree = async () => {
    if (!session) return;
    setBusy(true);
    setActionError(null);
    try {
      const id = await startSession(session.user.id, null, "Sesión libre", []);
      router.push({ pathname: "/workout/[id]", params: { id } });
    } catch {
      setActionError("No se pudo iniciar la sesión. Comprueba tu conexión.");
    } finally {
      setBusy(false);
    }
  };

  const maxSets = Math.max(1, ...(data?.volume.map((v) => v.sets) ?? [1]));

  return (
    <View style={{ flex: 1 }}>
      <Screen>
        <Text variant="title">Entrenamientos</Text>
        <ChipSingle<Section>
          value={section}
          onChange={(v) => setSection(v ?? "rutinas")}
          options={[
            { key: "rutinas", label: "Rutinas" },
            { key: "historial", label: "Historial" },
            { key: "progreso", label: "Progreso" },
          ]}
        />
        <ErrorText>{error}</ErrorText>
        <ErrorText>{actionError}</ErrorText>

        {section === "rutinas" ? (
          <>
            {loading && !data ? <Text muted>Cargando…</Text> : null}
            {data?.active ? (
              <Card tone="blue">
                <Text variant="label">Sesión en curso</Text>
                <Text muted>{data.active.routine_name}</Text>
              </Card>
            ) : null}
            {data && !data.routines.length ? (
              <Card>
                <Text variant="heading">Aún no tienes rutinas</Text>
                <Text muted>
                  Crea tu primera rutina para organizar tus ejercicios, o
                  empieza una sesión libre y apunta lo que hagas.
                </Text>
              </Card>
            ) : null}
            <View style={{ gap: spacing.sm }}>
              {data?.routines.map((r) => {
                const scheduled = r.schedule
                  .filter((d) => d > 0)
                  .map((d) => WEEKDAY_LONG[d].slice(0, 3));
                return (
                  <LinkRow
                    key={r.id}
                    title={r.name}
                    hint={`${r.day_names.length} ${r.day_names.length === 1 ? "día" : "días"} · ${r.routine_exercises?.length ?? 0} ${r.routine_exercises?.length === 1 ? "ejercicio" : "ejercicios"}${scheduled.length ? ` · ${scheduled.join(", ")}` : ""}`}
                    onPress={() =>
                      router.push({
                        pathname: "/routine/[id]",
                        params: { id: r.id },
                      })
                    }
                  />
                );
              })}
            </View>
            <Button
              title="Nueva rutina"
              variant="secondary"
              onPress={() => router.push("/routine-edit")}
            />
            <LinkRow
              title="Biblioteca de ejercicios"
              hint="Todos los ejercicios y sus músculos"
              onPress={() => router.push("/exercises")}
            />
          </>
        ) : null}

        {section === "historial" ? <SessionHistory /> : null}

        {section === "progreso" ? (
          <>
            <Card tone="blue">
              <Text variant="heading">Volumen de esta semana</Text>
              <Text variant="caption" muted>
                Series y kg totales por grupo muscular (desde el lunes).
              </Text>
              {data && !data.volume.length ? (
                <Text muted>
                  Aún no has registrado series esta semana. Empieza un entreno y
                  aparecerán aquí.
                </Text>
              ) : null}
              {data?.volume.map((v) => (
                <View key={v.muscleGroup} style={{ gap: 4 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-between",
                    }}
                  >
                    <Text variant="label">
                      {MUSCLE_LABELS[
                        v.muscleGroup as keyof typeof MUSCLE_LABELS
                      ] ?? v.muscleGroup}
                    </Text>
                    <Text variant="caption" muted>
                      {v.sets} {v.sets === 1 ? "serie" : "series"} ·{" "}
                      {formatKg(Math.round(v.volumeKg))} kg
                    </Text>
                  </View>
                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: colors.surfaceAlt,
                    }}
                  >
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: colors.primary,
                        width: `${(v.sets / maxSets) * 100}%`,
                      }}
                    />
                  </View>
                </View>
              ))}
            </Card>
            <ProgressView part="strength" />
          </>
        ) : null}
        <View style={{ height: 72 }} />
      </Screen>
      <FloatingAction
        title={data?.active ? "Continuar entreno" : "Empezar entreno"}
        disabled={busy}
        onPress={() =>
          data?.active
            ? router.push({
                pathname: "/workout/[id]",
                params: { id: data.active.id },
              })
            : setPickerOpen(true)
        }
      />
      <ActionSheet
        visible={pickerOpen}
        title="¿Qué vas a entrenar?"
        onClose={() => setPickerOpen(false)}
        actions={[
          ...(data?.routines ?? []).map((r) => ({
            label: r.name,
            icon: "barbell-outline" as const,
            onPress: () =>
              router.push({ pathname: "/routine/[id]", params: { id: r.id } }),
          })),
          {
            label: "Sesión libre",
            icon: "flash-outline" as const,
            onPress: () => void startFree(),
          },
        ]}
      />
    </View>
  );
}
