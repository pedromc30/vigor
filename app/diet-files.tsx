import { useState } from 'react';
import { Linking, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ActionSheet } from '../src/components/action-sheet';
import { Button, Card, ErrorText, LinkButton, Screen, Text } from '../src/components/ui';
import { base64ToBytes } from '../src/lib/base64';
import { confirm } from '../src/lib/confirm';
import { fromISODate } from '../src/lib/diet-math';
import { DIET_FILE_MIMES, formatSize, resolveDietFile, typeOf } from '../src/lib/diet-file-types';
import { deleteDietFile, dietFileUrl, listDietFiles, uploadDietFile, type DietFile } from '../src/lib/diet-files';
import { shareRemoteFile } from '../src/lib/export';
import { readPickedBytes } from '../src/lib/file-bytes';
import { success } from '../src/lib/haptics';
import { useFocusData } from '../src/lib/use-focus-data';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing, useTheme } from '../src/theme';

const dateLabel = (iso: string) => fromISODate(iso.slice(0, 10)).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export default function DietFiles() {
  const router = useRouter();
  const { session } = useAuth();
  const { colors } = useTheme();
  const { data: files, error: loadError, loading, reload } = useFocusData(listDietFiles);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: { name: string; mimeType?: string | null; size?: number | null }, bytes: () => Promise<Uint8Array>) => {
    if (!session) return;
    const checked = resolveDietFile(file);
    if (!checked.ok) return setError(checked.error);
    setBusy(true);
    try {
      await uploadDietFile(session.user.id, { name: checked.name, mime: checked.mime, ext: checked.ext, bytes: await bytes() });
      success();
      await reload();
    } catch {
      setError('No se pudo subir el archivo. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const pickFile = async () => {
    setError(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: DIET_FILE_MIMES, copyToCacheDirectory: true, multiple: false });
      if (res.canceled) return;
      const a = res.assets[0];
      await upload({ name: a.name, mimeType: a.mimeType, size: a.size }, () => readPickedBytes(a));
    } catch {
      setError('No se pudo leer el archivo elegido.');
    }
  };

  const takePhoto = async () => {
    setError(null);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError('Sin permiso de cámara. Actívalo en los ajustes del sistema para hacer fotos.');
      const res = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
      if (res.canceled) return;
      const b64 = res.assets[0]?.base64;
      if (!b64) return setError('No se pudo leer la foto.');
      const bytes = base64ToBytes(b64);
      await upload({ name: `Foto de dieta ${dateLabel(new Date().toISOString())}.jpg`, mimeType: 'image/jpeg', size: bytes.byteLength }, async () => bytes);
    } catch {
      setError('No se pudo hacer la foto.');
    }
  };

  const open = async (f: DietFile) => {
    setError(null);
    try {
      await Linking.openURL(await dietFileUrl(f.storage_path));
    } catch {
      setError('No se pudo abrir el archivo. Comprueba tu conexión.');
    }
  };

  const share = async (f: DietFile) => {
    setError(null);
    try {
      await shareRemoteFile(await dietFileUrl(f.storage_path), f.name, f.mime_type);
    } catch {
      setError('No se pudo compartir el archivo.');
    }
  };

  const remove = async (f: DietFile) => {
    if (!(await confirm('Eliminar archivo', `«${f.name}» se borrará de forma permanente.`, 'Eliminar', true))) return;
    setError(null);
    try {
      await deleteDietFile(f);
      await reload();
    } catch {
      setError('No se pudo eliminar el archivo.');
    }
  };

  return (
    <Screen>
      <Text variant="title">Archivos de dieta</Text>
      <Text muted>Guarda aquí la dieta que te dé tu dietista (PDF, foto, Word o Excel) y ábrela cuando la necesites. Máximo 10 MB por archivo.</Text>
      <ErrorText>{loadError ?? error}</ErrorText>

      <Button title="Adjuntar archivo" onPress={() => setMenu(true)} loading={busy} />

      {loading ? <Text muted>Cargando…</Text> : null}
      {files && !files.length ? <Text muted>Todavía no has adjuntado ningún archivo.</Text> : null}
      {files?.map((f) => {
        const t = typeOf(f.mime_type);
        return (
          <Card key={f.id}>
            <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
              <Ionicons name={t.icon} size={28} color={colors.textMuted} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text variant="label" numberOfLines={2}>
                  {f.name}
                </Text>
                <Text variant="caption" muted>
                  {t.label} · {formatSize(f.size_bytes)} · {dateLabel(f.created_at)}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.lg }}>
              <LinkButton title="Abrir" onPress={() => void open(f)} />
              <LinkButton title="Compartir" onPress={() => void share(f)} />
              <LinkButton title="Eliminar" danger onPress={() => void remove(f)} />
            </View>
          </Card>
        );
      })}

      <Button title="Volver" variant="ghost" onPress={() => router.back()} />

      <ActionSheet
        visible={menu}
        title="Adjuntar archivo"
        onClose={() => setMenu(false)}
        actions={[
          { label: 'Elegir un archivo', icon: 'document-attach-outline', onPress: () => void pickFile() },
          { label: 'Hacer una foto', icon: 'camera-outline', onPress: () => void takePhoto() },
        ]}
      />
    </Screen>
  );
}
