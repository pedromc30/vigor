import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fontFamily, useTheme } from '../../src/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TAB_ICONS: Record<string, [IconName, IconName]> = {
  hoy: ['home-outline', 'home'],
  entreno: ['barbell-outline', 'barbell'],
  dieta: ['nutrition-outline', 'nutrition'],
  perfil: ['person-outline', 'person'],
};

/** Cuatro secciones en la barra inferior, cada una con su icono: Hoy, Entrenamientos, Dieta y Perfil. */
export default function TabsLayout() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: { fontFamily: fontFamily('700'), fontSize: 11 },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          height: 58 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 4,
        },
        sceneStyle: { backgroundColor: colors.background },
        tabBarIcon: ({ focused, color }) => {
          const [off, on] = TAB_ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          return <Ionicons name={focused ? on : off} size={24} color={String(color)} />;
        },
      })}
    >
      <Tabs.Screen name="hoy" options={{ title: 'Hoy' }} />
      <Tabs.Screen name="entreno" options={{ title: 'Entrenamientos' }} />
      <Tabs.Screen name="dieta" options={{ title: 'Dieta' }} />
      <Tabs.Screen name="perfil" options={{ title: 'Perfil' }} />
    </Tabs>
  );
}
