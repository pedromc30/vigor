// Genera un archivo de Excel (.xlsx) con los colores de la app a partir de una tabla (cabeceras + filas).
// Un .xlsx es un ZIP con varios XML. Lógica pura: solo `fflate` (ya usado para leer .xlsx).
import { strToU8, zipSync } from 'fflate';
import type { Cell } from './csv';

export interface XlsxTable {
  /** Nombre de la hoja (máx. 31 caracteres, sin : \ / ? * [ ]). */
  sheet: string;
  headers: string[];
  rows: Cell[][];
}

// Paleta de la app (papel y terracota). Los códigos son ARGB sin «#».
const C = { terracota: 'FFD9502B', tinta: 'FF1D1A16', crema: 'FFF6F1E7', arena: 'FFE3DBC9', borde: 'FFE8E0CF', blanco: 'FFFFFFFF' };
// Las tipografías de la app. Excel solo las muestra si están instaladas en el equipo; si no, usa una de reemplazo.
const FONT_DISPLAY = 'Barlow Condensed';
const FONT_TEXT = 'Manrope';

const esc = (s: string) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[c]!).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

/** 0 → A, 25 → Z, 26 → AA… */
export function columnName(index: number): string {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="3">
<font><sz val="11"/><color rgb="${C.tinta}"/><name val="${FONT_TEXT}"/></font>
<font><b/><sz val="12"/><color rgb="${C.crema}"/><name val="${FONT_DISPLAY}"/></font>
<font><b/><sz val="11"/><color rgb="${C.tinta}"/><name val="${FONT_TEXT}"/></font>
</fonts>
<fills count="5">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${C.terracota}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${C.tinta}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${C.arena}"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color rgb="${C.borde}"/></left><right style="thin"><color rgb="${C.borde}"/></right><top style="thin"><color rgb="${C.borde}"/></top><bottom style="thin"><color rgb="${C.borde}"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="right" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

// Estilos de celda (índices de cellXfs): 1 esquina, 2 fechas, 3 nombres de fila, 4 número, 5 texto
const S = { corner: 1, header: 2, label: 3, number: 4, text: 5 };

/** Texto de la hoja: cabecera en terracota, primera columna en arena, bordes finos y paneles inmovilizados. */
function sheetXml(t: XlsxTable): string {
  const cols = t.headers.length;
  const cell = (r: number, c: number, v: Cell, style: number) => {
    const ref = `${columnName(c)}${r}`;
    if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}" s="${style}"><v>${v}</v></c>`;
    if (v == null || v === '') return `<c r="${ref}" s="${style}"/>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
  };
  const head = `<row r="1" ht="24" customHeight="1">${t.headers.map((h, c) => cell(1, c, h, c === 0 ? S.corner : S.header)).join('')}</row>`;
  const body = t.rows
    .map((row, i) => {
      const r = i + 2;
      return `<row r="${r}" ht="20" customHeight="1">${Array.from({ length: cols }, (_, c) => {
        const v = row[c];
        return cell(r, c, v, c === 0 ? S.label : typeof v === 'number' ? S.number : S.text);
      }).join('')}</row>`;
    })
    .join('');
  // Ancho de cada columna según lo que contiene (en caracteres), con un mínimo y un máximo razonables.
  const widths = Array.from({ length: cols }, (_, c) => {
    const longest = Math.max(String(t.headers[c] ?? '').length, ...t.rows.map((r) => (r[c] == null ? 0 : String(r[c]).length)));
    return Math.min(40, Math.max(c === 0 ? 18 : 11, Math.ceil(longest * 1.15) + 2));
  });
  const width = (c: number) => widths[c];
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
<sheetViews><sheetView workbookViewId="0" showGridLines="0"><pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/><selection pane="bottomRight"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="18"/>
<cols>${Array.from({ length: cols }, (_, c) => `<col min="${c + 1}" max="${c + 1}" width="${width(c)}" customWidth="1"/>`).join('')}</cols>
<sheetData>${head}${body}</sheetData>
<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>
<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>
</worksheet>`;
}

const cleanSheetName = (name: string, i: number) => esc(name.replace(/[:\\/?*[\]]/g, ' ').slice(0, 31) || `Hoja${i + 1}`);

/** Devuelve los bytes de un archivo .xlsx con una hoja (o con varias, si se pasa una lista). */
export function buildXlsx(input: XlsxTable | XlsxTable[]): Uint8Array {
  const tables = Array.isArray(input) ? input : [input];
  const n = tables.length;
  const files: Record<string, Uint8Array> = {
    '[Content_Types].xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${tables
        .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
        .join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    '_rels/.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    'xl/workbook.xml': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${tables
        .map((t, i) => `<sheet name="${cleanSheetName(t.sheet, i)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
        .join('')}</sheets></workbook>`,
    ),
    'xl/_rels/workbook.xml.rels': strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${tables
        .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
        .join('')}<Relationship Id="rId${n + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    'xl/styles.xml': strToU8(STYLES),
  };
  tables.forEach((t, i) => {
    files[`xl/worksheets/sheet${i + 1}.xml`] = strToU8(sheetXml(t));
  });
  return zipSync(files);
}
