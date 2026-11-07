import { strToU8, zipSync } from 'fflate';
import {
  SpreadsheetError,
  cellRef,
  decodeText,
  decodeUtf8Strict,
  decodeXml,
  detectDelimiter,
  parseCsv,
  parseSharedStrings,
  readSpreadsheet,
  readXlsx,
} from '../spreadsheet';
import { makeXlsx } from '../__fixtures__/xlsx';

describe('texto', () => {
  it('decodeXml: entidades con nombre y numéricas', () => {
    expect(decodeXml('Pan &amp; aceite &lt;1&gt; &quot;x&quot; &#233; &#x1F600; &nbsp;')).toBe('Pan & aceite <1> "x" é 😀 &nbsp;');
  });
  it('UTF-8 estricto y respaldo a Windows-1252', () => {
    expect(decodeUtf8Strict(strToU8('Sábado ñ €'))).toBe('Sábado ñ €');
    expect(decodeUtf8Strict(new Uint8Array([0x53, 0xe1, 0x62]))).toBeNull(); // «Sáb» en latin1 no es UTF-8
    expect(decodeUtf8Strict(new Uint8Array([0xe2, 0x82]))).toBeNull(); // secuencia cortada
    expect(decodeText(new Uint8Array([0x53, 0xe1, 0x62, 0x61, 0x64, 0x6f]))).toBe('Sábado');
    expect(decodeText(new Uint8Array([0xef, 0xbb, 0xbf, ...strToU8('Cena')]))).toBe('Cena'); // BOM
    expect(decodeText(new Uint8Array([0x80, 0x20, 0x31]))).toBe('€ 1');
  });
});

describe('CSV', () => {
  it('detecta el separador: ; , o tabulador', () => {
    expect(detectDelimiter('a;b;c\n1;2;3')).toBe(';');
    expect(detectDelimiter('a,b,c\n1,2,3')).toBe(',');
    expect(detectDelimiter('a\tb\tc')).toBe('\t');
    expect(detectDelimiter('"a;b";c;d')).toBe(';'); // lo entrecomillado no cuenta
    expect(detectDelimiter('sin separadores')).toBe(';');
  });
  it('campos entrecomillados, comillas dobles y saltos de línea dentro de una celda', () => {
    expect(parseCsv('a;"b;c";"d ""x"""\n"l1\nl2";2;3')).toEqual([['a', 'b;c', 'd "x"'], ['l1\nl2', '2', '3']]);
  });
  it('saltos CRLF, filas vacías y sin salto final', () => {
    expect(parseCsv('a;b\r\n\r\n1;2')).toEqual([['a', 'b'], ['1', '2']]);
  });
});

describe('Excel (.xlsx)', () => {
  it('cellRef: A1, Z1, AA1', () => {
    expect(cellRef('A1')).toEqual({ col: 0, row: 0 });
    expect(cellRef('C10')).toEqual({ col: 2, row: 9 });
    expect(cellRef('AA3')).toEqual({ col: 26, row: 2 });
    expect(cellRef('1A')).toBeNull();
  });

  it('cadenas compartidas, incluidas las de texto enriquecido y con acentos', () => {
    expect(parseSharedStrings('<sst><si><t>Lunes</t></si><si><r><t>Tostada </t></r><r><t xml:space="preserve">con tomate</t></r></si><si><t>Caf&#233; &amp; leche</t></si><si/></sst>')).toEqual([
      'Lunes',
      'Tostada con tomate',
      'Café & leche',
      '',
    ]);
  });

  it('lee hojas, huecos y números', () => {
    const [s] = readXlsx(makeXlsx([{ name: 'Dieta', rows: [['Día', 'Lunes', null, 'Miércoles'], ['Desayuno', 'Café', '', 12.5]] }]));
    expect(s.name).toBe('Dieta');
    expect(s.rows).toEqual([['Día', 'Lunes', '', 'Miércoles'], ['Desayuno', 'Café', '', '12.5']]);
  });

  it('textos en línea (inlineStr) y varias hojas', () => {
    const sheets = readXlsx(makeXlsx([{ name: 'A', rows: [['uno']] }, { name: 'B & C', rows: [['dos']] }], { inline: true }));
    expect(sheets.map((s) => [s.name, s.rows[0][0]])).toEqual([['A', 'uno'], ['B & C', 'dos']]);
  });

  it('errores claros: ZIP dañado, ZIP sin libro de Excel', () => {
    expect(() => readXlsx(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]))).toThrow(SpreadsheetError);
    expect(() => readXlsx(zipSync({ 'hola.txt': strToU8('x') }))).toThrow(/no parece un Excel/);
  });

  it('readSpreadsheet decide por el contenido: xlsx, xls antiguo y CSV', () => {
    expect(readSpreadsheet(makeXlsx([{ name: 'X', rows: [['a']] }]))[0].rows).toEqual([['a']]);
    expect(() => readSpreadsheet(new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0, 0]))).toThrow(/\.xls/);
    expect(readSpreadsheet(strToU8('Día;Lunes\nCena;Sopa'), 'dieta.csv')).toEqual([{ name: 'dieta.csv', rows: [['Día', 'Lunes'], ['Cena', 'Sopa']] }]);
    expect(() => readSpreadsheet(strToU8('\n\n'), 'v.csv')).toThrow(/no tiene datos/);
  });
});
