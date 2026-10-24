import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, ErrorText, Screen, Text, TextField } from '../src/components/ui';
import { createFood } from '../src/lib/diet';
import { parseDecimal } from '../src/lib/validation';
import { useAuth } from '../src/providers/AuthProvider';

const field = (text: string, max: number): number | null => {
  const v = parseDecimal(text);
  return v !== null && v <= max ? v : null;
};

export default function FoodCreate() {
  const router = useRouter();
  const { session } = useAuth();
  const { barcode } = useLocalSearchParams<{ barcode?: string }>();
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [kcal, setKcal] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  const [serving, setServing] = useState('100');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!session) return;
    const n = name.trim();
    if (!n || n.length > 120) return setError('Pon un nombre (máximo 120 caracteres).');
    const k = field(kcal, 1000);
    const p = field(protein, 100);
    const c = field(carbs, 100);
    const f = field(fat, 100);
    const s = field(serving, 5000);
    if (k === null) return setError('Calorías por 100 g: introduce un número entre 0 y 1000.');
    if (p === null || c === null || f === null) return setError('Proteína, carbohidratos y grasa por 100 g: números entre 0 y 100.');
    if (p + c + f > 100.5) return setError('Proteína + carbohidratos + grasa no pueden superar 100 g por cada 100 g de alimento.');
    if (s === null || s <= 0) return setError('La ración debe estar entre 1 y 5000 g.');
    setSaving(true);
    setError(null);
    try {
      await createFood(session.user.id, {
        source: 'custom',
        barcode: barcode && /^[0-9]{6,14}$/.test(barcode) ? barcode : null,
        name: n,
        brand: brand.trim(),
        serving_g: s,
        kcal_100g: k,
        protein_100g: p,
        carbs_100g: c,
        fat_100g: f,
        allergens: [],
      });
      router.back();
    } catch {
      setError('No se pudo guardar el alimento. ¿Ya existe uno con ese código de barras?');
      setSaving(false);
    }
  };

  return (
    <Screen>
      <Text variant="title">Nuevo alimento</Text>
      <Text muted>Introduce los valores por cada 100 g (los encontrarás en la etiqueta).</Text>
      <TextField label="Nombre" value={name} onChangeText={setName} maxLength={120} />
      <TextField label="Marca (opcional)" value={brand} onChangeText={setBrand} maxLength={120} />
      <TextField label="Calorías" suffix="kcal" keyboardType="decimal-pad" value={kcal} onChangeText={setKcal} />
      <TextField label="Proteína" suffix="g" keyboardType="decimal-pad" value={protein} onChangeText={setProtein} />
      <TextField label="Carbohidratos" suffix="g" keyboardType="decimal-pad" value={carbs} onChangeText={setCarbs} />
      <TextField label="Grasa" suffix="g" keyboardType="decimal-pad" value={fat} onChangeText={setFat} />
      <TextField label="Ración habitual" suffix="g" keyboardType="decimal-pad" value={serving} onChangeText={setServing} />
      {barcode ? <Text variant="caption" muted>Código de barras: {barcode}</Text> : null}
      <ErrorText>{error}</ErrorText>
      <Button title="Guardar alimento" onPress={save} loading={saving} />
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
