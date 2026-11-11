import { useRouter } from 'expo-router';
import { TopTabs } from '../../src/components/top-tabs';
import { LinkRow, Screen, Text } from '../../src/components/ui';
import { spacing } from '../../src/theme';
import { View } from 'react-native';

/** Plan: de aquí se llega a todo lo que se prepara con antelación (comidas, entrenos, recetas y archivos). */
export default function MiPlan() {
  const router = useRouter();
  return (
    <Screen>
      <TopTabs />
      <Text variant="title" style={{ fontSize: 46, lineHeight: 44 }}>
        Plan
      </Text>

      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" muted style={{ fontWeight: '700' }}>
          Comidas
        </Text>
        <LinkRow title="Planificador semanal" hint="Qué comer cada día de la semana" onPress={() => router.push('/plan')} />
        <LinkRow title="Lista de la compra" hint="Los ingredientes de toda la semana" onPress={() => router.push('/shopping')} />
        <LinkRow title="Diario de comidas" hint="Lo que has comido, día a día" onPress={() => router.push('/dieta')} />
        <LinkRow title="Archivos de dieta" hint="PDF, Excel o CSV de tu dietista" onPress={() => router.push('/diet-files')} />
        <LinkRow title="Nuevo alimento" onPress={() => router.push('/food-create')} />
        <LinkRow title="Nueva receta" onPress={() => router.push('/recipe-edit')} />
      </View>

      <View style={{ gap: spacing.xs }}>
        <Text variant="caption" muted style={{ fontWeight: '700' }}>
          Entrenos
        </Text>
        <LinkRow title="Rutinas y entreno" hint="Tus rutinas y el volumen de la semana" onPress={() => router.push('/entreno')} />
        <LinkRow title="Historial de sesiones" onPress={() => router.push('/history')} />
        <LinkRow title="Biblioteca de ejercicios" onPress={() => router.push('/exercises')} />
      </View>
      <View style={{ height: 70 }} />
    </Screen>
  );
}
