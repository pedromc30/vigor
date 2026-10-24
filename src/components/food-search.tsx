import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../providers/AuthProvider';
import { deleteFood, listFoods, type Food } from '../lib/diet';
import { foodLabel } from '../lib/diet-entries';
import { OffError, getOffByBarcode, searchOff, type OffFood } from '../lib/openfoodfacts';
import { spacing } from '../theme';
import { BarcodeScanner } from './barcode-scanner';
import { Button, Card, ChipSingle, ErrorText, LinkButton, Text, TextField } from './ui';

export type FoodChoice = { kind: 'food'; food: Food } | { kind: 'off'; off: OffFood };

const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const offMessage = (e: unknown) => {
  const kind = e instanceof OffError ? e.kind : 'server';
  if (kind === 'rate_limit') return 'Open Food Facts limita las consultas. Espera un minuto e inténtalo de nuevo.';
  if (kind === 'network') return 'Sin conexión con Open Food Facts. Comprueba tu red.';
  return 'Open Food Facts no responde ahora mismo (su buscador por texto falla a veces). Prueba con el código de barras, inténtalo más tarde o crea el alimento tú.';
};

/**
 * Buscador de alimentos: los propios (creados o ya guardados) y Open Food Facts, por texto o código de barras.
 * `reloadKey` fuerza recargar «Mis alimentos» (p. ej. al volver de crear uno).
 */
export function FoodSearch({
  onSelect,
  allowCreate = true,
  reloadKey = 0,
}: {
  onSelect: (c: FoodChoice) => void;
  allowCreate?: boolean;
  reloadKey?: number;
}) {
  const router = useRouter();
  useAuth();
  const [source, setSource] = useState<'mine' | 'off'>('mine');
  const [foods, setFoods] = useState<Food[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const [offQuery, setOffQuery] = useState('');
  const [offResults, setOffResults] = useState<OffFood[] | null>(null);
  const [offBusy, setOffBusy] = useState(false);
  const [offError, setOffError] = useState<string | null>(null);
  const [barcode, setBarcode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [notFound, setNotFound] = useState<string | null>(null);

  useEffect(() => {
    listFoods()
      .then(setFoods)
      .catch(() => setError('No se pudieron cargar tus alimentos. Comprueba tu conexión.'))
      .finally(() => setLoading(false));
  }, [reloadKey]);

  const shown = useMemo(() => {
    const q = normalize(query.trim());
    return foods.filter((f) => !q || normalize(`${f.name} ${f.brand}`).includes(q));
  }, [foods, query]);

  const runSearch = async () => {
    setOffBusy(true);
    setOffError(null);
    setNotFound(null);
    try {
      setOffResults(await searchOff(offQuery));
    } catch (e) {
      setOffError(offMessage(e));
    } finally {
      setOffBusy(false);
    }
  };

  const lookupBarcode = async (code: string) => {
    setOffBusy(true);
    setOffError(null);
    setNotFound(null);
    try {
      const found = await getOffByBarcode(code);
      if (found) onSelect({ kind: 'off', off: found });
      else setNotFound(code.trim());
    } catch (e) {
      setOffError(offMessage(e));
    } finally {
      setOffBusy(false);
    }
  };

  const remove = async (f: Food) => {
    try {
      await deleteFood(f.id);
      setFoods((list) => list.filter((x) => x.id !== f.id));
    } catch {
      setError('No se puede borrar: el alimento forma parte de una receta.');
    }
  };

  return (
    <View style={{ gap: spacing.md }}>
      <ChipSingle
        value={source}
        onChange={(v) => setSource(v ?? 'mine')}
        options={[
          { key: 'mine', label: 'Mis alimentos' },
          { key: 'off', label: 'Open Food Facts' },
        ]}
      />

      {source === 'mine' ? (
        <>
          <TextField label="Buscar en mis alimentos" value={query} onChangeText={setQuery} placeholder="Nombre o marca" />
          {allowCreate ? <Button title="Crear alimento" variant="secondary" onPress={() => router.push('/food-create')} /> : null}
          <ErrorText>{error}</ErrorText>
          {loading ? <Text muted>Cargando…</Text> : null}
          {!loading && !foods.length ? (
            <Text muted>Aún no tienes alimentos. Crea uno o búscalo en Open Food Facts: se guardará aquí al añadirlo.</Text>
          ) : null}
          {!loading && foods.length > 0 && !shown.length ? <Text muted>Ningún alimento coincide.</Text> : null}
          {shown.map((f) => (
            <Card key={f.id}>
              <Pressable accessibilityRole="button" onPress={() => onSelect({ kind: 'food', food: f })}>
                <Text variant="label">{foodLabel(f)}</Text>
                <Text variant="caption" muted>
                  {Math.round(f.kcal_100g)} kcal · P {f.protein_100g} · C {f.carbs_100g} · G {f.fat_100g} (por 100 g)
                </Text>
              </Pressable>
              <LinkButton title="Eliminar" danger onPress={() => void remove(f)} />
            </Card>
          ))}
        </>
      ) : (
        <>
          <TextField
            label="Buscar producto"
            value={offQuery}
            onChangeText={setOffQuery}
            placeholder="Ej. yogur natural"
            returnKeyType="search"
            onSubmitEditing={() => void runSearch()}
          />
          <Button title="Buscar" onPress={() => void runSearch()} loading={offBusy} disabled={offQuery.trim().length < 2} />

          <TextField
            label="Código de barras"
            value={barcode}
            onChangeText={(t) => setBarcode(t.replace(/\D/g, ''))}
            keyboardType="number-pad"
            maxLength={14}
            placeholder="8410000000000"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Button title="Buscar código" variant="secondary" onPress={() => void lookupBarcode(barcode)} disabled={barcode.length < 6 || offBusy} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title="Escanear" variant="secondary" onPress={() => setScanning(true)} disabled={offBusy} />
            </View>
          </View>

          <ErrorText>{offError}</ErrorText>
          {notFound ? (
            <Card>
              <Text variant="label">Producto no encontrado</Text>
              <Text variant="caption" muted>
                El código {notFound} no está en Open Food Facts o no tiene datos nutricionales. Puedes crearlo tú.
              </Text>
              {allowCreate ? (
                <Button title="Crear con este código" variant="secondary" onPress={() => router.push({ pathname: '/food-create', params: { barcode: notFound } })} />
              ) : null}
            </Card>
          ) : null}

          {offResults && !offResults.length && !offBusy ? <Text muted>Sin resultados con datos nutricionales completos.</Text> : null}
          {offResults?.map((o, i) => (
            <Card key={`${o.barcode ?? 'x'}-${i}`}>
              <Pressable accessibilityRole="button" onPress={() => onSelect({ kind: 'off', off: o })}>
                <Text variant="label">{foodLabel(o)}</Text>
                <Text variant="caption" muted>
                  {Math.round(o.kcal_100g)} kcal · P {o.protein_100g} · C {o.carbs_100g} · G {o.fat_100g} (por 100 g)
                </Text>
              </Pressable>
            </Card>
          ))}
          <Text variant="caption" muted>
            Datos de Open Food Facts (comunidad, licencia ODbL). Pueden contener errores: revisa las etiquetas.
          </Text>
        </>
      )}

      <BarcodeScanner
        visible={scanning}
        onClose={() => setScanning(false)}
        onScan={(code) => {
          setScanning(false);
          setBarcode(code);
          void lookupBarcode(code);
        }}
      />
    </View>
  );
}
