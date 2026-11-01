// Aviso del sistema al terminar el descanso entre series, para que llegue con la app en segundo plano o la
// pantalla bloqueada. No funciona en web ni en Expo Go para Android (ver `remindersSupported`); allí el aviso
// se queda en el de la propia pantalla.
import { Platform } from 'react-native';
import { loadPref, savePref } from './local-prefs';
import { REST_KIND, installNotificationHandler, notifications, remindersSupported } from './notifications';

const CHANNEL = 'descanso';
const ASKED_KEY = 'vigor.rest-permission-asked.v1';

let scheduledId: string | null = null;
// Las operaciones se encadenan para que cancelar/reprogramar nunca se solapen (p. ej. con el diálogo de permiso abierto).
let chain: Promise<void> = Promise.resolve();

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  const N = notifications();
  await N.setNotificationChannelAsync(CHANNEL, {
    name: 'Fin de descanso',
    importance: N.AndroidImportance.HIGH,
    vibrationPattern: [0, 400, 150, 400],
  });
}

/** Pide el permiso la primera vez que se usa el temporizador; después no insiste. */
async function hasPermission(): Promise<boolean> {
  const N = notifications();
  let perm = await N.getPermissionsAsync();
  if (perm.granted) return true;
  if (!perm.canAskAgain) return false;
  if (await loadPref(ASKED_KEY, false)) return false;
  await savePref(ASKED_KEY, true);
  await ensureChannel(); // en Android 13+ el diálogo no aparece hasta que existe un canal
  perm = await N.requestPermissionsAsync();
  return perm.granted;
}

async function apply(endsAt: number | null): Promise<void> {
  const N = notifications();
  if (scheduledId) {
    await N.cancelScheduledNotificationAsync(scheduledId).catch(() => undefined);
    scheduledId = null;
  }
  if (endsAt == null || endsAt - Date.now() < 1000) return;
  if (!(await hasPermission())) return;
  await ensureChannel();
  installNotificationHandler();
  scheduledId = await N.scheduleNotificationAsync({
    content: { title: 'Descanso terminado', body: 'Es hora de la siguiente serie.', data: { kind: REST_KIND }, sound: true },
    trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: new Date(endsAt), channelId: CHANNEL },
  });
}

/**
 * Deja programado un único aviso para `endsAt` (cancelando el anterior), o ninguno si es null.
 * Llamar al iniciar, alargar, acortar, saltar o terminar un descanso. Nunca lanza: el entreno no depende de esto.
 */
export function syncRestNotification(endsAt: number | null): Promise<void> {
  if (!remindersSupported) return Promise.resolve();
  chain = chain.then(() => apply(endsAt)).catch(() => undefined);
  return chain;
}
