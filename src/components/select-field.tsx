import { useState } from 'react';
import { Modal, Pressable, ScrollView, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useTheme } from '../theme';
import { Button, Text } from './ui';

export interface SelectOption {
  key: string;
  label: string;
  hint?: string;
}

/**
 * Desplegable: un campo que muestra el valor elegido y, al pulsarlo, abre una lista grande y fácil de tocar en el móvil.
 * `value` que no esté en las opciones (p. ej. un dato antiguo) se muestra tal cual.
 */
export function SelectField({
  label,
  title,
  value,
  options,
  onChange,
  disabled,
  placeholder = '—',
  style,
}: {
  /** Texto para accesibilidad del campo. */
  label: string;
  /** Título de la lista; por defecto, `label`. */
  title?: string;
  value: string;
  options: SelectOption[];
  onChange: (key: string) => void;
  disabled?: boolean;
  placeholder?: string;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const { height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.key === value);
  const shown = value === '' ? placeholder : (current?.label ?? value);

  return (
    <>
      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          {
            minWidth: 0,
            minHeight: 44,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            borderRadius: radius.sm,
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: disabled ? colors.surfaceAlt : colors.surface,
          },
          style,
        ]}
      >
        <Text numberOfLines={1} style={{ fontSize: 16, color: value === '' ? colors.textMuted : colors.text }}>
          {shown}
        </Text>
        {disabled ? null : <Ionicons name="chevron-down" size={14} color={colors.textMuted} />}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}>
          <Pressable accessibilityLabel="Cerrar" style={{ flex: 1 }} onPress={() => setOpen(false)} />
          <View
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              gap: spacing.sm,
              maxHeight: height * 0.8,
              width: '100%',
              maxWidth: 640,
              alignSelf: 'center',
            }}
          >
            <Text variant="heading">{title ?? label}</Text>
            <ScrollView style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
              {options.map((o) => {
                const on = o.key === value;
                return (
                  <Pressable
                    key={o.key || 'vacío'}
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: on }}
                    onPress={() => {
                      setOpen(false);
                      onChange(o.key);
                    }}
                    style={{
                      minHeight: 52,
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      paddingHorizontal: spacing.md,
                      borderRadius: radius.md,
                      backgroundColor: on ? colors.surfaceAlt : 'transparent',
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text variant="label">{o.label}</Text>
                      {o.hint ? (
                        <Text variant="caption" muted>
                          {o.hint}
                        </Text>
                      ) : null}
                    </View>
                    {on ? <Ionicons name="checkmark" size={22} color={colors.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Button title="Cancelar" variant="ghost" onPress={() => setOpen(false)} />
          </View>
        </View>
      </Modal>
    </>
  );
}

/** Opciones de RPE: sin dato y del 1 al 10 (esfuerzo percibido). */
export const RPE_OPTIONS: SelectOption[] = [
  { key: '', label: 'Sin RPE' },
  ...Array.from({ length: 10 }, (_, i) => {
    const n = i + 1;
    const hints: Record<number, string> = {
      10: 'Esfuerzo máximo, sin reservas',
      9: 'Quedaba 1 repetición',
      8: 'Quedaban 2 repeticiones',
      7: 'Quedaban 3 repeticiones',
    };
    return { key: String(n), label: String(n), hint: hints[n] };
  }),
];
