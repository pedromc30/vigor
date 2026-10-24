import { Modal, Pressable, ScrollView, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { spacing, useTheme } from '../theme';
import { FoodSearch, type FoodChoice } from './food-search';
import { Text } from './ui';

function Body({ onClose, onPick, title }: { onClose: () => void; onPick: (c: FoodChoice) => void; title: string }) {
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
        <Text variant="heading">{title}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Cerrar" onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={26} color={colors.text} />
        </Pressable>
      </View>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xxl }}
        keyboardShouldPersistTaps="handled"
      >
        <FoodSearch allowCreate={false} onSelect={onPick} />
      </ScrollView>
    </View>
  );
}

/** Modal para elegir un alimento (propio u Open Food Facts), p. ej. como ingrediente de una receta. */
export function FoodPickerModal({
  visible,
  onClose,
  onPick,
  title = 'Elegir alimento',
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (c: FoodChoice) => void;
  title?: string;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>{visible ? <Body onClose={onClose} onPick={onPick} title={title} /> : null}</SafeAreaProvider>
    </Modal>
  );
}
