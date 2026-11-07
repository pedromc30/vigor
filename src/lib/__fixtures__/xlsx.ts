// Genera un .xlsx mínimo pero real (ZIP + XML) para probar el lector.
import { strToU8, zipSync } from 'fflate';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const colName = (j: number) => String.fromCharCode(65 + j);

export function makeXlsx(sheets: { name: string; rows: (string | number | null)[][] }[], opts: { inline?: boolean } = {}): Uint8Array {
  const shared: string[] = [];
  const idx = (s: string) => {
    let i = shared.indexOf(s);
    if (i < 0) i = shared.push(s) - 1;
    return i;
  };
  const sheetXml = (rows: (string | number | null)[][]) =>
    `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows
      .map(
        (r, i) =>
          `<row r="${i + 1}">${r
            .map((c, j) => {
              if (c === null || c === '') return '';
              const ref = `${colName(j)}${i + 1}`;
              if (typeof c === 'number') return `<c r="${ref}"><v>${c}</v></c>`;
              return opts.inline ? `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(c)}</t></is></c>` : `<c r="${ref}" t="s"><v>${idx(c)}</v></c>`;
            })
            .join('')}</row>`,
      )
      .join('')}</sheetData></worksheet>`;
  const files: Record<string, Uint8Array> = {};
  sheets.forEach((s, i) => (files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(s.rows))));
  files['xl/workbook.xml'] = strToU8(
    `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
  );
  files['xl/_rels/workbook.xml.rels'] = strToU8(
    `<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join('')}</Relationships>`,
  );
  if (!opts.inline) {
    files['xl/sharedStrings.xml'] = strToU8(
      `<?xml version="1.0"?><sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">${shared
        .map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`)
        .join('')}</sst>`,
    );
  }
  files['[Content_Types].xml'] = strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>');
  return zipSync(files);
}
