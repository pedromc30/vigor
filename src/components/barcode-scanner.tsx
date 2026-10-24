import { useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { radius, spacing } from '../theme';
import { Button, Text } from './ui';

function ScannerBody({ onClose, onScan }: { onClose: () => void; onScan: (code: string) => void }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const handled = useRef(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {permission?.granted ? (
        <CameraView
          style={{ flex: 1 }}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
          onBarcodeScanned={({ data }) => {
            if (handled.current) return; // la cámara emite el mismo código varias veces
            handled.current = true;
            onScan(data);
          }}
          onMountError={() => setError('No se pudo iniciar la cámara.')}
        />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.lg }}>
          <Text style={{ color: '#fff', textAlign: 'center' }}>
            {permission && !permission.canAskAgain
              ? 'El permiso de cámara está denegado. Actívalo en los ajustes del sistema para escanear códigos de barras.'
              : 'Vigor necesita la cámara solo para leer códigos de barras. No se guardan imágenes.'}
          </Text>
          {permission?.canAskAgain !== false ? <Button title="Permitir cámara" onPress={() => void requestPermission()} /> : null}
        </View>
      )}

      {permission?.granted ? (
        <View pointerEvents="none" style={{ ...absoluteCenter }}>
          <View style={{ width: 280, height: 160, borderRadius: radius.lg, borderWidth: 3, borderColor: '#fff', opacity: 0.8 }} />
          <Text style={{ color: '#fff', marginTop: spacing.md }}>Apunta al código de barras</Text>
        </View>
      ) : null}

      {error ? (
        <Text style={{ color: '#fff', position: 'absolute', bottom: insets.bottom + 90, alignSelf: 'center' }}>{error}</Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Cerrar escáner"
        onPress={onClose}
        hitSlop={12}
        style={{ position: 'absolute', top: insets.top + spacing.md, right: spacing.lg, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 24, padding: 8 }}
      >
        <Ionicons name="close" size={28} color="#fff" />
      </Pressable>
    </View>
  );
}

const absoluteCenter = {
  position: 'absolute' as const,
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

/** Escáner de códigos de barras EAN/UPC a pantalla completa. */
export function BarcodeScanner({ visible, onClose, onScan }: { visible: boolean; onClose: () => void; onScan: (code: string) => void }) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>{visible ? <ScannerBody onClose={onClose} onScan={onScan} /> : null}</SafeAreaProvider>
    </Modal>
  );
}
