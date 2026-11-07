import { useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  type StyleProp,
  type TextStyle,
  KeyboardAvoidingView,
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
import { Ionicons } from '@expo/vector-icons';
import { fontFamily, radius, spacing, useTheme } from '../theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'caption' | 'label';

// Escala tipográfica: cifras grandes en negrita, títulos firmes y un cuerpo cómodo de leer.
const textStyles: Record<Variant, { fontSize: number; fontWeight: '400' | '500' | '600' | '700' | '800'; lineHeight: number; letterSpacing: number }> = {
  display: { fontSize: 56, fontWeight: '800', lineHeight: 60, letterSpacing: -1.5 },
  title: { fontSize: 28, fontWeight: '800', lineHeight: 34, letterSpacing: -0.5 },
  heading: { fontSize: 18, fontWeight: '700', lineHeight: 24, letterSpacing: -0.2 },
  body: { fontSize: 16, fontWeight: '500', lineHeight: 23, letterSpacing: 0 },
  caption: { fontSize: 13, fontWeight: '500', lineHeight: 18, letterSpacing: 0 },
  label: { fontSize: 14, fontWeight: '600', lineHeight: 20, letterSpacing: 0 },
};

export function Text({
  variant = 'body',
  muted,
  style,
  ...rest
}: TextProps & { variant?: Variant; muted?: boolean }) {
  const { colors } = useTheme();
  // El grosor (también el que se pasa en `style`) decide el archivo de la fuente; se quita `fontWeight` para no engrosarlo dos veces.
  const { fontWeight, ...custom } = (StyleSheet.flatten(style as StyleProp<TextStyle>) ?? {}) as TextStyle;
  const base = textStyles[variant];
  return (
    <RNText
      {...rest}
      style={[
        { ...base, fontWeight: undefined },
        { color: muted ? colors.textMuted : colors.text, fontFamily: fontFamily(fontWeight ?? base.fontWeight) },
        custom,
      ]}
    />
  );
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
  // En pantallas anchas (tablet, web) el contenido no se estira: queda centrado con un ancho máximo.
  const content = {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    paddingTop: padTop ? insets.top + spacing.xl : spacing.lg,
    gap: spacing.xl,
    width: '100%' as const,
    maxWidth: 640,
    alignSelf: 'center' as const,
  };
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
    >
      {scroll ? (
        <ScrollView
          contentContainerStyle={[content, { paddingBottom: insets.bottom + spacing.xxl * 2 }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, content]}>{children}</View>
      )}
    </KeyboardAvoidingView>
  );
}

/** Baldosa redondeada. `tone` la pinta con el pastel de su zona (azul entreno, menta dieta, ámbar progreso). */
export function Card({ children, style, tone }: { children: ReactNode; style?: ViewStyle; tone?: 'blue' | 'mint' | 'amber' }) {
  const { colors } = useTheme();
  const bg = tone === 'blue' ? colors.tintBlue : tone === 'mint' ? colors.tintMint : tone === 'amber' ? colors.tintAmber : colors.surface;
  return <View style={[{ backgroundColor: bg, borderRadius: radius.lg, padding: spacing.lg, gap: spacing.sm }, style]}>{children}</View>;
}

/** Fila de navegación: título, ayuda opcional y una flecha. Sustituye a los botones apilados que solo llevan a otra pantalla. */
export function LinkRow({ title, hint, onPress }: { title: string; hint?: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 56,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.md,
        backgroundColor: colors.surface,
        borderRadius: radius.md,
        paddingHorizontal: spacing.lg,
        paddingVertical: spacing.sm,
        marginBottom: spacing.sm,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text variant="body" style={{ fontWeight: '700' }}>
          {title}
        </Text>
        {hint ? (
          <Text variant="caption" muted>
            {hint}
          </Text>
        ) : null}
      </View>
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
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
  // Principal: tinta rellena. Secundario: solo contorno. Peligro: contorno rojo. Ghost: texto apagado.
  const bg = { primary: colors.ink, secondary: colors.tintBlue, danger: 'transparent', ghost: 'transparent' }[variant];
  const fg = { primary: colors.onInk, secondary: colors.primary, danger: colors.danger, ghost: colors.textMuted }[variant];
  const line = { primary: 'transparent', secondary: colors.border, danger: colors.danger, ghost: 'transparent' }[variant];
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
        borderWidth: variant === 'primary' || variant === 'ghost' || variant === 'secondary' ? 0 : 1,
        borderColor: line,
        minHeight: 52,
        paddingHorizontal: spacing.xl,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: inactive ? 0.4 : pressed ? 0.75 : 1,
      })}
    >
      {loading ? <ActivityIndicator color={fg} /> : <Text variant="label" style={{ color: fg, fontSize: 16, fontWeight: '700' }}>{title}</Text>}
    </Pressable>
  );
}

export function TextField({
  label,
  error,
  suffix,
  onFocus,
  onBlur,
  ...rest
}: TextInputProps & { label: string; error?: string | null; suffix?: string }) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <Text variant="caption" muted style={{ fontWeight: '500' }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.textMuted}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 52,
            borderRadius: radius.md,
            borderWidth: focused || error ? 1.5 : 0,
            borderColor: error ? colors.danger : focused ? colors.ink : colors.border,
            backgroundColor: colors.surface,
            color: colors.text,
            paddingHorizontal: spacing.lg,
            fontSize: 16,
            fontFamily: fontFamily('400'),
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
      <Text variant="caption" muted style={{ fontWeight: '500' }}>
        {label}
      </Text>
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
              borderWidth: selected ? 1.5 : 1,
              borderColor: selected ? colors.ink : colors.border,
              backgroundColor: colors.surface,
              padding: spacing.lg,
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
      <Text variant="caption" muted style={{ fontWeight: '500' }}>
        {label}
      </Text>
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
                backgroundColor: selected ? colors.ink : colors.surface,
                borderWidth: 0,
                borderColor: selected ? colors.ink : colors.border,
              }}
            >
              <Text variant="label" style={{ color: selected ? colors.onInk : colors.text }}>
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
      <Text variant="caption" muted style={{ fontWeight: '500' }}>
        {label}
      </Text>
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
                backgroundColor: on ? colors.ink : colors.surface,
                borderWidth: 0,
                borderColor: on ? colors.ink : colors.border,
              }}
            >
              <Text variant="caption" style={{ color: on ? colors.onInk : colors.text, fontWeight: '500' }}>
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
              backgroundColor: on ? colors.ink : colors.surface,
              borderWidth: 0,
              borderColor: on ? colors.ink : colors.border,
            }}
          >
            <Text variant="caption" style={{ color: on ? colors.onInk : colors.text, fontWeight: '500' }}>
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
      <Text variant="label" style={{ color: danger ? colors.danger : colors.primary, fontWeight: '500' }}>
        {title}
      </Text>
    </Pressable>
  );
}
