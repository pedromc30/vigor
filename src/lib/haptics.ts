import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Vibración breve de confirmación (no hace nada en web ni si el dispositivo no la admite). */
export function tap(): void {
  if (Platform.OS === 'web') return;
  void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);
}

export function success(): void {
  if (Platform.OS === 'web') return;
  void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
}
