import { useEffect, useState } from 'react';
import { Pressable, Vibration, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatClock } from '../lib/training-math';
import { radius, spacing, useTheme } from '../theme';
import { Text } from './ui';

export interface RestState {
  endsAt: number;
  total: number;
}

/** Barra inferior con la cuenta atrás del descanso. Usa la hora de fin, así no se desfasa en segundo plano. */
export function RestBar({
  rest,
  onChange,
}: {
  rest: RestState;
  onChange: (next: RestState | null) => void;
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
      Vibration.vibrate([0, 400, 150, 400]);
      onChange(null);
    }
  }, [remaining, onChange]);

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
