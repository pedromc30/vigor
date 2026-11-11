import { Pressable, View } from 'react-native';
import { usePathname, useRouter, type Href } from 'expo-router';
import { Text } from './ui';
import { radius, spacing, useTheme } from '../theme';

const TABS: { path: string; title: string; href: Href }[] = [
  { path: '/hoy', title: 'Hoy', href: '/hoy' },
  { path: '/mi-plan', title: 'Plan', href: '/mi-plan' },
  { path: '/progreso', title: 'Progreso', href: '/progreso' },
  { path: '/perfil', title: 'Yo', href: '/perfil' },
];

/** Navegación principal: cuatro pestañas en una píldora, arriba de cada pantalla (sustituye a la barra inferior). */
export function TopTabs() {
  const { colors } = useTheme();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', gap: 6, backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 }}
    >
      {TABS.map((t) => {
        const on = pathname === t.path;
        return (
          <Pressable
            key={t.path}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => router.navigate(t.href)}
            style={{
              flex: 1,
              minHeight: 40,
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: radius.md - 3,
              backgroundColor: on ? colors.ink : 'transparent',
            }}
          >
            <Text variant="label" style={{ fontWeight: '700', fontSize: 13, color: on ? colors.onInk : colors.textMuted }}>
              {t.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
