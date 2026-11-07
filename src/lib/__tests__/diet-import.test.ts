import { daysWithEntries, draftsByWeekday, findTargets, gramsIn, mealOf, numberWithUnit, parseDietSheets, parseNumber, splitItems, weekdayOf } from '../diet-import';
import { parseCsv, readSpreadsheet } from '../spreadsheet';
import { makeXlsx } from '../__fixtures__/xlsx';

describe('días y comidas', () => {
  it('weekdayOf: nombres, abreviaturas, acentos y «Día 1 - Lunes»', () => {
    expect(['Lunes', 'lun', 'LUN.', 'Martes', 'Miércoles', 'MIE', 'Jueves', 'Viernes', 'Sábado', 'sab', 'Domingo', 'Día 3 - Miércoles'].map(weekdayOf)).toEqual([1, 1, 1, 2, 3, 3, 4, 5, 6, 6, 7, 3]);
    for (const t of ['Desayuno', 'El lunes comer fuera', '', 'Marte', '12']) expect(weekdayOf(t)).toBeNull();
  });
  it('mealOf: las comidas habituales y sus sinónimos', () => {
    expect(['Desayuno', 'DESAYUNO:', 'Media mañana', 'Tentempié', 'Almuerzo', 'Comida', 'Merienda', 'Cena', 'Recena', 'Pre-entreno', 'Snack'].map(mealOf)).toEqual([
      'desayuno', 'desayuno', 'snacks', 'snacks', 'comida', 'comida', 'merienda', 'cena', 'snacks', 'snacks', 'snacks',
    ]);
    for (const t of ['Total kcal', 'Lunes', '', 'Notas', 'a'.repeat(50)]) expect(mealOf(t)).toBeNull();
  });
});

describe('números y cantidades', () => {
  it('parseNumber: decimales con coma o punto y millares', () => {
    expect(['1850', '1.850', '1,850', '12,5', '12.5', '1 850', '0,75', '1.850,5', '2,000.5', '3.5', 'abc', '', '-3'].map(parseNumber)).toEqual([1850, 1850, 1850, 12.5, 12.5, 1850, 0.75, 1850.5, 2000.5, 3.5, null, null, null]);
  });
  it('gramsIn: gramos y mililitros, con o sin paréntesis', () => {
    expect(gramsIn('200 g de pollo')).toEqual({ grams: 200, rest: 'pollo' });
    expect(gramsIn('Pechuga de pavo (150g)')).toEqual({ grams: 150, rest: 'Pechuga de pavo' });
    expect(gramsIn('Arroz 60 gr')).toEqual({ grams: 60, rest: 'Arroz' });
    expect(gramsIn('250 ml de leche')).toEqual({ grams: 250, rest: 'leche' });
    expect(gramsIn('12,5 g aceite')).toEqual({ grams: 12.5, rest: 'aceite' });
    expect(gramsIn('2 huevos')).toBeNull();
    expect(gramsIn('1 yogur natural')).toBeNull();
  });
  it('numberWithUnit', () => {
    expect(['220', '220 g', '1.850 kcal', '12,5g', 'abc', '15 minutos'].map(numberWithUnit)).toEqual([220, 220, 1850, 12.5, null, null]);
  });
  it('splitItems: por línea, «;» y « + »; sin comas ni guiones sueltos', () => {
    expect(splitItems('Tostada con tomate; 1 yogur\nCafé + 30 g nueces')).toEqual(['Tostada con tomate', '1 yogur', 'Café', '30 g nueces']);
    expect(splitItems('Pan, tomate y aceite')).toEqual(['Pan, tomate y aceite']);
    expect(splitItems('-')).toEqual([]);
    expect(splitItems('• Fruta\n• Frutos secos')).toEqual(['Fruta', 'Frutos secos']);
    expect(splitItems('Libre')).toEqual([]);
    expect(splitItems('x')).toEqual([]); // «x» o «-» como marca de «nada»
  });
});

