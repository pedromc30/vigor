// Adaptador de notificaciones locales (expo-notifications). Se carga bajo demanda y nunca en Expo Go
// para Android, donde la librería no se puede cargar.
import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';
import { listRoutines } from './training';
import { loadPref, savePref } from './local-prefs';
import {
  DEFAULT_REMINDERS,
  buildReminders,
  expoWeekday,
  hasAnyReminder,
  type PlannedReminder,
  type ReminderSettings,
} from './reminders';

const KEY = 'vigor.reminders.v1';
const CHANNEL = 'recordatorios';

/**
 * En Expo Go para Android, `expo-notifications` no se puede ni cargar (falta un módulo nativo que Expo Go
 * retiró con las notificaciones push). Funcionará en una build de desarrollo o de producción.
 */
export const blockedByExpoGo = Platform.OS === 'android' && isRunningInExpoGo();
export const remindersSupported = Platform.OS !== 'web' && !blockedByExpoGo;

export async function loadReminderSettings(): Promise<ReminderSettings> {
  const saved = await loadPref<Partial<ReminderSettings>>(KEY, {});
  return {
    workout: { ...DEFAULT_REMINDERS.workout, ...saved.workout },
    meals: { ...DEFAULT_REMINDERS.meals, ...saved.meals },
    water: { ...DEFAULT_REMINDERS.water, ...saved.water },
    weighIn: { ...DEFAULT_REMINDERS.weighIn, ...saved.weighIn },
  };
}

export const saveReminderSettings = (s: ReminderSettings) => savePref(KEY, s);

/** Días ISO con entreno programado en tus rutinas. */
export async function trainingWeekdays(): Promise<number[]> {
  const routines = await listRoutines();
  return routines.flatMap((r) => r.schedule.filter((d) => d > 0));
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const notifications = () => require('expo-notifications') as typeof import('expo-notifications');

export type ApplyResult = { ok: true; count: number } | { ok: false; reason: 'unsupported' | 'denied' | 'error' };

/** Sustituye todos los avisos programados por los de la lista (pide permiso si hace falta). */
export async function scheduleReminders(list: PlannedReminder[]): Promise<ApplyResult> {
  if (!remindersSupported) return { ok: false, reason: 'unsupported' };
  try {
    const N = notifications();
    if (list.length) {
      let perm = await N.getPermissionsAsync();
      if (!perm.granted) perm = await N.requestPermissionsAsync();
      if (!perm.granted) return { ok: false, reason: 'denied' };
    }
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL, { name: 'Recordatorios', importance: N.AndroidImportance.DEFAULT });
    }
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
    await N.cancelAllScheduledNotificationsAsync();
    for (const r of list) {
      await N.scheduleNotificationAsync({
        content: { title: r.title, body: r.body },
        trigger:
          r.weekday == null
            ? { type: N.SchedulableTriggerInputTypes.DAILY, hour: r.hour, minute: r.minute, channelId: CHANNEL }
            : { type: N.SchedulableTriggerInputTypes.WEEKLY, weekday: expoWeekday(r.weekday), hour: r.hour, minute: r.minute, channelId: CHANNEL },
      });
    }
    return { ok: true, count: list.length };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Reprograma los avisos con los ajustes guardados (p. ej. tras cambiar los días de tus rutinas). */
export async function syncReminders(): Promise<void> {
  if (!remindersSupported) return;
  const settings = await loadReminderSettings();
  if (!hasAnyReminder(settings)) return;
  await scheduleReminders(buildReminders(settings, await trainingWeekdays()));
}

/** Programa un aviso de prueba que llega en unos segundos. */
export async function sendTestNotification(): Promise<ApplyResult> {
  if (!remindersSupported) return { ok: false, reason: 'unsupported' };
  try {
    const N = notifications();
    let perm = await N.getPermissionsAsync();
    if (!perm.granted) perm = await N.requestPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    if (Platform.OS === 'android') {
      await N.setNotificationChannelAsync(CHANNEL, { name: 'Recordatorios', importance: N.AndroidImportance.DEFAULT });
    }
    N.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
    await N.scheduleNotificationAsync({
      content: { title: 'Vigor', body: 'Así se verán tus recordatorios.' },
      trigger: { type: N.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 5, channelId: CHANNEL },
    });
    return { ok: true, count: 1 };
  } catch {
    return { ok: false, reason: 'error' };
  }
}
