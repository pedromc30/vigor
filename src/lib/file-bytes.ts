import { File } from 'expo-file-system';
import { Platform } from 'react-native';

/** Lee los bytes de un archivo elegido con el selector (en web viene como objeto `File` del navegador). */
export async function readPickedBytes(asset: { uri: string; file?: unknown }): Promise<Uint8Array> {
  if (Platform.OS === 'web') {
    const webFile = asset.file as Blob | undefined;
    const buf = webFile ? await webFile.arrayBuffer() : await (await fetch(asset.uri)).arrayBuffer();
    return new Uint8Array(buf);
  }
  return new Uint8Array(await new File(asset.uri).arrayBuffer());
}
