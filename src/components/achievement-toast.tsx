import { useEffect, useRef } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Celebration } from '../lib/achievements';
import { radius, spacing, useTheme } from '../theme';
import { Text } from './ui';

const SHOW_MS = 4500;

/**
 * Celebración breve de un logro, con la sesión en vivo debajo (no bloquea nada). Muestra uno por uno los avisos de
 * `queue`; al terminar cada uno (solo o al tocarlo) llama a `onNext` para que quien la usa lo quite de la cola.
 */
export function AchievementToast({ queue, onNext }: { queue: Celebration[]; onNext: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const current = queue[0];
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.spring(anim, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }).start();
    const t = setTimeout(onNext, SHOW_MS);
    return () => clearTimeout(t);
    // Un aviso nuevo (otra posición de la cola con otro contenido) reinicia la animación y el tiempo.
  }, [current, anim, onNext]);

  if (!current) return null;
  return (
    <Animated.View
      pointerEvents="box-none"
      style={{
        position: 'absolute',
        top: insets.top + spacing.sm + 64, // por debajo del aviso de fin de descanso
        left: spacing.lg,
        right: spacing.lg,
        alignSelf: 'center',
        maxWidth: 640,
        opacity: anim,
        transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
      }}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="assertive"
        accessibilityLabel={`${current.title} ${current.detail}`}
        onPress={onNext}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: colors.warningBg,
          borderColor: colors.warningText,
          borderWidth: 1,
          borderRadius: radius.lg,
          padding: spacing.md,
          elevation: 8,
        }}
      >
        <Ionicons name="trophy" size={30} color={colors.warningText} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text variant="label" style={{ color: colors.warningText }}>
            {current.title}
          </Text>
          <Text variant="caption" style={{ color: colors.warningText }}>
            {current.detail}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  );
}
