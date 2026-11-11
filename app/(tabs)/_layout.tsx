import { View } from 'react-native';
import { Tabs } from 'expo-router';
import { QuickAdd } from '../../src/components/quick-add';
import { useTheme } from '../../src/theme';

/** Cuatro pestañas (Hoy, Plan, Progreso, Yo). La navegación se dibuja arriba de cada pantalla (`TopTabs`), no abajo. */
export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Tabs screenOptions={{ headerShown: false, tabBarStyle: { display: 'none' } }}>
        <Tabs.Screen name="hoy" options={{ title: 'Hoy' }} />
        <Tabs.Screen name="mi-plan" options={{ title: 'Plan' }} />
        <Tabs.Screen name="progreso" options={{ title: 'Progreso' }} />
        <Tabs.Screen name="perfil" options={{ title: 'Yo' }} />
      </Tabs>
      <QuickAdd />
    </View>
  );
}
