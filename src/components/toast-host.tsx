import { useEffect, useRef, useState } from 'react';
import { Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subscribeToast } from '../lib/toast';
import { radius, spacing, useTheme } from '../theme';
import { Text } from './ui';

const SHOW_MS = 2600;

/** Muestra durante unos segundos la última confirmación (arriba, sin bloquear nada). */
export function ToastHost() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [message, setMessage] = useState<string | null>(null);
  const anim = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () =>
      subscribeToast((m) => {
        if (timer.current) clearTimeout(timer.current);
        setMessage(m);
        anim.setValue(0);
        Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
        timer.current = setTimeout(() => {
          Animated.timing(anim, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setMessage(null));
        }, SHOW_MS);
      }),
    [anim],
  );
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  if (!message) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + spacing.sm, left: spacing.lg, right: spacing.lg, alignItems: 'center' }}>
      <Animated.View
        accessibilityLiveRegion="polite"
        style={{
          opacity: anim,
          transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
          backgroundColor: colors.ink,
          borderRadius: radius.lg,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.lg,
          maxWidth: 640,
        }}
      >
        <Text variant="label" style={{ color: colors.onInk, fontWeight: '700' }}>
          ✓ {message}
        </Text>
      </Animated.View>
    </View>
  );
}
