import type { Recipe } from '../diet';
import { foodDraft, foodLabel, parsePositive, recipeDraft, recipeServingMacros } from '../diet-entries';

const food = (id: string, kcal: number, p: number, c: number, f: number) => ({
  id, user_id: 'u', source: 'custom' as const, barcode: null, name: id, brand: '', serving_g: 100, allergens: [],
  kcal_100g: kcal, protein_100g: p, carbs_100g: c, fat_100g: f,
});

const recipe: Recipe = {
  id: 'r1', name: 'Arroz con pollo', servings: 2, notes: '',
  recipe_items: [
    { id: 'i1', food_id: 'arroz', grams: 200, position: 0, foods: food('arroz', 130, 2.7, 28, 0.3) },
    { id: 'i2', food_id: 'pollo', grams: 300, position: 1, foods: food('pollo', 165, 31, 0, 3.6) },
    { id: 'i3', food_id: 'borrado', grams: 50, position: 2, foods: null },
  ],
};

describe('foodDraft', () => {
  it('copia nombre y macros del momento', () => {
    const d = foodDraft('comida', food('arroz', 130, 2.7, 28, 0.3), 150);
    expect(d).toMatchObject({ meal: 'comida', food_id: 'arroz', recipe_id: null, quantity_g: 150, servings: null, kcal: 195, protein_g: 4.05, carbs_g: 42, fat_g: 0.45 });
  });
});

describe('recetas', () => {
  it('macros por ración: total / raciones, ignorando ingredientes borrados', () => {
    // arroz 200 g: 260 kcal; pollo 300 g: 495 kcal; total 755 → 377,5 por ración
    expect(recipeServingMacros(recipe).kcal).toBe(377.5);
  });
  it('recipeDraft escala por raciones', () => {
    const d = recipeDraft('cena', recipe, 1.5);
    expect(d).toMatchObject({ recipe_id: 'r1', food_id: null, servings: 1.5, quantity_g: null, kcal: 566.25 });
  });
});

describe('utilidades', () => {
  it('foodLabel', () => {
    expect(foodLabel({ name: 'Yogur', brand: 'Danone' })).toBe('Yogur (Danone)');
    expect(foodLabel({ name: 'Arroz', brand: '' })).toBe('Arroz');
  });
  it('parsePositive', () => {
    expect(parsePositive('2,5', 10)).toBe(2.5);
    expect(parsePositive('0', 10)).toBeNull();
    expect(parsePositive('11', 10)).toBeNull();
    expect(parsePositive('abc', 10)).toBeNull();
    expect(parsePositive('-3', 10)).toBeNull();
  });
});
