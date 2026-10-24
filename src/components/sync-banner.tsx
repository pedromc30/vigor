import { useEffect, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { offline } from '../lib/supabase';
import { useSyncState } from '../lib/offline/use-sync-state';
import { radius, spacing, useTheme } from '../theme';
import { Text } from './ui';

/** Aviso flotante del estado de conexión y de los cambios que aún no se han enviado. */
export function SyncBanner() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { online, pending, syncing, failures, version } = useSyncState();
  const [justSynced, setJustSynced] = useState(false);
  const lastVersion = useRef(version);

  useEffect(() => {
    if (version !== lastVersion.current && pending === 0) {
      lastVersion.current = version;
      setJustSynced(true);
      const t = setTimeout(() => setJustSynced(false), 3000);
      return () => clearTimeout(t);
    }
    lastVersion.current = version;
  }, [version, pending]);

  let text: string | null = null;
  let tone: 'info' | 'warn' | 'error' | 'ok' = 'info';
  if (failures.length) {
    text = `${failures.length} cambio${failures.length === 1 ? '' : 's'} no se pudo${failures.length === 1 ? '' : 'ieron'} sincronizar (el servidor los rechazó).`;
    tone = 'error';
  } else if (!online) {
    text = pending > 0 ? `Sin conexión · ${pending} cambio${pending === 1 ? '' : 's'} se enviará${pending === 1 ? '' : 'n'} al volver la red` : 'Sin conexión · usando los datos guardados';
    tone = 'warn';
  } else if (pending > 0) {
    text = syncing ? `Sincronizando ${pending} cambio${pending === 1 ? '' : 's'}…` : `${pending} cambio${pending === 1 ? '' : 's'} pendiente${pending === 1 ? '' : 's'} de enviar`;
  } else if (justSynced) {
    text = 'Todo sincronizado ✓';
    tone = 'ok';
  }
  if (!text) return null;

  const bg = tone === 'error' ? colors.danger : tone === 'warn' ? colors.warningBg : colors.surface;
  const fg = tone === 'error' ? '#fff' : tone === 'warn' ? colors.warningText : colors.text;

  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: insets.bottom + 68, alignItems: 'center' }}>
      <View
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.md,
          backgroundColor: bg,
          borderRadius: radius.md,
          borderWidth: tone === 'error' ? 0 : 1,
          borderColor: colors.border,
          paddingVertical: spacing.sm,
          paddingHorizontal: spacing.md,
        }}
      >
        <Text variant="caption" style={{ color: fg, fontWeight: '600', flexShrink: 1 }}>
          {text}
        </Text>
        {failures.length ? (
          <Pressable accessibilityRole="button" onPress={() => offline.store.dismissFailures()} hitSlop={8}>
            <Text variant="caption" style={{ color: fg, fontWeight: '700', textDecorationLine: 'underline' }}>
              Entendido
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
