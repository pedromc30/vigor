import { useEffect, useState } from 'react';
import { Pressable, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatClock } from '../lib/training-math';
import { radius, spacing, useTheme } from '../theme';
import { Text } from './ui';

const LATE_SECONDS = 3;

export interface RestState {
  endsAt: number;
  total: number;
}

/** Barra inferior con la cuenta atrás del descanso. Usa la hora de fin, así no se desfasa en segundo plano. */
export function RestBar({
  rest,
  onChange,
  onFinished,
}: {
  rest: RestState;
  onChange: (next: RestState | null) => void;
  /**
   * Se llama (en lugar de `onChange(null)`) cuando el descanso termina solo y a su hora, para que quien lo use pueda
   * distinguirlo de «Saltar». No se llama si se vuelve a la app mucho después de terminar.
   */
  onFinished?: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  const remaining = (rest.endsAt - now) / 1000;

  useEffect(() => {
    if (remaining <= 0) {
      // Si se vuelve a la app mucho después de terminar, el aviso del sistema ya cumplió: no se repite aquí.
      if (-remaining < LATE_SECONDS && onFinished) {
        Vibration.vibrate([0, 400, 150, 400]);
        onFinished();
      } else {
        onChange(null);
      }
    }
  }, [remaining, onChange, onFinished]);

  const adjust = (seconds: number) => onChange({ endsAt: rest.endsAt + seconds * 1000, total: rest.total + seconds });
  const progress = Math.min(1, Math.max(0, 1 - remaining / rest.total));

  return (
    <View
      style={{
        position: 'absolute',
        left: spacing.lg,
        right: spacing.lg,
        bottom: insets.bottom + spacing.md,
        backgroundColor: colors.surface,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: radius.lg,
        padding: spacing.md,
        gap: spacing.sm,
        elevation: 6,
        shadowColor: '#000',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      }}
      accessibilityLiveRegion="polite"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <Text variant="caption" muted>
            Descanso
          </Text>
          <Text variant="title" style={{ fontVariant: ['tabular-nums'] }}>
            {formatClock(remaining)}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.lg }}>
          <TimerButton title="−15 s" onPress={() => adjust(-15)} />
          <TimerButton title="+15 s" onPress={() => adjust(15)} />
          <TimerButton title="Saltar" onPress={() => onChange(null)} />
        </View>
      </View>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.surfaceAlt }}>
        <View style={{ height: 4, borderRadius: 2, backgroundColor: colors.primary, width: `${progress * 100}%` }} />
      </View>
    </View>
  );
}

function TimerButton({ title, onPress }: { title: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ minHeight: 40, justifyContent: 'center' }}>
      <Text variant="label" style={{ color: colors.primary }}>
        {title}
      </Text>
    </Pressable>
  );
}

/** Tiempo transcurrido desde `since`. */
export function ElapsedClock({ since }: { since: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <Text variant="caption" muted style={{ fontVariant: ['tabular-nums'] }}>
      {formatClock((now - new Date(since).getTime()) / 1000)}
    </Text>
  );
}

/** Aviso dentro de la app al terminar el descanso. Se oculta solo. */
export function RestDoneToast({ visible, onHide }: { visible: boolean; onHide: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(onHide, 5000);
    return () => clearTimeout(t);
  }, [visible, onHide]);
  if (!visible) return null;
  return (
    <Pressable
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      onPress={onHide}
      style={{
        position: 'absolute',
        top: insets.top + spacing.sm,
        left: spacing.lg,
        right: spacing.lg,
        alignSelf: 'center',
        maxWidth: 640,
        backgroundColor: colors.primary,
        borderRadius: radius.lg,
        padding: spacing.md,
        elevation: 8,
      }}
    >
      <Text variant="label" style={{ color: colors.onPrimary }}>
        Descanso terminado
      </Text>
      <Text variant="caption" style={{ color: colors.onPrimary }}>
        Es hora de la siguiente serie.
      </Text>
    </Pressable>
  );
}
