import { Pressable, View } from "react-native";
import { Text } from "./ui";
import { spacing, useTheme } from "../theme";

/** La acción principal de una pantalla: un botón grande y siempre visible, encima de la barra inferior. */
export function FloatingAction({
  title,
  onPress,
  disabled,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      pointerEvents="box-none"
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: spacing.lg,
        alignItems: "center",
        paddingHorizontal: spacing.xl,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        disabled={disabled}
        onPress={onPress}
        style={({ pressed }) => ({
          width: "100%",
          maxWidth: 640,
          minHeight: 54,
          borderRadius: 999,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.primary,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          shadowColor: colors.primary,
          shadowOpacity: 0.35,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 6,
        })}
      >
        <Text
          variant="label"
          style={{ color: colors.onPrimary, fontWeight: "800", fontSize: 16 }}
        >
          {title}
        </Text>
      </Pressable>
    </View>
  );
}
