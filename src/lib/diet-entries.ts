import type { EntryDraft, Food, Recipe } from './diet';
import { macrosForGrams, recipePerServing, scaleMacros, type Macros, type Meal } from './diet-math';

/** Entrada del diario para `grams` gramos de un alimento. */
export function foodDraft(meal: Meal, food: Pick<Food, 'id' | 'name' | 'kcal_100g' | 'protein_100g' | 'carbs_100g' | 'fat_100g'>, grams: number): EntryDraft {
  return {
    meal,
    food_id: food.id,
    recipe_id: null,
    name: food.name,
    quantity_g: grams,
    servings: null,
    ...macrosForGrams(food, grams),
  };
}

/** Macros de una ración de la receta (ignora ingredientes cuyo alimento ya no existe). */
export function recipeServingMacros(recipe: Recipe): Macros {
  const items = recipe.recipe_items.filter((i) => i.foods).map((i) => ({ food: i.foods!, grams: i.grams }));
  return recipePerServing(items, recipe.servings);
}

/** Entrada del diario para `servings` raciones de una receta. */
export function recipeDraft(meal: Meal, recipe: Recipe, servings: number): EntryDraft {
  return {
    meal,
    food_id: null,
    recipe_id: recipe.id,
    name: recipe.name,
    quantity_g: null,
    servings,
    ...scaleMacros(recipeServingMacros(recipe), servings),
  };
}

/** "Yogur natural (Danone)" */
export function foodLabel(f: { name: string; brand?: string | null }): string {
  return f.brand ? `${f.name} (${f.brand})` : f.name;
}

/** Interpreta "2", "2,5" o "2.5"; null si no es un número positivo válido. */
export function parsePositive(text: string, max: number): number | null {
  const t = text.trim().replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const v = Number(t);
  return v > 0 && v <= max ? v : null;
}