const GRID = [
  ['Dieta de Pedro', '', '', '', '', '', '', ''],
  ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
  ['Desayuno', 'Tostadas con tomate; 1 café', '40 g de avena\n200 ml de leche', 'Yogur', '', 'Café', 'Tortilla', 'Fruta'],
  ['Media mañana', 'Una pieza de fruta', '', '', '', '', '', ''],
  ['Comida', '150 g de pollo a la plancha; 60 g de arroz', 'Lentejas', 'Pasta', 'Pescado', 'Ensalada', 'Paella', 'Cocido'],
  ['Merienda', 'Yogur', 'Fruta', 'Queso', '', '', '', ''],
  ['Cena', 'Tortilla francesa', 'Crema de verduras', '', '', '', '', ''],
  ['Total kcal', 1800, 1850, 1900, 1800, 1700, 2000, 2100],
];

describe('parseDietSheets: días en columnas', () => {
  const r = parseDietSheets([{ name: 'Semana', rows: GRID.map((row) => row.map(String)) }]);
  it('reconoce el formato y la hoja', () => {
    expect(r.layout).toBe('grid');
    expect(r.sheet).toBe('Semana');
  });
  it('divide cada celda en alimentos y los coloca por día y comida', () => {
    const lunesDes = r.entries.filter((e) => e.weekday === 1 && e.meal === 'desayuno').map((e) => e.name);
    expect(lunesDes).toEqual(['Tostadas con tomate', '1 café']);
    const martesDes = r.entries.filter((e) => e.weekday === 2 && e.meal === 'desayuno');
    expect(martesDes.map((e) => [e.name, e.quantity_g, e.servings])).toEqual([['avena', 40, null], ['leche', 200, null]]);
    expect(r.entries.filter((e) => e.weekday === 1 && e.meal === 'comida').map((e) => [e.name, e.quantity_g])).toEqual([['pollo a la plancha', 150], ['arroz', 60]]);
    expect(r.entries.filter((e) => e.weekday === 1 && e.meal === 'snacks').map((e) => e.name)).toEqual(['Una pieza de fruta']);
  });
  it('lo que no tiene cantidad es 1 ración y sin calorías', () => {
    const e = r.entries.find((x) => x.name === 'Yogur' && x.weekday === 3)!;
    expect(e).toMatchObject({ quantity_g: null, servings: 1, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(r.notes.join(' ')).toMatch(/sin calorías/);
  });
  it('ignora las filas de totales y los días sin comida', () => {
    expect(r.entries.every((e) => !/total/i.test(e.name))).toBe(true);
    expect(r.entries.filter((e) => e.weekday === 4 && e.meal === 'desayuno')).toEqual([]);
    expect(r.entries.filter((e) => e.weekday === 7 && e.meal === 'cena')).toEqual([]);
  });
  it('sin objetivos explícitos: calorías distintas cada día no se toman como objetivo y se avisa', () => {
    expect(r.targets).toEqual({});
    expect(r.notes.join(' ')).toMatch(/calorías distintas cada día/);
  });
});

describe('parseDietSheets: celdas combinadas y otros nombres', () => {
  it('una comida con la etiqueta solo en la primera fila sigue valiendo en las siguientes', () => {
    const r = parseDietSheets([{ name: 'x', rows: [
      ['', 'Lunes', 'Martes', 'Miércoles'],
      ['Desayuno', 'Café', 'Té', 'Café'],
      ['', 'Tostada', 'Cereales', 'Pan'],
      ['Cena', 'Sopa', 'Ensalada', 'Pizza'],
    ] }]);
    expect(r.entries.filter((e) => e.weekday === 1 && e.meal === 'desayuno').map((e) => e.name)).toEqual(['Café', 'Tostada']);
    expect(r.entries.filter((e) => e.meal === 'cena')).toHaveLength(3);
  });
  it('una fila con otro rótulo se avisa como no reconocida', () => {
    const r = parseDietSheets([{ name: 'x', rows: [
      ['', 'Lunes', 'Martes', 'Miércoles'],
      ['Desayuno', 'Café', 'Té', 'Café'],
      ['Postre', 'Fruta', 'Flan', 'Helado'],
    ] }]);
    expect(r.entries).toHaveLength(3);
    expect(r.skipped[0]).toMatch(/^Postre: Fruta \/ Flan \/ Helado/);
  });
});

describe('parseDietSheets: días en filas', () => {
  it('transpuesto', () => {
    const r = parseDietSheets([{ name: 't', rows: [
      ['Día', 'Desayuno', 'Comida', 'Cena'],
      ['Lunes', 'Café', '100 g pasta', 'Sopa'],
      ['Martes', 'Té', 'Arroz', 'Tortilla'],
      ['Miércoles', 'Café', 'Pollo', ''],
    ] }]);
    expect(r.layout).toBe('transposed');
    expect(r.entries.map((e) => [e.weekday, e.meal, e.name])).toContainEqual([1, 'comida', 'pasta']);
    expect(r.entries).toHaveLength(8);
  });
});

describe('parseDietSheets: una fila por alimento', () => {
  const rows = [
    ['Día', 'Comida', 'Alimento', 'Cantidad (g)', 'Kcal', 'Proteínas', 'Hidratos', 'Grasas'],
    ['Lunes', 'Desayuno', 'Avena', '40', '150,5', '5', '27', '3'],
    ['', '', 'Leche semidesnatada', '200', '92', '6,5', '9,6', '3'],
    ['', 'Comida', 'Pollo a la plancha', '150', '165', '31', '0', '3,6'],
    ['Martes', 'Cena', 'Tortilla francesa', '', '210', '14', '1', '16'],
    ['Martes', 'Postre raro', 'Flan', '100', '130', '3', '20', '4'],
  ];
  const r = parseDietSheets([{ name: 'l', rows }]);
  it('lee cantidades y macros del archivo', () => {
    expect(r.layout).toBe('list');
    expect(r.entries[0]).toMatchObject({ weekday: 1, meal: 'desayuno', name: 'Avena', quantity_g: 40, servings: null, kcal: 150.5, protein_g: 5, carbs_g: 27, fat_g: 3 });
    expect(r.entries[1]).toMatchObject({ weekday: 1, meal: 'desayuno', name: 'Leche semidesnatada', quantity_g: 200, kcal: 92, protein_g: 6.5 }); // día y comida heredados
    expect(r.entries[2]).toMatchObject({ meal: 'comida', name: 'Pollo a la plancha', kcal: 165 });
    expect(r.entries[3]).toMatchObject({ weekday: 2, meal: 'cena', quantity_g: null, servings: 1, kcal: 210 });
  });
  it('lo que no se puede colocar se lista aparte', () => {
    expect(r.entries).toHaveLength(4);
    expect(r.skipped).toEqual(['Martes Postre raro: Flan']);
  });
  it('no avisa de «sin calorías» cuando las trae', () => {
    expect(r.notes.join(' ')).not.toMatch(/sin calorías/);
    expect(r.notes.join(' ')).toMatch(/Las calorías y los macros salen del archivo/);
  });
});

describe('findTargets', () => {
  it('en el mismo texto o en la celda de al lado', () => {
    expect(findTargets([['Calorías diarias: 2.000 kcal'], ['Proteínas', '150'], ['Hidratos de carbono', '220 g'], ['Grasas 70 g']]).targets).toEqual({ kcal: 2000, protein_g: 150, carbs_g: 220, fat_g: 70 });
  });
  it('lo toma una sola vez (la primera) y respeta límites razonables', () => {
    expect(findTargets([['Kcal', '1800'], ['Kcal', '2500']]).targets.kcal).toBe(1800);
    expect(findTargets([['Kcal', '50']]).targets).toEqual({}); // fuera de rango
    expect(findTargets([['Calorías', '999999']]).targets).toEqual({});
  });
  it('una cabecera de columna no es un objetivo', () => {
    expect(findTargets([['Día', 'Comida', 'Alimento', 'Kcal', 'Proteínas'], ['Lunes', 'Cena', 'Sopa', '120', '5']]).targets).toEqual({});
  });
  it('varios valores iguales en la fila sí; distintos, no', () => {
    expect(findTargets([['Total kcal', '2000', '2000', '2000']]).targets.kcal).toBe(2000);
    const r = findTargets([['Total kcal', '1800', '1900']]);
    expect(r.targets).toEqual({});
    expect(r.notes[0]).toMatch(/distintas cada día/);
  });
  it('ignora celdas de días y comidas', () => {
    expect(findTargets([['Cena', '600']]).targets).toEqual({});
  });
});

describe('objetivos junto a la dieta, y archivos reales', () => {
  it('xlsx con un bloque de objetivos y la tabla', () => {
    const bytes = makeXlsx([{ name: 'Dieta', rows: [
      ['Calorías', 2200, '', 'Proteínas', 160],
      ['Hidratos', 250, '', 'Grasas', 70],
      [],
      ['', 'Lunes', 'Martes', 'Miércoles'],
      ['Desayuno', 'Café con leche', 'Tostada', 'Yogur'],
      ['Comida', '200 g pollo', 'Lentejas', 'Pasta'],
    ] }]);
    const r = parseDietSheets(readSpreadsheet(bytes));
    expect(r.layout).toBe('grid');
    expect(r.targets).toEqual({ kcal: 2200, protein_g: 160, carbs_g: 250, fat_g: 70 });
    expect(r.entries).toHaveLength(6);
  });
  it('CSV de Excel en español (;, comas decimales, Windows-1252)', () => {
    const text = 'Día;Comida;Alimento;Cantidad;Kcal;Proteínas;Hidratos;Grasas\nLunes;Desayuno;Café con leche;200;90,5;6;9;3\nLunes;Cena;Tortilla;;210;14;1;16\n';
    const bytes = new Uint8Array([...text].map((c) => (c === 'í' ? 0xed : c === 'ñ' ? 0xf1 : c.charCodeAt(0)))); // latin1
    const r = parseDietSheets(readSpreadsheet(bytes, 'dieta.csv'));
    expect(r.layout).toBe('list');
    expect(r.entries.map((e) => [e.name, e.kcal])).toEqual([['Café con leche', 90.5], ['Tortilla', 210]]);
  });
  it('un archivo que no es una dieta no da entradas', () => {
    const r = parseDietSheets([{ name: 'x', rows: parseCsv('a;b;c\n1;2;3\n4;5;6') }]);
    expect(r).toMatchObject({ layout: 'none', entries: [], targets: {} });
  });
  it('elige la hoja con más alimentos', () => {
    const small = { name: 'Resumen', rows: [['', 'Lunes', 'Martes', 'Miércoles'], ['Cena', 'Sopa', 'Pasta', 'Pizza']] };
    const big = { name: 'Semana', rows: [['', 'Lunes', 'Martes', 'Miércoles'], ['Desayuno', 'a', 'b', 'c'], ['Comida', 'd', 'e', 'f'], ['Cena', 'g', 'h', 'i']] };
    expect(parseDietSheets([small, big]).sheet).toBe('Semana');
  });
  it('limita el número de alimentos importados', () => {
    const rows = [['', 'Lunes', 'Martes', 'Miércoles'], ...Array.from({ length: 200 }, () => ['Comida', 'a', 'b', 'c'])];
    const r = parseDietSheets([{ name: 'x', rows }]);
    expect(r.entries).toHaveLength(400);
    expect(r.notes.join(' ')).toMatch(/400 primeros/);
  });
});

describe('borradores del planificador', () => {
  const r = parseDietSheets([{ name: 'x', rows: GRID.map((row) => row.map(String)) }]);
  it('agrupa por día y respeta los días elegidos', () => {
    expect(daysWithEntries(r.entries)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    const m = draftsByWeekday(r.entries, new Set([1, 3]));
    expect([...m.keys()]).toEqual([1, 3]);
    expect(m.get(1)![0]).toEqual({ meal: 'desayuno', food_id: null, recipe_id: null, name: 'Tostadas con tomate', quantity_g: null, servings: 1, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect(draftsByWeekday(r.entries, new Set()).size).toBe(0);
  });
});
