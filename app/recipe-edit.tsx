import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FoodPickerModal } from '../src/components/food-picker-modal';
import { MacroRow } from '../src/components/plan-summary';
import { Button, Card, ErrorText, LinkButton, Screen, Text, TextField } from '../src/components/ui';
import { confirm } from '../src/lib/confirm';
import { deleteRecipe, getRecipe, saveOffFood, saveRecipe, type Food } from '../src/lib/diet';
import { foodLabel, parsePositive } from '../src/lib/diet-entries';
import { recipePerServing } from '../src/lib/diet-math';
import { spacing } from '../src/theme';
import { useAuth } from '../src/providers/AuthProvider';

interface Row {
  key: string;
  food: Food;
  grams: string;
}

export default function RecipeEdit() {
  const router = useRouter();
  const { session } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const keys = useRef(0);

  const [loading, setLoading] = useState(!!id);
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [picker, setPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    getRecipe(id)
      .then((r) => {
        if (!r) return setError('No se encontró la receta.');
        setName(r.name);
        setServings(String(r.servings).replace('.', ','));
        setNotes(r.notes);
        setRows(r.recipe_items.filter((i) => i.foods).map((i) => ({ key: `r${++keys.current}`, food: i.foods!, grams: String(i.grams).replace('.', ',') })));
      })
      .catch(() => setError('No se pudo cargar la receta.'))
      .finally(() => setLoading(false));
  }, [id]);

  const servingsNum = parsePositive(servings, 100);
  const valid = rows.flatMap((r) => {
    const g = parsePositive(r.grams, 20000);
    return g ? [{ food: r.food, grams: g }] : [];
  });
  const per = servingsNum ? recipePerServing(valid, servingsNum) : null;

  const addIngredient = async (c: Parameters<React.ComponentProps<typeof FoodPickerModal>['onPick']>[0]) => {
    setPicker(false);
    try {
      const food = c.kind === 'food' ? c.food : await saveOffFood(session!.user.id, c.off);
      setRows((list) => [...list, { key: `r${++keys.current}`, food, grams: String(food.serving_g).replace('.', ',') }]);
    } catch {
      setError('No se pudo añadir el ingrediente. Comprueba tu conexión.');
    }
  };

  const save = async () => {
    const n = name.trim();
    if (!n) return setError('Pon un nombre a la receta.');
    if (!servingsNum) return setError('Las raciones deben ser un número entre 0 y 100.');
    if (!rows.length) return setError('Añade al menos un ingrediente.');
    if (valid.length !== rows.length) return setError('Revisa los gramos de cada ingrediente: deben ser mayores que 0.');
    setSaving(true);
    setError(null);
    try {
      await saveRecipe({
        id: id ?? null,
        name: n,
        servings: servingsNum,
        notes: notes.trim(),
        items: rows.map((r, position) => ({ food_id: r.food.id, grams: parsePositive(r.grams, 20000)!, position })),
      });
      router.back();
    } catch {
      setError('No se pudo guardar la receta. Comprueba tu conexión.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || !(await confirm('Eliminar receta', 'Las entradas ya registradas en tu diario se conservan.', 'Eliminar', true))) return;
    try {
      await deleteRecipe(id);
      router.back();
    } catch {
      setError('No se pudo eliminar la receta.');
    }
  };

  if (loading) {
    return (
      <Screen>
        <Text muted>Cargando…</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{id ? 'Editar receta' : 'Nueva receta'}</Text>
      <TextField label="Nombre" value={name} onChangeText={setName} maxLength={120} />
      <TextField label="Raciones que salen" keyboardType="decimal-pad" value={servings} onChangeText={setServings} />

      <Text variant="heading">Ingredientes</Text>
      {!rows.length ? <Text muted>Añade los ingredientes con su cantidad en gramos.</Text> : null}
      {rows.map((r) => (
        <Card key={r.key}>
          <Text variant="label">{foodLabel(r.food)}</Text>
          <TextField
            label="Gramos"
            suffix="g"
            keyboardType="decimal-pad"
            value={r.grams}
            onChangeText={(t) => setRows((list) => list.map((x) => (x.key === r.key ? { ...x, grams: t } : x)))}
          />
          <LinkButton title="Quitar" danger onPress={() => setRows((list) => list.filter((x) => x.key !== r.key))} />
        </Card>
      ))}
      <Button title="Añadir ingrediente" variant="secondary" onPress={() => setPicker(true)} />

      {per ? (
        <Card>
          <Text variant="caption" muted>
            Por ración ({String(servingsNum).replace('.', ',')} {servingsNum === 1 ? 'ración' : 'raciones'} en total)
          </Text>
          <Text variant="title">{Math.round(per.kcal)} kcal</Text>
          <MacroRow proteinG={Math.round(per.protein_g * 10) / 10} carbsG={Math.round(per.carbs_g * 10) / 10} fatG={Math.round(per.fat_g * 10) / 10} />
        </Card>
      ) : null}

      <TextField label="Notas (opcional)" value={notes} onChangeText={setNotes} multiline maxLength={2000} style={{ minHeight: 70, textAlignVertical: 'top' }} />
      <ErrorText>{error}</ErrorText>
      <Button title="Guardar receta" onPress={save} loading={saving} />
      {id ? <Button title="Eliminar receta" variant="danger" onPress={() => void remove()} /> : null}
      <Button title="Cancelar" variant="ghost" onPress={() => router.back()} />
      <View style={{ height: spacing.md }} />

      <FoodPickerModal visible={picker} onClose={() => setPicker(false)} onPick={(c) => void addIngredient(c)} title="Elegir ingrediente" />
    </Screen>
  );
}
