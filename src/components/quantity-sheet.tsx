import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from 'react-native';
import { parsePositive } from '../lib/diet-entries';
import { type Macros } from '../lib/diet-math';
import { radius, spacing, useTheme } from '../theme';
import { MacroRow } from './plan-summary';
import { Button, ErrorText, LinkButton, Text, TextField } from './ui';

export interface QuantitySheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  unit: 'g' | 'raciones';
  initial: number;
  /** Atajos de cantidad (p. ej. «1 ración (30 g)»). */
  presets?: { label: string; value: number }[];
  macrosFor: (quantity: number) => Macros;
  warnings?: string[];
  confirmLabel: string;
  onConfirm: (quantity: number) => Promise<void> | void;
  onDelete?: () => Promise<void> | void;
  onClose: () => void;
}

/** Hoja inferior para elegir la cantidad de un alimento o receta y ver sus macros al instante. */
export function QuantitySheet(p: QuantitySheetProps) {
  const { colors } = useTheme();
  const [text, setText] = useState(String(p.initial).replace('.', ','));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (p.visible) {
      setText(String(p.initial).replace('.', ','));
      setError(null);
      setBusy(false);
    }
  }, [p.visible, p.initial]);

  const qty = parsePositive(text, p.unit === 'g' ? 20000 : 100);
  const m = qty ? p.macrosFor(qty) : null;

  const run = async (fn: () => Promise<void> | void) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch {
      setError('No se pudo completar la acción. Comprueba tu conexión.');
      setBusy(false);
    }
  };

  return (
    <Modal visible={p.visible} transparent animationType="fade" onRequestClose={p.onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Pressable
          accessibilityLabel="Cerrar"
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }}
          onPress={p.onClose}
        >
          <Pressable
            onPress={() => {}}
            style={{
              backgroundColor: colors.background,
              borderTopLeftRadius: radius.lg,
              borderTopRightRadius: radius.lg,
              padding: spacing.lg,
              paddingBottom: spacing.xl,
              gap: spacing.md,
            }}
          >
            <View>
              <Text variant="heading">{p.title}</Text>
              {p.subtitle ? (
                <Text variant="caption" muted>
                  {p.subtitle}
                </Text>
              ) : null}
            </View>

            {p.warnings?.length ? (
              <View style={{ backgroundColor: colors.warningBg, borderRadius: radius.md, padding: spacing.md }}>
                {p.warnings.map((w) => (
                  <Text key={w} variant="caption" style={{ color: colors.warningText, fontWeight: '600' }}>
                    {w}
                  </Text>
                ))}
              </View>
            ) : null}

            <TextField
              label={p.unit === 'g' ? 'Cantidad (g)' : 'Raciones'}
              value={text}
              onChangeText={setText}
              keyboardType="decimal-pad"
              selectTextOnFocus
              error={text && !qty ? 'Introduce un número mayor que 0' : null}
            />
            {p.presets?.length ? (
              <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
                {p.presets.map((pr) => (
                  <Pressable
                    key={pr.label}
                    accessibilityRole="button"
                    onPress={() => setText(String(pr.value).replace('.', ','))}
                    style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: spacing.md, minHeight: 36, justifyContent: 'center' }}
                  >
                    <Text variant="caption" style={{ fontWeight: '600' }}>
                      {pr.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {m ? (
              <View style={{ gap: spacing.xs }}>
                <Text variant="title">{Math.round(m.kcal)} kcal</Text>
                <MacroRow proteinG={Math.round(m.protein_g * 10) / 10} carbsG={Math.round(m.carbs_g * 10) / 10} fatG={Math.round(m.fat_g * 10) / 10} />
              </View>
            ) : null}

            <ErrorText>{error}</ErrorText>
            <Button title={p.confirmLabel} onPress={() => qty && void run(() => p.onConfirm(qty))} disabled={!qty} loading={busy} />
            {p.onDelete ? <LinkButton title="Eliminar de este día" danger disabled={busy} onPress={() => void run(() => p.onDelete!())} /> : null}
            <Button title="Cancelar" variant="ghost" onPress={p.onClose} />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}
