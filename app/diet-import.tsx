import { useEffect, useMemo, useState } from 'react';
import { Switch, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, ChipSingle, ErrorText, Screen, Text } from '../src/components/ui';
import { confirm } from '../src/lib/confirm';
import { addPlanEntries, clearPlanDay, listPlan } from '../src/lib/diet';
import { LAYOUT_LABELS, daysWithEntries, draftsByWeekday, parseDietSheets, type ParsedDiet } from '../src/lib/diet-import';
import { downloadDietFile, listDietFiles, type DietFile } from '../src/lib/diet-files';
import { MEAL_LABELS } from '../src/lib/diet-math';
import { WEEKDAY_LONG } from '../src/lib/labels';
import { SpreadsheetError, readSpreadsheet } from '../src/lib/spreadsheet';
import { success } from '../src/lib/haptics';
import { formatKg } from '../src/lib/training-math';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing, useTheme } from '../src/theme';

type Mode = 'replace' | 'add';

export default function DietImport() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session, profile, saveProfile } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [file, setFile] = useState<DietFile | null>(null);
  const [parsed, setParsed] = useState<ParsedDiet | null>(null);
  const [existing, setExisting] = useState(0);
  const [days, setDays] = useState<Set<number>>(new Set());
  const [applyTargets, setApplyTargets] = useState(true);
  const [mode, setMode] = useState<Mode>('replace');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const f = (await listDietFiles()).find((x) => x.id === id);
        if (!f) return setError('No se encontró el archivo.');
        setFile(f);
        const [bytes, plan] = await Promise.all([downloadDietFile(f), listPlan().catch(() => [])]);
        const result = parseDietSheets(readSpreadsheet(bytes, f.name));
        setParsed(result);
        setDays(new Set(daysWithEntries(result.entries)));
        setExisting(plan.length);
        setApplyTargets(Object.keys(result.targets).length > 0);
      } catch (e) {
        setError(e instanceof SpreadsheetError ? e.message : 'No se pudo leer el archivo. Comprueba tu conexión e inténtalo de nuevo.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  const entriesByDay = useMemo(() => {
    const m = new Map<number, ParsedDiet['entries']>();
    for (const e of parsed?.entries ?? []) m.set(e.weekday, [...(m.get(e.weekday) ?? []), e]);
    return m;
  }, [parsed]);

  const hasTargets = !!parsed && Object.keys(parsed.targets).length > 0;
  const chosenEntries = [...days].reduce((n, d) => n + (entriesByDay.get(d)?.length ?? 0), 0);
  const nothing = chosenEntries === 0 && !(hasTargets && applyTargets);

  const apply = async () => {
    if (!session || !parsed) return;
    if (mode === 'replace' && days.size > 0 && existing > 0) {
      const ok = await confirm('Sustituir planificador', 'Se borrarán las comidas que ya tienes en esos días del planificador y se sustituirán por las del archivo.', 'Sustituir', true);
      if (!ok) return;
    }
    setApplying(true);
    setError(null);
    try {
      const byDay = draftsByWeekday(parsed.entries, days);
      for (const [weekday, drafts] of byDay) {
        if (mode === 'replace') await clearPlanDay(weekday);
        await addPlanEntries(session.user.id, weekday, drafts);
      }
      if (hasTargets && applyTargets) {
        const t = parsed.targets;
        await saveProfile({
          ...(t.kcal !== undefined ? { target_kcal: t.kcal } : {}),
          ...(t.protein_g !== undefined ? { target_protein_g: t.protein_g } : {}),
          ...(t.carbs_g !== undefined ? { target_carbs_g: t.carbs_g } : {}),
          ...(t.fat_g !== undefined ? { target_fat_g: t.fat_g } : {}),
          targets_manual: true,
        });
      }
      success();
      const parts = [
        chosenEntries ? `${chosenEntries} alimentos en el planificador (${days.size} ${days.size === 1 ? 'día' : 'días'})` : null,
        hasTargets && applyTargets ? 'objetivos diarios' : null,
      ].filter(Boolean);
      setDone(`Listo: ${parts.join(' y ')}.`);
    } catch {
      setError('No se pudo aplicar. Comprueba tu conexión e inténtalo de nuevo; lo que no se haya guardado se puede repetir sin duplicar si eliges «Sustituir».');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <Screen>
        <Text variant="title">Usar en mi dieta</Text>
        <Text muted>Leyendo el archivo…</Text>
      </Screen>
    );
  }

  if (done) {
    return (
      <Screen>
        <Text variant="title">Dieta actualizada</Text>
        <Text>{done}</Text>
        <Text variant="caption" muted>
          Las comidas sin calorías las puedes completar en el planificador.
        </Text>
        <Button title="Ver planificador" onPress={() => router.replace('/plan')} />
        <Button title="Volver" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  const noneRecognised = !!parsed && parsed.entries.length === 0 && !hasTargets;

  return (
    <Screen>
      <Text variant="title">Usar en mi dieta</Text>
      {file ? <Text muted>{file.name}</Text> : null}
      <ErrorText>{error}</ErrorText>

      {parsed ? (
        <>
          <Card>
            <Text variant="label">Qué he leído</Text>
            <Text>
              {parsed.entries.length} alimentos en {daysWithEntries(parsed.entries).length} días
              {parsed.sheet ? ` · hoja «${parsed.sheet}»` : ''}
            </Text>
            <Text variant="caption" muted>
              Formato: {LAYOUT_LABELS[parsed.layout]}
            </Text>
            {parsed.notes.map((n) => (
              <Text key={n} variant="caption" style={{ color: colors.warningText }}>
                {n}
              </Text>
            ))}
          </Card>

          {noneRecognised ? (
            <Card>
              <Text variant="label">No he reconocido una dieta en este archivo</Text>
              <Text variant="caption" muted>
                Busco una tabla con los días de la semana (lunes…domingo) y las comidas (desayuno, comida, merienda, cena…), en columnas o en filas, o una lista con
                columnas «Día», «Comida» y «Alimento». Si tu archivo es de otra forma, puedes ajustarlo y subirlo de nuevo.
              </Text>
            </Card>
          ) : null}

          {hasTargets ? (
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Text variant="label">Objetivos diarios</Text>
                  <Text>
                    {[
                      parsed.targets.kcal !== undefined ? `${parsed.targets.kcal} kcal` : null,
                      parsed.targets.protein_g !== undefined ? `proteína ${parsed.targets.protein_g} g` : null,
                      parsed.targets.carbs_g !== undefined ? `carbohidratos ${parsed.targets.carbs_g} g` : null,
                      parsed.targets.fat_g !== undefined ? `grasa ${parsed.targets.fat_g} g` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </Text>
                  {profile?.target_kcal ? (
                    <Text variant="caption" muted>
                      Ahora: {profile.target_kcal} kcal · P {formatKg(profile.target_protein_g ?? 0)} g · C {formatKg(profile.target_carbs_g ?? 0)} g · G {formatKg(profile.target_fat_g ?? 0)} g
                    </Text>
                  ) : null}
                </View>
                <Switch accessibilityLabel="Aplicar objetivos diarios" value={applyTargets} onValueChange={setApplyTargets} trackColor={{ true: colors.primary }} />
              </View>
            </Card>
          ) : null}

          {[...entriesByDay.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([weekday, list]) => (
              <Card key={weekday}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text variant="heading">{WEEKDAY_LONG[weekday][0].toUpperCase() + WEEKDAY_LONG[weekday].slice(1)}</Text>
                  <Switch
                    accessibilityLabel={`Importar ${WEEKDAY_LONG[weekday]}`}
                    value={days.has(weekday)}
                    onValueChange={(on) =>
                      setDays((prev) => {
                        const next = new Set(prev);
                        if (on) next.add(weekday);
                        else next.delete(weekday);
                        return next;
                      })
                    }
                    trackColor={{ true: colors.primary }}
                  />
                </View>
                {list.map((e, i) => (
                  <Text key={i} variant="caption" muted={!days.has(weekday)}>
                    <Text variant="caption" muted>
                      {MEAL_LABELS[e.meal]}:{' '}
                    </Text>
                    {e.name}
                    {e.quantity_g != null ? ` · ${formatKg(e.quantity_g)} g` : ''}
                    {e.kcal > 0 ? ` · ${formatKg(e.kcal)} kcal` : ''}
                  </Text>
                ))}
              </Card>
            ))}

          {parsed.skipped.length ? (
            <Card>
              <Text variant="label">Sin colocar ({parsed.skipped.length})</Text>
              <Text variant="caption" muted>
                No se ha reconocido la comida o el día de estas líneas, así que no se importan:
              </Text>
              {parsed.skipped.map((s, i) => (
                <Text key={i} variant="caption">
                  {s}
                </Text>
              ))}
            </Card>
          ) : null}

          {chosenEntries > 0 ? (
            <View style={{ gap: spacing.sm }}>
              <Text variant="label">Planificador semanal</Text>
              <ChipSingle
                value={mode}
                onChange={(m) => setMode(m ?? 'replace')}
                options={[
                  { key: 'replace', label: 'Sustituir esos días' },
                  { key: 'add', label: 'Añadir a lo que hay' },
                ]}
              />
              <Text variant="caption" muted>
                {existing > 0 ? `Ahora tienes ${existing} alimentos en el planificador.` : 'Tu planificador está vacío.'}
              </Text>
            </View>
          ) : null}

          {!noneRecognised ? <Button title="Aplicar a mi dieta" onPress={() => void apply()} loading={applying} disabled={nothing} /> : null}
        </>
      ) : null}
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
