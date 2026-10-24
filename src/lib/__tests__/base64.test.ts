import { base64ToBytes } from '../base64';

declare const Buffer: { from(data: Uint8Array): { toString(enc: string): string } };

const text = (b: Uint8Array) => String.fromCharCode(...b);

describe('base64ToBytes', () => {
  it('decodifica con y sin relleno', () => {
    expect(text(base64ToBytes('TWFu'))).toBe('Man');
    expect(text(base64ToBytes('TWE='))).toBe('Ma');
    expect(text(base64ToBytes('TQ=='))).toBe('M');
    expect(text(base64ToBytes('TWE'))).toBe('Ma');
    expect(text(base64ToBytes('TQ'))).toBe('M');
    expect(base64ToBytes('')).toEqual(new Uint8Array(0));
  });
  it('coincide con Buffer para bytes arbitrarios (incluida la cabecera JPEG)', () => {
    const bytes = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1, 255, 0, 128, 7]);
    const b64 = Buffer.from(bytes).toString('base64');
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
  });
  it('ignora saltos de línea', () => {
    expect(text(base64ToBytes('TW\nFu'))).toBe('Man');
  });
  it('rechaza caracteres inválidos', () => {
    expect(() => base64ToBytes('TW*u')).toThrow();
  });
  it('soporta una imagen grande sin perder bytes', () => {
    const big = Uint8Array.from({ length: 100003 }, (_, i) => (i * 31) % 256);
    expect(Array.from(base64ToBytes(Buffer.from(big).toString('base64')))).toEqual(Array.from(big));
  });
});
