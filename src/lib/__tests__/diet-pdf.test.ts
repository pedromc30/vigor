import { makePdf, type PdfItem } from '../__fixtures__/pdf';
import { dayTargetsFromTotals, parseDietPdf, parseMacros, parseTotals } from '../diet-pdf';
import { readPdfLines } from '../pdf-text';
import { SpreadsheetError } from '../spreadsheet';

// Una dieta con el formato del PDF real: título por día, línea de total y tabla «Comida | Qué comer» con celdas de dos líneas.
const page1: PdfItem[] = [
  { x: 46, y: 800, text: 'Menú semanal' },
  { x: 46, y: 760, text: 'Lunes · trabajo + entreno' },
  { x: 46, y: 740, text: 'Total: ~2.800 kcal · 200 g proteína · 350 g hidratos · 60 g grasa' },
  { x: 54, y: 710, text: 'Comida' },
  { x: 147, y: 710, text: 'Qué comer' },
  { x: 54, y: 690, text: 'Desayuno' },
  { x: 147, y: 690, text: 'Gachas: 70 g de avena en 250 ml de leche + 30 g de' },
  { x: 147, y: 676, text: 'proteína whey + 1 plátano' },
  { x: 54, y: 650, text: 'Media mañana' },
  { x: 147, y: 650, text: 'Bocadillo de 65 g de pan con 80 g de pavo · 1 naranja' },
  { x: 54, y: 620, text: 'Comida' },
  { x: 147, y: 620, text: '100 g de arroz + 220 g de pechuga de pollo' },
];
const page2: PdfItem[] = [
  { x: 46, y: 800, text: 'Menú semanal' },
  { x: 54, y: 760, text: 'Comida' },
  { x: 147, y: 760, text: 'Qué comer' },
  { x: 54, y: 740, text: 'Cena' },
  { x: 147, y: 740, text: '400 g de patata + 250 g de merluza' },
  { x: 46, y: 700, text: 'Domingo · libre' },
  { x: 46, y: 680, text: 'Total: ~2.400 kcal · 190 g proteína · 240 g hidratos · 64 g grasa' },
  { x: 54, y: 650, text: 'Desayuno' },
  { x: 147, y: 650, text: '50 g de avena + 10 g de nueces' },
  { x: 46, y: 600, text: 'Tabla de equivalencias' },
  { x: 54, y: 580, text: 'Comida' },
  { x: 147, y: 580, text: 'esto no es una comida del domingo' },
];

describe('readPdfLines', () => {
  it('lee el texto por páginas, de arriba abajo y por celdas', () => {
    const pages = readPdfLines(makePdf([page1, page2]));
    expect(pages).toHaveLength(2);
    expect(pages[0][0]).toEqual([{ x: 46, text: 'Menú semanal' }]);
    expect(pages[0][3]).toEqual([{ x: 54, text: 'Comida' }, { x: 147, text: 'Qué comer' }]);
  });
  it('lee también los flujos comprimidos', () => {
    const pages = readPdfLines(makePdf([page1], { compress: true }));
    expect(pages[0][1][0].text).toBe('Lunes · trabajo + entreno');
  });
  it('rechaza lo que no es un PDF o no tiene texto', () => {
    expect(() => readPdfLines(new TextEncoder().encode('hola'))).toThrow('No es un PDF');
    expect(() => readPdfLines(makePdf([[]]))).toThrow('No se ha encontrado texto');
  });
});

describe('parseTotals / averageTargets', () => {
  it('lee las cifras del total de un día', () => {
    expect(parseTotals('Total: ~2.860 kcal · 217 g proteína · 358 g hidratos · 57 g grasa')).toEqual({ kcal: 2860, protein_g: 217, carbs_g: 358, fat_g: 57 });
    expect(parseTotals('Lunes · libre')).toBeNull();
  });
  it('un objetivo por día: solo cuentan los días con las cuatro cifras', () => {
    const r = dayTargetsFromTotals(new Map([[1, { kcal: 2800, protein_g: 200, carbs_g: 350, fat_g: 60 }], [2, { kcal: 2400 }], [7, { kcal: 2400, protein_g: 190, carbs_g: 240, fat_g: 64 }]]));
    expect(r).toEqual({ '1': { kcal: 2800, protein_g: 200, carbs_g: 350, fat_g: 60 }, '7': { kcal: 2400, protein_g: 190, carbs_g: 240, fat_g: 64 } });
    expect(dayTargetsFromTotals(new Map())).toBeNull();
  });
});

describe('parseDietPdf', () => {
  const r = parseDietPdf(makePdf([page1, page2]));
  it('coloca los alimentos por día y comida (también al cambiar de página), con la cantidad de cada uno', () => {
    expect(r.layout).toBe('pdf');
    const lunes = r.entries.filter((e) => e.weekday === 1);
    expect(lunes.map((e) => [e.meal, e.name, e.quantity_g ?? e.servings])).toEqual([
      ['desayuno', 'Gachas: avena en 250 ml de leche', 70],
      ['desayuno', 'proteína whey', 30],
      ['desayuno', '1 plátano', 1],
      ['snacks', 'Bocadillo de pan con 80 g de pavo', 65],
      ['snacks', '1 naranja', 1],
      ['comida', 'arroz', 100],
      ['comida', 'pechuga de pollo', 220],
      ['cena', 'patata', 400],
      ['cena', 'merluza', 250],
    ]);
  });
  it('sigue el día al cambiar de página y no mezcla la tabla de equivalencias', () => {
    expect(r.entries.filter((e) => e.weekday === 7).map((e) => e.name)).toEqual(['avena', 'nueces']);
    expect(r.entries.some((e) => /equivalencias|no es una comida/.test(e.name))).toBe(false);
  });
  it('trae el objetivo de cada día y deja la media como objetivo general', () => {
    expect(r.dayTargets).toEqual({ '1': { kcal: 2800, protein_g: 200, carbs_g: 350, fat_g: 60 }, '7': { kcal: 2400, protein_g: 190, carbs_g: 240, fat_g: 64 } });
    expect(r.targets).toEqual({ kcal: 2600, protein_g: 195, carbs_g: 295, fat_g: 62 });
    expect(r.notes.some((n) => /objetivo de cada día/.test(n))).toBe(true);
    expect(r.notes.some((n) => /sin calorías/.test(n))).toBe(true);
  });
  it('un PDF que no es una dieta no da alimentos y un archivo roto da un error legible', () => {
    expect(parseDietPdf(makePdf([[{ x: 50, y: 700, text: 'Factura 123' }]])).entries).toEqual([]);
    expect(() => parseDietPdf(new Uint8Array([1, 2, 3]))).toThrow(SpreadsheetError);
  });
});

