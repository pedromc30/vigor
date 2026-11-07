import { makePdf, type PdfItem } from '../__fixtures__/pdf';
import { averageTargets, parseDietPdf, parseTotals } from '../diet-pdf';
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
  it('promedia los días y avisa si varían', () => {
    const r = averageTargets(new Map([[1, { kcal: 2800, protein_g: 200 }], [7, { kcal: 2400, protein_g: 190 }]]));
    expect(r.targets).toEqual({ kcal: 2600, protein_g: 195 });
    expect(r.varies).toBe(true);
    expect(averageTargets(new Map([[1, { kcal: 2000 }], [2, { kcal: 2000 }]])).varies).toBe(false);
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
  it('propone la media de los totales como objetivos y lo explica', () => {
    expect(r.targets).toEqual({ kcal: 2600, protein_g: 195, carbs_g: 295, fat_g: 62 });
    expect(r.notes.some((n) => /media semanal/.test(n))).toBe(true);
    expect(r.notes.some((n) => /sin calorías/.test(n))).toBe(true);
  });
  it('un PDF que no es una dieta no da alimentos y un archivo roto da un error legible', () => {
    expect(parseDietPdf(makePdf([[{ x: 50, y: 700, text: 'Factura 123' }]])).entries).toEqual([]);
    expect(() => parseDietPdf(new Uint8Array([1, 2, 3]))).toThrow(SpreadsheetError);
  });
});
