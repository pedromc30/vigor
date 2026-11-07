import { Platform, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, isB, useTheme } from '../../src/theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconOn: IconName }[] = [
  { name: 'home', title: 'Inicio', icon: 'home-outline', iconOn: 'home' },
  { name: 'entreno', title: 'Entreno', icon: 'barbell-outline', iconOn: 'barbell' },
  { name: 'dieta', title: 'Dieta', icon: 'nutrition-outline', iconOn: 'nutrition' },
  { name: 'progreso', title: 'Progreso', icon: 'stats-chart-outline', iconOn: 'stats-chart' },
  { name: 'perfil', title: 'Perfil', icon: 'person-outline', iconOn: 'person' },
];

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: isB ? colors.primary : colors.ink,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: isB ? colors.surface : colors.background, borderTopColor: colors.border, borderTopWidth: isB ? 0 : StyleSheet.hairlineWidth, elevation: 0, shadowOpacity: 0, ...(Platform.OS === 'web' ? { height: 62 } : null) },
        tabBarLabelStyle: { fontFamily: fontFamily('500'), fontSize: 11, lineHeight: 13 },
        tabBarItemStyle: { paddingTop: 6, paddingBottom: 4 },
      }}
    >
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarIcon: ({ color, size, focused }) => (
              <Ionicons name={focused ? t.iconOn : t.icon} size={size} color={color as string} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
