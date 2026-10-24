import { useState } from 'react';
import { Pressable, Share, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorText, Screen, Text } from '../src/components/ui';
import { getRecipesByIds, listPlan } from '../src/lib/diet';
import { buildShoppingList, formatGrams } from '../src/lib/diet-math';
import { useFocusData } from '../src/lib/use-focus-data';
import { spacing, useTheme } from '../src/theme';

export default function Shopping() {
  const router = useRouter();
  const { colors } = useTheme();
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const { data, error, loading } = useFocusData(async () => {
    const plan = await listPlan();
    const recipeIds = [...new Set(plan.map((p) => p.recipe_id).filter(Boolean))] as string[];
    const recipes = await getRecipesByIds(recipeIds);
    const map = Object.fromEntries(
      recipes.map((r) => [
        r.id,
        {
          servings: r.servings,
          items: r.recipe_items.filter((i) => i.foods).map((i) => ({ food_id: i.food_id, name: i.foods!.name, grams: i.grams })),
        },
      ]),
    );
    return { list: buildShoppingList(plan, map), planned: plan.length };
  });

  const toggle = (key: string) =>
    setChecked((s) => {
      const next = new Set(s);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const share = async () => {
    if (!data) return;
    const text = ['Lista de la compra (Vigor)', ...data.list.map((i) => `- ${i.name}: ${formatGrams(i.grams)}`)].join('\n');
    try {
      await Share.share({ message: text });
    } catch {
      // El usuario canceló o la plataforma no soporta compartir.
    }
  };

  return (
    <Screen>
      <Text variant="title">Lista de la compra</Text>
      <Text muted>Suma de todo lo que has planificado para la semana. Las recetas se descomponen en ingredientes.</Text>
      <ErrorText>{error}</ErrorText>
      {loading ? <Text muted>Cargando…</Text> : null}
      {data && !data.planned ? <Text muted>Aún no has planificado ninguna comida. Añade alimentos o recetas en el planificador.</Text> : null}
      {data && data.planned > 0 && !data.list.length ? (
        <Text muted>Lo planificado no tiene alimentos que se puedan comprar (por ejemplo, porque se borraron).</Text>
      ) : null}

      {data?.list.length ? (
        <Card>
          {data.list.map((i) => {
            const on = checked.has(i.key);
            return (
              <Pressable
                key={i.key}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => toggle(i.key)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}
              >
                <Ionicons name={on ? 'checkbox' : 'square-outline'} size={24} color={on ? colors.primary : colors.textMuted} />
                <View style={{ flex: 1 }}>
                  <Text style={{ textDecorationLine: on ? 'line-through' : 'none', opacity: on ? 0.5 : 1 }}>{i.name}</Text>
                </View>
                <Text muted>{formatGrams(i.grams)}</Text>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      {data?.list.length ? <Button title="Compartir lista" variant="secondary" onPress={() => void share()} /> : null}
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
