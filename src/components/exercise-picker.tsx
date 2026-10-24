import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Exercise } from '../lib/training';
import { spacing, useTheme } from '../theme';
import { ExerciseBrowser } from './exercise-browser';
import { Text } from './ui';

function PickerBody({ onClose, onPick }: { onClose: () => void; onPick: (e: Exercise) => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: spacing.lg,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text variant="heading">Elegir ejercicio</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <ExerciseBrowser onPick={onPick} />
      </ScrollView>
    </View>
  );
}

/** Modal para elegir un ejercicio de la biblioteca (o crear uno nuevo). */
export function ExercisePicker({
  visible,
  onClose,
  onPick,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (e: Exercise) => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <PickerBody onClose={onClose} onPick={onPick} />
      </SafeAreaProvider>
    </Modal>
  );
}
