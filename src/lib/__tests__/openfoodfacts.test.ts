import { parseOffProduct } from '../openfoodfacts';

const base = {
  code: '3017620422003',
  product_name: 'Nutella',
  brands: 'Ferrero,Otra',
  serving_quantity: '15',
  allergens_tags: ['en:milk', 'en:nuts', 'en:soybeans'],
  nutriments: { 'energy-kcal_100g': 539, proteins_100g: 6.3, carbohydrates_100g: 57.5, fat_100g: 30.9 },
};

describe('parseOffProduct', () => {
  it('convierte un producto completo', () => {
    expect(parseOffProduct(base)).toEqual({
      barcode: '3017620422003',
      name: 'Nutella',
      brand: 'Ferrero',
      serving_g: 15,
      kcal_100g: 539,
      protein_100g: 6.3,
      carbs_100g: 57.5,
      fat_100g: 30.9,
      allergens: ['milk', 'nuts', 'soybeans'],
    });
  });
  it('prefiere el nombre en español', () => {
    expect(parseOffProduct({ ...base, product_name_es: 'Crema de cacao' })?.name).toBe('Crema de cacao');
  });
  it('calcula kcal desde kJ si falta energy-kcal', () => {
    const p = parseOffProduct({ ...base, nutriments: { energy_100g: 2255, proteins_100g: 6, carbohydrates_100g: 57, fat_100g: 31 } });
    expect(p?.kcal_100g).toBeCloseTo(538.96, 2);
  });
  it('acepta números como texto con coma', () => {
    const p = parseOffProduct({ ...base, nutriments: { ...base.nutriments, proteins_100g: '6,3' } });
    expect(p?.protein_100g).toBe(6.3);
  });
  it('rellena con 0 los macros ausentes y con 100 g la ración', () => {
    const p = parseOffProduct({ product_name: 'Agua', nutriments: { 'energy-kcal_100g': 0 } });
    expect(p).toMatchObject({ kcal_100g: 0, protein_100g: 0, serving_g: 100, barcode: null, allergens: [] });
  });
  it('descarta productos sin nombre, sin calorías o con valores absurdos', () => {
    expect(parseOffProduct({ ...base, product_name: '' })).toBeNull();
    expect(parseOffProduct({ ...base, nutriments: { proteins_100g: 5 } })).toBeNull();
    expect(parseOffProduct({ ...base, nutriments: { ...base.nutriments, proteins_100g: 150 } })).toBeNull();
    expect(parseOffProduct({ ...base, nutriments: { ...base.nutriments, 'energy-kcal_100g': 4000 } })).toBeNull();
    expect(parseOffProduct(null)).toBeNull();
    expect(parseOffProduct('x')).toBeNull();
  });
  it('ignora códigos de barras no numéricos', () => {
    expect(parseOffProduct({ ...base, code: 'abc' })?.barcode).toBeNull();
  });
});
