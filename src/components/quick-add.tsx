import { useState } from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionSheet } from './action-sheet';
import { Text } from './ui';
import { addWater } from '../lib/diet';
import { toISODate, type Meal } from '../lib/diet-math';
import { tap } from '../lib/haptics';
import { useAuth } from '../providers/AuthProvider';
import { useTheme } from '../theme';

/** Comida que toca según la hora: es la que se propone al añadir al diario. */
export const mealByHour = (h: number): Meal => (h < 9 ? 'desayuno' : h < 12 ? 'snacks' : h < 16 ? 'comida' : h < 19 ? 'merienda' : 'cena');

/** Botón «+» flotante con las acciones que más se repiten: comida, agua, peso, entreno y foto. */
export function QuickAdd() {
  const { colors } = useTheme();
  const router = useRouter();
  const { session } = useAuth();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Añadir"
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({
          position: 'absolute',
          right: 20,
          bottom: insets.bottom + 20,
          width: 58,
          height: 58,
          borderRadius: 29,
          backgroundColor: colors.primary,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
          shadowColor: colors.primary,
          shadowOpacity: 0.4,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        })}
      >
        <Text style={{ color: colors.onPrimary, fontSize: 32, lineHeight: 36, fontWeight: '500' }}>+</Text>
      </Pressable>
      <ActionSheet
        visible={open}
        title="Añadir"
        onClose={() => setOpen(false)}
        actions={[
          {
            label: 'Comida al diario',
            icon: 'nutrition-outline',
            onPress: () => router.push({ pathname: '/food-add', params: { target: 'diary', meal: mealByHour(new Date().getHours()), date: toISODate(new Date()) } }),
          },
          {
            label: 'Beber agua · +250 ml',
            icon: 'water-outline',
            onPress: () => {
              if (!session) return;
              void addWater(session.user.id, toISODate(new Date()), 250).then(() => tap());
            },
          },
          { label: 'Registrar peso', icon: 'scale-outline', onPress: () => router.push('/weight') },
          { label: 'Empezar entreno', icon: 'barbell-outline', onPress: () => router.push('/entreno') },
          { label: 'Foto de progreso', icon: 'camera-outline', onPress: () => router.push('/photos') },
        ]}
      />
    </>
  );
}
