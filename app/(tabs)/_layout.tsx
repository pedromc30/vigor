import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme';

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
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
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
