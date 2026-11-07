import { canImportDiet, DIET_FILE_MAX_BYTES, DIET_FILE_MIMES, cleanFileName, formatSize, resolveDietFile, storagePath, typeOf } from '../diet-file-types';

describe('resolveDietFile', () => {
  it('acepta PDF, imágenes, Word, Excel y texto', () => {
    for (const [name, mime] of [
      ['dieta.pdf', 'application/pdf'],
      ['foto.JPG', 'image/jpeg'],
      ['plan.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
      ['plan.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
      ['notas.txt', 'text/plain'],
    ]) {
      const r = resolveDietFile({ name, mimeType: mime, size: 1000 });
      expect(r).toMatchObject({ ok: true, mime });
    }
  });

  it('si el sistema no da el tipo (o da uno genérico) se deduce de la extensión', () => {
    expect(resolveDietFile({ name: 'Dieta Mayo.PDF', mimeType: null, size: 10 })).toMatchObject({ ok: true, mime: 'application/pdf', ext: 'pdf' });
    expect(resolveDietFile({ name: 'x.xlsx', mimeType: 'application/octet-stream', size: 10 })).toMatchObject({ ok: true, ext: 'xlsx' });
  });

  it('el tipo MIME manda si el nombre no tiene extensión', () => {
    expect(resolveDietFile({ name: 'imagen', mimeType: 'image/png', size: 10 })).toMatchObject({ ok: true, mime: 'image/png', ext: 'png' });
  });

  it('rechaza tipos no permitidos', () => {
    for (const name of ['virus.exe', 'video.mp4', 'archivo.zip', 'sin-extension']) {
      expect(resolveDietFile({ name, mimeType: 'application/octet-stream', size: 10 })).toMatchObject({ ok: false });
    }
  });

  it('rechaza archivos vacíos y de más de 10 MB, con el tamaño en el mensaje', () => {
    expect(resolveDietFile({ name: 'a.pdf', size: 0 })).toMatchObject({ ok: false, error: 'El archivo está vacío.' });
    const big = resolveDietFile({ name: 'a.pdf', size: DIET_FILE_MAX_BYTES + 1 });
    expect(big).toMatchObject({ ok: false });
    expect(big.ok === false && big.error).toMatch(/10 MB/);
    expect(resolveDietFile({ name: 'a.pdf', size: DIET_FILE_MAX_BYTES })).toMatchObject({ ok: true });
  });

  it('sin tamaño conocido no se rechaza (lo comprobará el servidor)', () => {
    expect(resolveDietFile({ name: 'a.pdf' })).toMatchObject({ ok: true });
  });
});

describe('CSV e importación', () => {
  it('un .csv es CSV aunque el sistema lo declare como Excel (Windows)', () => {
    expect(resolveDietFile({ name: 'dieta.csv', mimeType: 'application/vnd.ms-excel', size: 10 })).toMatchObject({ ok: true, mime: 'text/csv', ext: 'csv' });
    expect(resolveDietFile({ name: 'dieta.xls', mimeType: 'application/vnd.ms-excel', size: 10 })).toMatchObject({ ok: true, mime: 'application/vnd.ms-excel' });
  });
  it('se pueden leer .xlsx y .csv; el resto solo se guarda', () => {
    expect(canImportDiet({ name: 'a.xlsx' })).toBe(true);
    expect(canImportDiet({ name: 'a.CSV' })).toBe(true);
    expect(canImportDiet({ name: 'a', mime_type: 'text/csv' })).toBe(true);
    for (const name of ['a.xls', 'a.docx', 'a.jpg', 'a.txt']) expect(canImportDiet({ name })).toBe(false);
  });
});

describe('nombres y tamaños', () => {
  it('cleanFileName quita la ruta y los espacios sobrantes y recorta a 120 caracteres conservando la extensión', () => {
    expect(cleanFileName('  C:\\Users\\yo\\Dieta   mayo.pdf ')).toBe('Dieta mayo.pdf');
    expect(cleanFileName('/storage/emulated/0/Download/plan.docx')).toBe('plan.docx');
    const long = cleanFileName('a'.repeat(300) + '.pdf');
    expect(long).toHaveLength(120);
    expect(long.endsWith('.pdf')).toBe(true);
  });
  it('formatSize', () => {
    expect(formatSize(500)).toBe('500 B');
    expect(formatSize(250_000)).toBe('244 KB');
    expect(formatSize(1_300_000)).toBe('1,2 MB');
    expect(formatSize(10 * 1024 * 1024)).toBe('10 MB');
  });
  it('la ruta de almacenamiento va en la carpeta del usuario y no usa el nombre original', () => {
    expect(storagePath('u1', 'pdf', 1700000000000, 'abc123')).toBe('u1/1700000000000-abc123.pdf');
  });
  it('typeOf y la lista de tipos MIME del selector', () => {
    expect(typeOf('application/pdf')).toMatchObject({ label: 'PDF', icon: 'document-text-outline' });
    expect(typeOf('raro/x').label).toBe('Archivo');
    expect(new Set(DIET_FILE_MIMES).size).toBe(DIET_FILE_MIMES.length);
    expect(DIET_FILE_MIMES).toContain('application/pdf');
  });
});
