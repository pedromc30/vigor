import { unzipSync, strFromU8 } from 'fflate';
import { buildXlsx, columnName } from '../xlsx-writer';
import { readSpreadsheet } from '../spreadsheet';

const table = {
  sheet: 'Resumen por días',
  headers: ['dato', '2026-11-03', '2026-11-04'],
  rows: [
    ['Calorías (kcal)', 2860, ''],
    ['Entreno', '', 'Fuerza A + <B> & "C"'],
    ['Peso (kg)', 82.2, 82.0],
  ],
};

describe('columnName', () => {
  it('A, Z, AA, AZ, BA y ZZ', () => {
    expect([0, 25, 26, 51, 52, 701].map(columnName)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA', 'ZZ']);
  });
});

describe('buildXlsx', () => {
  const bytes = buildXlsx(table);
  it('es un ZIP con las partes de un libro de Excel', () => {
    const files = unzipSync(bytes);
    expect(Object.keys(files).sort()).toEqual(['[Content_Types].xml', '_rels/.rels', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml', 'xl/workbook.xml', 'xl/worksheets/sheet1.xml']);
  });
  it('se lee de vuelta con el lector de la app: mismas cifras y textos (con símbolos escapados)', () => {
    const [sheet] = readSpreadsheet(bytes, 'x.xlsx');
    expect(sheet.name).toBe('Resumen por días');
    expect(sheet.rows).toEqual([
      ['dato', '2026-11-03', '2026-11-04'],
      ['Calorías (kcal)', '2860', ''],
      ['Entreno', '', 'Fuerza A + <B> & "C"'],
      ['Peso (kg)', '82.2', '82'],
    ]);
  });
  it('lleva los colores de la app (terracota y tinta) y las tipografías', () => {
    const styles = strFromU8(unzipSync(bytes)['xl/styles.xml']);
    expect(styles).toContain('FFD9502B');
    expect(styles).toContain('FF1D1A16');
    expect(styles).toContain('Barlow Condensed');
    expect(styles).toContain('Manrope');
  });
  it('inmoviliza la fila de fechas y la columna de nombres', () => {
    expect(strFromU8(unzipSync(bytes)['xl/worksheets/sheet1.xml'])).toContain('state="frozen"');
  });
  it('el nombre de la hoja se limpia (31 caracteres, sin símbolos prohibidos)', () => {
    const w = strFromU8(unzipSync(buildXlsx({ ...table, sheet: 'a/b:c*d?e[f]' + 'x'.repeat(40) }))['xl/workbook.xml']);
    const name = /name="([^"]*)"/.exec(w)![1];
    expect(name.length).toBeLessThanOrEqual(31);
    expect(/[:\\/?*[\]]/.test(name)).toBe(false);
  });
});
