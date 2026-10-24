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

describe('parseOffProduct: formatos de Search-a-licious', () => {
  it('acepta nombre como objeto por idioma y marcas como lista', () => {
    const p = parseOffProduct({
      ...base,
      product_name: { main: 'Yogur natural', es: 'Yogur natural clásico' },
      brands: ['Danone', 'Otra'],
    });
    expect(p?.name).toBe('Yogur natural clásico');
    expect(p?.brand).toBe('Danone');
  });
  it('acepta nombre como lista y cae al primer idioma disponible', () => {
    expect(parseOffProduct({ ...base, product_name: ['', 'Leche'] })?.name).toBe('Leche');
    expect(parseOffProduct({ ...base, product_name: { fr: 'Lait' } })?.name).toBe('Lait');
  });
});

describe('searchOff', () => {
  const salHit = { ...base, code: '1234567890123', product_name: 'Yogur' };
  const reply = (status: number, body: unknown) => Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body } as Response);
  let n = 0;
  const q = () => `yogur ${++n}`; // la caché es por consulta

  afterEach(() => jest.restoreAllMocks());

  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const load = () => require('../openfoodfacts') as typeof import('../openfoodfacts');

  it('usa Search-a-licious (hits) como buscador principal', async () => {
    const f = jest.spyOn(globalThis, 'fetch').mockImplementation(() => reply(200, { hits: [salHit], count: 1 }));
    const r = await load().searchOff(q());
    expect(r).toHaveLength(1);
    expect(f.mock.calls).toHaveLength(1);
    expect(String(f.mock.calls[0][0])).toContain('search.openfoodfacts.org/search?q=');
  });

  it('si el principal da 503 prueba el antiguo', async () => {
    const f = jest
      .spyOn(globalThis, 'fetch')
      .mockImplementationOnce(() => reply(503, {}))
      .mockImplementationOnce(() => reply(200, { products: [salHit] }));
    const r = await load().searchOff(q());
    expect(r).toHaveLength(1);
    expect(String(f.mock.calls[1][0])).toContain('cgi/search.pl');
  });

  it('con 429 no insiste con el antiguo y avisa de límite', async () => {
    const f = jest.spyOn(globalThis, 'fetch').mockImplementation(() => reply(429, {}));
    await expect(load().searchOff(q())).rejects.toMatchObject({ kind: 'rate_limit' });
    expect(f.mock.calls).toHaveLength(1);
  });

  it('si fallan los dos devuelve error de servicio no disponible', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reply(503, {}));
    await expect(load().searchOff(q())).rejects.toMatchObject({ kind: 'unavailable' });
  });

  it('una respuesta sin hits se trata como error, no como "sin resultados"', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(() => reply(200, { algo: 'raro' }));
    await expect(load().searchOff(q())).rejects.toBeDefined();
  });

  it('descarta resultados sin datos nutricionales y cachea la consulta', async () => {
    const f = jest.spyOn(globalThis, 'fetch').mockImplementation(() => reply(200, { hits: [salHit, { code: '1', product_name: 'x', nutriments: {} }] }));
    const query = q();
    expect(await load().searchOff(query)).toHaveLength(1);
    expect(await load().searchOff(query)).toHaveLength(1);
    expect(f.mock.calls).toHaveLength(1);
  });

  it('consultas de menos de 2 letras no llaman a la red', async () => {
    const f = jest.spyOn(globalThis, 'fetch');
    expect(await load().searchOff('a')).toEqual([]);
    expect(f).not.toHaveBeenCalled();
  });
});
