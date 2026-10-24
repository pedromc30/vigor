import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { FoodSearch, type FoodChoice } from '../src/components/food-search';
import { QuantitySheet } from '../src/components/quantity-sheet';
import { Button, Card, ChipSingle, ErrorText, LinkButton, Screen, Text } from '../src/components/ui';
import {
  addLogs,
  addPlanEntries,
  deleteFavorite,
  listFavorites,
  listRecipes,
  saveOffFood,
  type Recipe,
} from '../src/lib/diet';
import { foodDraft, foodLabel, recipeDraft, recipeServingMacros } from '../src/lib/diet-entries';
import {
  MEALS,
  MEAL_LABELS,
  allergenMatches,
  dayLabel,
  macrosForGrams,
  scaleMacros,
  sumMacros,
  toISODate,
  type Meal,
} from '../src/lib/diet-math';
import { ALLERGEN_OPTIONS, WEEKDAY_LONG } from '../src/lib/labels';
import { useFocusData } from '../src/lib/use-focus-data';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing } from '../src/theme';

type Selected = FoodChoice | { kind: 'recipe'; recipe: Recipe };

export default function FoodAdd() {
  const router = useRouter();
  const { session, profile } = useAuth();
  const params = useLocalSearchParams<{ target?: string; meal?: string; date?: string; weekday?: string }>();
  const meal: Meal = (MEALS as readonly string[]).includes(params.meal ?? '') ? (params.meal as Meal) : 'snacks';
  const isPlan = params.target === 'plan';
  const today = toISODate(new Date());
  const date = params.date ?? today;
  const weekday = Number(params.weekday ?? 1);

  const [tab, setTab] = useState<'foods' | 'recipes' | 'favorites'>('foods');
  const [selected, setSelected] = useState<Selected | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data, error: loadError, reload } = useFocusData(async () => ({
    recipes: await listRecipes(),
    favorites: await listFavorites(),
  }));
  useFocusEffect(useCallback(() => setReloadKey((k) => k + 1), []));

  const where = isPlan ? `${WEEKDAY_LONG[weekday] ?? ''}` : dayLabel(date, today).toLowerCase();

  const save = async (drafts: ReturnType<typeof foodDraft>[]) => {
    if (!session) return;
    if (isPlan) await addPlanEntries(session.user.id, weekday, drafts);
    else await addLogs(session.user.id, date, drafts);
  };

  const confirmSelected = async (qty: number) => {
    if (!selected) return;
    if (selected.kind === 'recipe') await save([recipeDraft(meal, selected.recipe, qty)]);
    else {
      const food = selected.kind === 'food' ? selected.food : await saveOffFood(session!.user.id, selected.off);
      await save([foodDraft(meal, food, qty)]);
    }
    setSelected(null);
    router.back();
  };

  const sheet = (() => {
    if (!selected) return null;
    if (selected.kind === 'recipe') {
      const per = recipeServingMacros(selected.recipe);
      return {
        title: selected.recipe.name,
        subtitle: `${Math.round(per.kcal)} kcal por ración · la receta da ${selected.recipe.servings} ración(es)`,
        unit: 'raciones' as const,
        initial: 1,
        presets: [{ label: '1 ración', value: 1 }, { label: '½ ración', value: 0.5 }],
        macrosFor: (q: number) => scaleMacros(per, q),
        warnings: [] as string[],
      };
    }
    const f = selected.kind === 'food' ? selected.food : selected.off;
    const hits = allergenMatches(profile?.allergies ?? [], f.allergens).map(
      (k) => `Contiene ${ALLERGEN_OPTIONS.find((o) => o.key === k)?.label ?? k}, que marcaste en tu perfil.`,
    );
    const presets = [{ label: `1 ración (${f.serving_g} g)`, value: f.serving_g }];
    if (f.serving_g !== 100) presets.push({ label: '100 g', value: 100 });
    return {
      title: foodLabel(f),
      subtitle: `${Math.round(f.kcal_100g)} kcal · P ${f.protein_100g} · C ${f.carbs_100g} · G ${f.fat_100g} por 100 g`,
      unit: 'g' as const,
      initial: f.serving_g,
      presets,
      macrosFor: (q: number) => macrosForGrams(f, q),
      warnings: hits,
    };
  })();

  const addFavorite = async (fav: NonNullable<typeof data>['favorites'][number]) => {
    setError(null);
    try {
      await save(fav.items.map((i) => ({ ...i, meal })));
      router.back();
    } catch {
      setError('No se pudo añadir la comida favorita. Comprueba tu conexión.');
    }
  };

  const removeFavorite = async (id: string) => {
    try {
      await deleteFavorite(id);
      await reload();
    } catch {
      setError('No se pudo eliminar la favorita.');
    }
  };

  return (
    <Screen>
      <View>
        <Text variant="title">Añadir a {MEAL_LABELS[meal].toLowerCase()}</Text>
        <Text muted>{isPlan ? `Planificador · ${where}` : where}</Text>
      </View>
      <ChipSingle
        value={tab}
        onChange={(v) => setTab(v ?? 'foods')}
        options={[
          { key: 'foods', label: 'Alimentos' },
          { key: 'recipes', label: 'Recetas' },
          { key: 'favorites', label: 'Favoritas' },
        ]}
      />
      <ErrorText>{error ?? loadError}</ErrorText>

      {tab === 'foods' ? <FoodSearch reloadKey={reloadKey} onSelect={(c) => setSelected(c)} /> : null}

      {tab === 'recipes' ? (
        <View style={{ gap: spacing.md }}>
          <Button title="Nueva receta" variant="secondary" onPress={() => router.push('/recipe-edit')} />
          {data && !data.recipes.length ? <Text muted>Todavía no tienes recetas.</Text> : null}
          {data?.recipes.map((r) => {
            const per = recipeServingMacros(r);
            return (
              <Card key={r.id}>
                <Pressable accessibilityRole="button" onPress={() => setSelected({ kind: 'recipe', recipe: r })}>
                  <Text variant="label">{r.name}</Text>
                  <Text variant="caption" muted>
                    {Math.round(per.kcal)} kcal por ración · P {Math.round(per.protein_g)} · C {Math.round(per.carbs_g)} · G{' '}
                    {Math.round(per.fat_g)}
                  </Text>
                </Pressable>
                <LinkButton title="Editar receta" onPress={() => router.push({ pathname: '/recipe-edit', params: { id: r.id } })} />
              </Card>
            );
          })}
        </View>
      ) : null}

      {tab === 'favorites' ? (
        <View style={{ gap: spacing.md }}>
          {data && !data.favorites.length ? (
            <Text muted>Aún no tienes comidas favoritas. Guarda una desde el diario con «Guardar como favorita».</Text>
          ) : null}
          {data?.favorites.map((f) => {
            const total = sumMacros(f.items);
            return (
              <Card key={f.id}>
                <Text variant="label">{f.name}</Text>
                <Text variant="caption" muted>
                  {f.items.length} alimento(s) · {Math.round(total.kcal)} kcal
                </Text>
                {f.items.map((i, idx) => (
                  <Text key={idx} variant="caption">
                    · {i.name}
                  </Text>
                ))}
                <Button title={`Añadir a ${MEAL_LABELS[meal].toLowerCase()}`} onPress={() => void addFavorite(f)} />
                <LinkButton title="Eliminar favorita" danger onPress={() => void removeFavorite(f.id)} />
              </Card>
            );
          })}
        </View>
      ) : null}

      <Button title="Volver" variant="ghost" onPress={() => router.back()} />

      {sheet ? (
        <QuantitySheet
          visible
          title={sheet.title}
          subtitle={sheet.subtitle}
          unit={sheet.unit}
          initial={sheet.initial}
          presets={sheet.presets}
          macrosFor={sheet.macrosFor}
          warnings={sheet.warnings}
          confirmLabel={isPlan ? 'Añadir al plan' : 'Añadir al diario'}
          onConfirm={confirmSelected}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </Screen>
  );
}
