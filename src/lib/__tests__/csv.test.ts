import { CSV_EXCEL_ES, CSV_STANDARD, toCsv } from '../csv';

const BOM = '﻿';

describe('toCsv', () => {
  it('cabeceras, filas y salto de línea CRLF con BOM', () => {
    expect(toCsv(['a', 'b'], [[1, 'x'], [2, 'y']])).toBe(`${BOM}a,b\r\n1,x\r\n2,y\r\n`);
  });
  it('nulos y vacíos quedan como celdas vacías; booleanos como true/false', () => {
    expect(toCsv(['a', 'b', 'c'], [[null, undefined, true], ['', false, 0]])).toBe(`${BOM}a,b,c\r\n,,true\r\n,false,0\r\n`);
  });
  it('entrecomilla y escapa comillas, comas y saltos de línea', () => {
    const out = toCsv(['t'], [['dijo "hola", y luego\nadiós']]);
    expect(out).toBe(`${BOM}t\r\n"dijo ""hola"", y luego\nadiós"\r\n`);
  });
  it('la coma solo obliga a entrecomillar cuando es el separador', () => {
    expect(toCsv(['t'], [['a, b']], CSV_STANDARD)).toContain('"a, b"');
    expect(toCsv(['t'], [['a, b']], CSV_EXCEL_ES)).toContain('\r\na, b\r\n');
    expect(toCsv(['t'], [['a; b']], CSV_EXCEL_ES)).toContain('"a; b"');
  });
  it('formato Excel España: separador «;» y decimales con coma', () => {
    expect(toCsv(['x', 'y'], [[62.5, 'a']], CSV_EXCEL_ES)).toBe(`${BOM}x;y\r\n62,5;a\r\n`);
    expect(toCsv(['x'], [[62.5]], CSV_STANDARD)).toBe(`${BOM}x\r\n62.5\r\n`);
  });
  it('los números negativos y los infinitos', () => {
    expect(toCsv(['x'], [[-3.5, Infinity, NaN]].map((r) => [r[0]]), CSV_STANDARD)).toContain('-3.5');
    expect(toCsv(['x'], [[Infinity], [NaN]])).toBe(`${BOM}x\r\n\r\n\r\n`);
  });
  it('neutraliza texto que una hoja de cálculo interpretaría como fórmula', () => {
    const out = toCsv(['n'], [['=HYPERLINK("http://x")'], ['+1'], ['-2 ejercicios'], ['@suma'], ['normal']]);
    expect(out).toContain("\r\n\"'=HYPERLINK(\"\"http://x\"\")\"\r\n");
    expect(out).toContain("\r\n'+1\r\n");
    expect(out).toContain("\r\n'-2 ejercicios\r\n");
    expect(out).toContain("\r\n'@suma\r\n");
    expect(out).toContain('\r\nnormal\r\n');
  });
  it('conserva tildes y eñes', () => {
    expect(toCsv(['n'], [['Cuádriceps ñandú']])).toContain('Cuádriceps ñandú');
  });
});