describe('parseDietPdf: tabla con calorías y macros por comida', () => {
  const t = (x: number, y: number, text: string): PdfItem => ({ x, y, text });
  const page: PdfItem[] = [
    t(46, 780, 'Lunes · trabajo + entreno'),
    t(46, 762, 'Total: ~1.000 kcal · 80 g proteína · 100 g hidratos · 30 g grasa'),
    t(54, 740, 'Comida'), t(142, 740, 'Qué comer'), t(387, 740, 'kcal'), t(424, 740, 'Proteína · Hidratos ·'), t(424, 728, 'Grasa'),
    t(54, 700, 'Desayuno'), t(142, 700, 'Gachas: 70 g de avena + 30 g de whey'), t(387, 700, '600'), t(424, 700, '45 g · 81 g · 15 g'),
    t(142, 686, '+ 1 plátano'),
    t(54, 650, 'Media'), t(142, 650, '250 g de skyr + 1 kiwi'), t(387, 650, '400'), t(424, 650, '35 g · 20 g · 15 g'),
    t(54, 636, 'mañana'), // el nombre en dos líneas, con la segunda sola
    t(54, 600, 'Cena'), t(142, 600, '250 g de merluza'), // sin columnas de calorías: se trocea como antes
  ];
  const r = parseDietPdf(makePdf([page]));
  it('cada comida es una entrada con sus calorías y macros', () => {
    expect(r.entries.map((e) => [e.meal, e.name, e.kcal, e.protein_g, e.carbs_g, e.fat_g])).toEqual([
      ['desayuno', 'Gachas: 70 g de avena + 30 g de whey + 1 plátano', 600, 45, 81, 15],
      ['snacks', '250 g de skyr + 1 kiwi', 400, 35, 20, 15],
      ['cena', 'merluza', 0, 0, 0, 0],
    ]);
    expect(r.entries[0]).toMatchObject({ quantity_g: null, servings: 1 });
  });
  it('los macros por comida suman el total del día y se avisa', () => {
    expect(r.entries[0].kcal + r.entries[1].kcal).toBe(1000);
    expect(r.notes.some((n) => /una sola entrada/.test(n))).toBe(true);
    expect(r.notes.some((n) => /sin calorías/.test(n))).toBe(false);
  });
});

describe('parseMacros', () => {
  it('lee «proteína · hidratos · grasa»', () => {
    expect(parseMacros('45 g · 81 g · 15 g')).toEqual({ protein_g: 45, carbs_g: 81, fat_g: 15 });
    expect(parseMacros('12,5 g · 3 g · 0,5 g')).toEqual({ protein_g: 12.5, carbs_g: 3, fat_g: 0.5 });
    expect(parseMacros('Proteína · Hidratos ·')).toBeNull();
  });
});

describe('parseDietPdf: el objetivo del día es la suma exacta de sus comidas', () => {
  const t = (x: number, y: number, text: string): PdfItem => ({ x, y, text });
  const header = [t(54, 740, 'Comida'), t(142, 740, 'Qué comer'), t(387, 740, 'kcal'), t(424, 740, 'Proteína · Hidratos ·'), t(424, 728, 'Grasa')];
  const day = (name: string, total: string, meals: [string, string, string, string][]): PdfItem[] => [
    t(46, 790, name),
    t(46, 770, total),
    ...header,
    ...meals.flatMap(([meal, food, kcal, macros], i) => [t(54, 700 - i * 40, meal), t(142, 700 - i * 40, food), t(387, 700 - i * 40, kcal), t(424, 700 - i * 40, macros)]),
  ];
  it('con todas las comidas con calorías: suma de las comidas (no el «~» redondeado del total)', () => {
    const r = parseDietPdf(
      makePdf([day('Martes · entreno', 'Total: ~1.000 kcal · 80 g proteína · 100 g hidratos · 30 g grasa', [['Desayuno', '50 g de avena', '603', '40 g · 60 g · 15 g'], ['Cena', '200 g de pollo', '398', '41 g · 41 g · 14 g']])]),
    );
    expect(r.dayTargets).toEqual({ '2': { kcal: 1001, protein_g: 81, carbs_g: 101, fat_g: 29 } });
    expect(r.targets.kcal).toBe(1001);
  });
  it('si alguna comida no trae calorías, se usa el total que indica el PDF', () => {
    const r = parseDietPdf(
      makePdf([day('Martes · entreno', 'Total: ~1.000 kcal · 80 g proteína · 100 g hidratos · 30 g grasa', [['Desayuno', '50 g de avena', '603', '40 g · 60 g · 15 g'], ['Cena', '200 g de pollo', '', '']])]),
    );
    expect(r.dayTargets).toEqual({ '2': { kcal: 1000, protein_g: 80, carbs_g: 100, fat_g: 30 } });
  });
});
