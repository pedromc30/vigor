import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, ChipSingle, ErrorText, Screen, Text, TextField } from '../src/components/ui';
import { WEEKDAY_LONG } from '../src/lib/labels';
import {
  blockedByExpoGo,
  loadReminderSettings,
  remindersSupported,
  saveReminderSettings,
  scheduleReminders,
  sendTestNotification,
  trainingWeekdays,
  type ApplyResult,
} from '../src/lib/notifications';
import { DEFAULT_REMINDERS, buildReminders, validateReminders, type ReminderSettings } from '../src/lib/reminders';
import { spacing, useTheme } from '../src/theme';

function Row({ title, hint, on, onChange, children }: { title: string; hint?: string; on: boolean; onChange: (v: boolean) => void; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md }}>
        <View style={{ flex: 1 }}>
          <Text variant="heading">{title}</Text>
          {hint ? (
            <Text variant="caption" muted>
              {hint}
            </Text>
          ) : null}
        </View>
        <Switch
          value={on}
          onValueChange={onChange}
          accessibilityLabel={title}
          trackColor={{ true: colors.primary, false: colors.border }}
        />
      </View>
      {on ? children : null}
    </Card>
  );
}

const reasonText = (r: Extract<ApplyResult, { ok: false }>['reason']) =>
  r === 'denied'
    ? 'Sin permiso de notificaciones. Actívalo en los ajustes del sistema.'
    : r === 'unsupported'
      ? 'Los recordatorios solo funcionan en la app del móvil.'
      : 'No se pudieron programar los avisos en este dispositivo.';

export default function Reminders() {
  const router = useRouter();
  const [s, setS] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [weekdays, setWeekdays] = useState<number[] | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void loadReminderSettings().then(setS);
    trainingWeekdays().then(setWeekdays).catch(() => setWeekdays([]));
  }, []);

  const patch = <K extends keyof ReminderSettings>(k: K, v: Partial<ReminderSettings[K]>) => {
    setMsg(null);
    setS((cur) => ({ ...cur, [k]: { ...cur[k], ...v } }));
  };

  const save = async () => {
    const problem = validateReminders(s);
    if (problem) return setError(problem);
    setBusy(true);
    setError(null);
    setMsg(null);
    await saveReminderSettings(s);
    const res = await scheduleReminders(buildReminders(s, weekdays ?? []));
    setBusy(false);
    if (!res.ok) return setError(reasonText(res.reason));
    setMsg(res.count ? `Listo: ${res.count} recordatorio(s) programado(s) en este dispositivo.` : 'Recordatorios desactivados.');
  };

  const test = async () => {
    setError(null);
    const res = await sendTestNotification();
    if (!res.ok) setError(reasonText(res.reason));
    else setMsg('Aviso de prueba enviado: llegará en unos 5 segundos.');
  };

  if (!remindersSupported) {
    return (
      <Screen>
        <Text variant="title">Recordatorios</Text>
        <Text muted>
          {blockedByExpoGo
            ? 'Los recordatorios no están disponibles en Expo Go para Android: Expo Go no incluye un módulo que necesita la librería de notificaciones. Funcionarán en la app instalada (build de desarrollo o de producción).'
            : 'Los recordatorios se programan en el móvil. Abre Vigor en tu teléfono para configurarlos.'}
        </Text>
        <Button title="Volver" variant="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">Recordatorios</Text>
      <Text muted>Avisos locales: se programan en este dispositivo y no se envían a ningún servidor.</Text>

      <Row title="Entrenamiento" hint="El aviso llega los días en que tienes un entreno programado." on={s.workout.on} onChange={(v) => patch('workout', { on: v })}>
        <TextField label="Hora (HH:MM)" value={s.workout.time} onChangeText={(t) => patch('workout', { time: t })} keyboardType="numbers-and-punctuation" maxLength={5} />
        {weekdays && !weekdays.length ? (
          <Text variant="caption" muted>
            Ninguna de tus rutinas tiene día de la semana. Asígnalo al editarlas para recibir este aviso.
          </Text>
        ) : null}
      </Row>

      <Row title="Comidas" hint="Desayuno, comida y cena." on={s.meals.on} onChange={(v) => patch('meals', { on: v })}>
        <TextField label="Desayuno (HH:MM)" value={s.meals.breakfast} onChangeText={(t) => patch('meals', { breakfast: t })} keyboardType="numbers-and-punctuation" maxLength={5} />
        <TextField label="Comida (HH:MM)" value={s.meals.lunch} onChangeText={(t) => patch('meals', { lunch: t })} keyboardType="numbers-and-punctuation" maxLength={5} />
        <TextField label="Cena (HH:MM)" value={s.meals.dinner} onChangeText={(t) => patch('meals', { dinner: t })} keyboardType="numbers-and-punctuation" maxLength={5} />
      </Row>

      <Row title="Agua" hint="Cada pocas horas, entre dos horas del día." on={s.water.on} onChange={(v) => patch('water', { on: v })}>
        <Text variant="label">Cada</Text>
        <ChipSingle
          value={String(s.water.everyHours)}
          onChange={(k) => patch('water', { everyHours: Number(k ?? 3) })}
          options={['2', '3', '4'].map((h) => ({ key: h, label: `${h} horas` }))}
        />
        <TextField label="Desde (HH:MM)" value={s.water.from} onChangeText={(t) => patch('water', { from: t })} keyboardType="numbers-and-punctuation" maxLength={5} />
        <TextField label="Hasta (HH:MM)" value={s.water.to} onChangeText={(t) => patch('water', { to: t })} keyboardType="numbers-and-punctuation" maxLength={5} />
      </Row>

      <Row title="Pesaje semanal" hint="Una vez por semana." on={s.weighIn.on} onChange={(v) => patch('weighIn', { on: v })}>
        <ChipSingle
          value={String(s.weighIn.weekday)}
          onChange={(k) => patch('weighIn', { weekday: Number(k ?? 1) })}
          options={[1, 2, 3, 4, 5, 6, 7].map((d) => ({ key: String(d), label: WEEKDAY_LONG[d].slice(0, 3) }))}
        />
        <TextField label="Hora (HH:MM)" value={s.weighIn.time} onChangeText={(t) => patch('weighIn', { time: t })} keyboardType="numbers-and-punctuation" maxLength={5} />
      </Row>

      <ErrorText>{error}</ErrorText>
      {msg ? <Text style={{ fontWeight: '600' }}>{msg}</Text> : null}
      <Button title="Guardar y programar" onPress={save} loading={busy} />
      <Button title="Enviar aviso de prueba" variant="secondary" onPress={() => void test()} />
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
