import { useEffect, useState } from 'react';
import { Image, Modal, Pressable, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorText, Screen, Text } from '../src/components/ui';
import { base64ToBytes } from '../src/lib/base64';
import { dayLabel, toISODate } from '../src/lib/diet-math';
import { deletePhoto, listPhotos, signedUrls, uploadPhoto, type ProgressPhoto } from '../src/lib/progress';
import { confirm } from '../src/lib/confirm';
import { shareRemoteImage } from '../src/lib/export';
import { useFocusData } from '../src/lib/use-focus-data';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing, useTheme } from '../src/theme';

export default function Photos() {
  const router = useRouter();
  const { colors } = useTheme();
  const { session } = useAuth();
  const today = toISODate(new Date());
  const { data: photos, error: loadError, reload } = useFocusData(listPhotos);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<ProgressPhoto | null>(null);

  useEffect(() => {
    if (!photos?.length) return setUrls({});
    signedUrls(photos.map((p) => p.storage_path))
      .then(setUrls)
      .catch(() => setError('No se pudieron cargar las imágenes.'));
  }, [photos]);

  const add = async (source: 'camera' | 'library') => {
    if (!session) return;
    setError(null);
    try {
      const perm =
        source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return setError('Sin permiso. Actívalo en los ajustes del sistema para poder añadir fotos.');
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled) return;
      const b64 = res.assets[0]?.base64;
      if (!b64) return setError('No se pudo leer la imagen.');
      setBusy(true);
      await uploadPhoto(session.user.id, today, base64ToBytes(b64));
      await reload();
    } catch {
      setError('No se pudo subir la foto. Comprueba tu conexión (máximo 5 MB por foto).');
    } finally {
      setBusy(false);
    }
  };

  const save = async (p: ProgressPhoto) => {
    const url = urls[p.storage_path];
    if (!url) return;
    try {
      await shareRemoteImage(url, `vigor-foto-${p.taken_on}.jpg`);
    } catch {
      setError('No se pudo guardar la foto en este dispositivo.');
    }
  };

  const remove = async (p: ProgressPhoto) => {
    if (!(await confirm('Eliminar foto', 'Se borrará de forma permanente.', 'Eliminar', true))) return;
    try {
      await deletePhoto(p);
      setOpen(null);
      await reload();
    } catch {
      setError('No se pudo eliminar la foto.');
    }
  };

  return (
    <Screen>
      <Text variant="title">Fotos de progreso</Text>
      <Card>
        <Text variant="label">Privadas</Text>
        <Text variant="caption" muted>
          Se guardan en un espacio privado de tu cuenta: solo tú puedes verlas y se muestran con enlaces temporales. Al eliminar tu cuenta se borran también.
        </Text>
      </Card>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <Button title="Hacer foto" onPress={() => void add('camera')} loading={busy} />
        </View>
        <View style={{ flex: 1 }}>
          <Button title="Elegir foto" variant="secondary" onPress={() => void add('library')} disabled={busy} />
        </View>
      </View>
      <ErrorText>{error ?? loadError}</ErrorText>
      {photos && !photos.length ? <Text muted>Todavía no hay fotos.</Text> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {photos?.map((p) => (
          <Pressable
            key={p.id}
            accessibilityRole="button"
            accessibilityLabel={`Foto del ${dayLabel(p.taken_on, today)}`}
            onPress={() => setOpen(p)}
            style={{ width: '31.5%', aspectRatio: 3 / 4, borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surfaceAlt }}
          >
            {urls[p.storage_path] ? <Image source={{ uri: urls[p.storage_path] }} style={{ flex: 1 }} resizeMode="cover" /> : null}
            <Text variant="caption" style={{ position: 'absolute', bottom: 2, left: 4, color: '#fff', textShadowColor: '#000', textShadowRadius: 3 }}>
              {dayLabel(p.taken_on, today)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />

      <Modal visible={open !== null} animationType="fade" onRequestClose={() => setOpen(null)}>
        <View style={{ flex: 1, backgroundColor: '#000', padding: spacing.lg, gap: spacing.md, justifyContent: 'center' }}>
          {open && urls[open.storage_path] ? (
            <Image source={{ uri: urls[open.storage_path] }} style={{ flex: 1 }} resizeMode="contain" />
          ) : null}
          <Text style={{ color: '#fff', textAlign: 'center' }}>{open ? dayLabel(open.taken_on, today) : ''}</Text>
          {open ? <Button title="Guardar / compartir" onPress={() => void save(open)} /> : null}
          <Button title="Cerrar" variant="secondary" onPress={() => setOpen(null)} />
          {open ? <Button title="Eliminar foto" variant="danger" onPress={() => void remove(open)} /> : null}
        </View>
      </Modal>
    </Screen>
  );
}
