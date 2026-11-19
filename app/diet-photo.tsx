import { useState } from 'react';
import { View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { Button, Card, ChipSingle, ErrorText, Screen, Text, TextField } from '../src/components/ui';
import { parseDietText } from '../src/lib/diet-text';
import { WEEKDAY_LONG } from '../src/lib/labels';
import { ocrSupported, readTextFromImage } from '../src/lib/ocr';
import { setPendingImport } from '../src/lib/pending-import';
import { spacing } from '../src/theme';

const DAY_OPTIONS = [1, 2, 3, 4, 5, 6, 7].map((d) => ({ key: String(d), label: WEEKDAY_LONG[d].slice(0, 3) }));

/** Dieta a partir de una foto: se lee el texto en el móvil, se puede corregir y se interpreta con el mismo revisor que un PDF o un Excel. */
export default function DietPhoto() {
  const router = useRouter();
  const [text, setText] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    setError(null);
    try {
      const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return setError(source === 'camera' ? 'Para hacer la foto, permite el acceso a la cámara en los ajustes del móvil.' : 'Para elegir una foto, permite el acceso a tus fotos en los ajustes del móvil.');
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1 };
      const res = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (res.canceled || !res.assets[0]) return;
      setBusy(true);
      const read = await readTextFromImage(res.assets[0].uri);
      if (!read.trim()) {
        setText(null);
        return setError('No he encontrado texto en la foto. Prueba con más luz, de frente y con el texto bien enfocado.');
      }
      setText(read);
    } catch {
      setError('No se pudo leer la foto. Inténtalo de nuevo con otra foto.');
    } finally {
      setBusy(false);
    }
  };

  const read = () => {
    if (!text) return;
    setPendingImport(parseDietText(text, day ? Number(day) : undefined));
    router.push({ pathname: '/diet-import', params: { photo: '1' } });
  };

  return (
    <Screen>
      <Text variant="title">Dieta desde una foto</Text>
      <Text muted>Haz una foto a tu dieta, de frente, con buena luz y sin cortar nada, o elige una que ya tengas. La leo en tu móvil: la foto no se guarda ni se envía a ningún sitio.</Text>
      <ErrorText>{error}</ErrorText>
      {!ocrSupported ? (
        <Card>
          <Text variant="label">Este dispositivo no puede leer fotos</Text>
          <Text muted>Usa la app en tu móvil Android o iPhone.</Text>
        </Card>
      ) : (
        <View style={{ gap: spacing.sm }}>
          <Button title="Hacer foto" onPress={() => void pick('camera')} loading={busy} disabled={busy} />
          <Button title="Elegir de la galería" variant="secondary" onPress={() => void pick('library')} disabled={busy} />
        </View>
      )}

      {text !== null ? (
        <>
          <Card>
            <Text variant="label">Revisa el texto</Text>
            <Text variant="caption" muted>
              Corrige lo que esté mal. Funciona mejor si cada día va en su línea («Lunes») y cada comida empieza por su nombre («Desayuno: avena 40 g, leche 200 ml»). Lo que
              quede suelto no se importa.
            </Text>
          </Card>
          <TextField label="Texto leído" value={text} onChangeText={setText} multiline textAlignVertical="top" style={{ minHeight: 220, flex: 1 }} autoCorrect={false} />
          <Text variant="label">Si la foto no dice el día</Text>
          <ChipSingle value={day} onChange={setDay} options={DAY_OPTIONS} />
          <Text variant="caption" muted>
            Solo se usa para lo que salga antes de cualquier título de día.
          </Text>
          <Button title="Interpretar la dieta" onPress={read} />
        </>
      ) : null}
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
