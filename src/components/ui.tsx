import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing, useTheme } from '../theme';

type Variant = 'title' | 'heading' | 'body' | 'caption' | 'label';

const textStyles: Record<Variant, { fontSize: number; fontWeight: '400' | '600' | '700'; lineHeight: number }> = {
  title: { fontSize: 28, fontWeight: '700', lineHeight: 34 },
  heading: { fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400', lineHeight: 22 },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
};

export function Text({
  variant = 'body',
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean }) {
  const { colors } = useTheme();
  return <RNText {...rest} style={[textStyles[variant], { color: muted ? colors.textMuted : colors.text }, style]} />;
}

export function Screen({
  children,
  scroll = true,
  padTop = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padTop?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const content = { padding: spacing.lg, paddingTop: padTop ? insets.top + spacing.lg : spacing.lg, gap: spacing.lg };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[content, { paddingBottom: insets.bottom + spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.lg,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: spacing.lg,
          gap: spacing.sm,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  loading?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const bg = { primary: colors.primary, secondary: colors.surfaceAlt, danger: 'transparent', ghost: 'transparent' }[variant];
  const fg = { primary: colors.onPrimary, secondary: colors.text, danger: colors.danger, ghost: colors.primary }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => ({
        backgroundColor: bg,
        borderRadius: radius.md,
        borderWidth: variant === 'danger' ? 1 : 0,
        borderColor: colors.danger,
        minHeight: 50,
        paddingHorizontal: spacing.lg,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text variant="label" style={{ color: fg, fontSize: 16 }}>{title}</Text>}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  suffix,
  ...rest
}: TextInputProps & { label: string; error?: string | null; suffix?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          {...rest}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 50,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? colors.danger : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: spacing.md,
            fontSize: 16,
          }}
        />
        {suffix ? (
          <Text muted style={{ marginLeft: spacing.sm, minWidth: 32 }}>
            {suffix}
          </Text>
        ) : null}
      </View>
      {error ? (
        <Text variant="caption" style={{ color: colors.danger }}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

/** Selección única mostrada como tarjetas verticales (con descripción opcional). */
export function OptionList<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; title: string; hint?: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.sm }} accessibilityRole="radiogroup">
      <Text variant="label">{label}</Text>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.value)}
            style={{
              borderRadius: radius.md,
              borderWidth: selected ? 2 : 1,
              borderColor: selected ? colors.primary : colors.border,
              backgroundColor: colors.surface,
              padding: spacing.md,
            }}
          >
            <Text variant="label">{o.title}</Text>
            {o.hint ? (
              <Text variant="caption" muted>
                {o.hint}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

/** Fila de opciones cortas en línea (sexo, días de entreno…). */
export function SegmentRow<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; title: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.value === value;
          return (
            <Pressable
              key={String(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.value)}
              style={{
                minWidth: 48,
                minHeight: 44,
                paddingHorizontal: spacing.lg,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.md,
                backgroundColor: selected ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
              }}
            >
              <Text variant="label" style={{ color: selected ? colors.onPrimary : colors.text }}>
                {o.title}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function ChipMulti({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <Pressable
              key={o.key}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              onPress={() => onToggle(o.key)}
              style={{
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                minHeight: 40,
                justifyContent: 'center',
                borderRadius: 999,
                backgroundColor: on ? colors.primary : colors.surface,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.border,
              }}
            >
              <Text variant="caption" style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '600' }}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Disclaimer() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={{ backgroundColor: colors.warningBg, borderRadius: radius.md, padding: spacing.md, gap: spacing.xs }}
    >
      <Text variant="label" style={{ color: colors.warningText }}>
        Aviso importante
      </Text>
      <Text variant="caption" style={{ color: colors.warningText }}>
        Vigor es una herramienta orientativa y no sustituye el consejo de un dietista-nutricionista ni de un médico.
        Consulta con un profesional sanitario antes de cambiar tu dieta o rutina de ejercicio, sobre todo si tienes
        alguna patología, estás embarazada o tomas medicación.
      </Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <Text variant="caption" style={{ color: colors.danger }} accessibilityRole="alert">
      {children}
    </Text>
  );
}

/** Filtro de selección única en chips; `allLabel` añade una opción «todos» con valor null. */
export function ChipSingle<T extends string>({
  options,
  value,
  onChange,
  allLabel,
}: {
  options: { key: T; label: string }[];
  value: T | null;
  onChange: (v: T | null) => void;
  allLabel?: string;
}) {
  const { colors } = useTheme();
  const items: { key: T | null; label: string }[] = allLabel ? [{ key: null, label: allLabel }, ...options] : options;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} accessibilityRole="radiogroup">
      {items.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={String(o.key)}
            accessibilityRole="radio"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(o.key)}
            style={{
              paddingHorizontal: spacing.md,
              minHeight: 36,
              justifyContent: 'center',
              borderRadius: 999,
              backgroundColor: on ? colors.primary : colors.surface,
              borderWidth: 1,
              borderColor: on ? colors.primary : colors.border,
            }}
          >
            <Text variant="caption" style={{ color: on ? colors.onPrimary : colors.text, fontWeight: '600' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Botón pequeño de texto para acciones secundarias dentro de tarjetas. */
export function LinkButton({
  title,
  onPress,
  danger,
  disabled,
}: {
  title: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      hitSlop={8}
      style={{ minHeight: 36, justifyContent: 'center', opacity: disabled ? 0.5 : 1 }}
    >
      <Text variant="label" style={{ color: danger ? colors.danger : colors.primary }}>
        {title}
      </Text>
    </Pressable>
  );
}
