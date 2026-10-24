import {
  addDays,
  allergenMatches,
  buildShoppingList,
  dayLabel,
  formatGrams,
  isoWeekday,
  macrosForGrams,
  progress,
  recipePerServing,
  recipeTotals,
  rescaleEntry,
  sumMacros,
  toISODate,
} from '../diet-math';

const arroz = { kcal_100g: 130, protein_100g: 2.7, carbs_100g: 28, fat_100g: 0.3 };
const aceite = { kcal_100g: 884, protein_100g: 0, carbs_100g: 0, fat_100g: 100 };

describe('macrosForGrams', () => {
  it('escala por 100 g', () => {
    expect(macrosForGrams(arroz, 200)).toEqual({ kcal: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6 });
    expect(macrosForGrams(arroz, 0)).toEqual({ kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
  });
});

describe('recetas', () => {
  const items = [
    { food: arroz, grams: 200 },
    { food: aceite, grams: 10 },
  ];
  it('suma los ingredientes', () => {
    expect(recipeTotals(items)).toEqual({ kcal: 348.4, protein_g: 5.4, carbs_g: 56, fat_g: 10.6 });
  });
  it('divide entre las raciones', () => {
    expect(recipePerServing(items, 2)).toEqual({ kcal: 174.2, protein_g: 2.7, carbs_g: 28, fat_g: 5.3 });
  });
  it('raciones no válidas dan cero', () => {
    expect(recipePerServing(items, 0).kcal).toBe(0);
  });
});

describe('sumMacros / progress', () => {
  it('suma', () => {
    expect(sumMacros([macrosForGrams(arroz, 100), macrosForGrams(aceite, 10)]).kcal).toBe(218.4);
  });
  it('progress se limita a [0, 1] y tolera objetivo vacío', () => {
    expect(progress(500, 2000)).toBe(0.25);
    expect(progress(3000, 2000)).toBe(1);
    expect(progress(10, null)).toBe(0);
    expect(progress(10, 0)).toBe(0);
  });
});

describe('rescaleEntry', () => {
  const entry = { kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, quantity_g: 100, servings: null };
  it('reescala proporcionalmente los gramos', () => {
    const e = rescaleEntry(entry, 250);
    expect(e.quantity_g).toBe(250);
    expect(e.kcal).toBe(325);
    expect(e.carbs_g).toBe(70);
  });
  it('reescala raciones', () => {
    const e = rescaleEntry({ ...entry, quantity_g: null, servings: 1 }, 2);
    expect(e.servings).toBe(2);
    expect(e.kcal).toBe(260);
  });
  it('ignora cantidades no válidas', () => {
    expect(rescaleEntry(entry, 0)).toBe(entry);
  });
});

describe('fechas', () => {
  it('toISODate usa la hora local', () => {
    expect(toISODate(new Date(2026, 9, 24, 23, 59))).toBe('2026-10-24');
  });
  it('addDays cruza meses y años', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });
  it('isoWeekday: lunes = 1, domingo = 7', () => {
    expect(isoWeekday('2026-10-19')).toBe(1);
    expect(isoWeekday('2026-10-25')).toBe(7);
  });
  it('dayLabel', () => {
    expect(dayLabel('2026-10-24', '2026-10-24')).toBe('Hoy');
    expect(dayLabel('2026-10-23', '2026-10-24')).toBe('Ayer');
    expect(dayLabel('2026-10-25', '2026-10-24')).toBe('Mañana');
  });
});

describe('allergenMatches', () => {
  it('cruza alergias del perfil con etiquetas de OFF', () => {
    expect(allergenMatches(['gluten', 'huevo'], ['en:gluten', 'en:milk'])).toEqual(['gluten']);
    expect(allergenMatches(['lactosa', 'lacteos'], ['milk'])).toEqual(['lactosa', 'lacteos']);
  });
  it('ignora texto libre y alimentos sin alérgenos', () => {
    expect(allergenMatches(['kiwi'], ['en:gluten'])).toEqual([]);
    expect(allergenMatches(['gluten'], [])).toEqual([]);
  });
});

describe('buildShoppingList', () => {
  const recipes = {
    r1: {
      servings: 2,
      items: [
        { food_id: 'arroz', name: 'Arroz', grams: 200 },
        { food_id: 'pollo', name: 'Pollo', grams: 300 },
      ],
    },
  };
  it('suma alimentos y descompone recetas según las raciones', () => {
    const list = buildShoppingList(
      [
        { food_id: 'arroz', recipe_id: null, name: 'Arroz', quantity_g: 100, servings: null },
        { food_id: null, recipe_id: 'r1', name: 'Receta', quantity_g: null, servings: 1 },
        { food_id: null, recipe_id: 'r1', name: 'Receta', quantity_g: null, servings: 2 },
        { food_id: 'leche', recipe_id: null, name: 'Leche', quantity_g: 250, servings: null },
      ],
      recipes,
    );
    expect(list).toEqual([
      { key: 'food:arroz', name: 'Arroz', grams: 400 }, // 100 + 100 (1/2 de 200) + 200
      { key: 'food:leche', name: 'Leche', grams: 250 },
      { key: 'food:pollo', name: 'Pollo', grams: 450 }, // 150 + 300
    ]);
  });
  it('omite entradas cuyo alimento o receta ya no existe', () => {
    expect(buildShoppingList([{ food_id: null, recipe_id: null, name: 'x', quantity_g: 100, servings: null }], {})).toEqual([]);
  });
});

describe('formatGrams', () => {
  it('g y kg', () => {
    expect(formatGrams(250)).toBe('250 g');
    expect(formatGrams(1500)).toBe('1,5 kg');
  });
});
