// Generación de CSV (RFC 4180) con las dos variantes habituales en España.

export type Cell = string | number | boolean | null | undefined;

export interface CsvFormat {
  /** «,» estándar o «;» (el que espera Excel con configuración regional española). */
  separator: ',' | ';';
  /** Escribe los decimales con coma (para Excel en español). */
  decimalComma: boolean;
}

export const CSV_STANDARD: CsvFormat = { separator: ',', decimalComma: false };
export const CSV_EXCEL_ES: CsvFormat = { separator: ';', decimalComma: true };

const BOM = '﻿'; // para que Excel reconozca UTF-8 (tildes, ñ)

/**
 * Evita la inyección de fórmulas: un texto que empieza por = + - @ (o tabulador/retorno) se interpretaría como
 * fórmula al abrirlo en una hoja de cálculo, así que se antepone una comilla simple.
 */
function neutralize(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function format(cell: Cell, f: CsvFormat): string {
  if (cell == null) return '';
  if (typeof cell === 'number') {
    if (!Number.isFinite(cell)) return '';
    const s = String(cell);
    return f.decimalComma ? s.replace('.', ',') : s;
  }
  if (typeof cell === 'boolean') return cell ? 'true' : 'false';
  return neutralize(cell);
}

function escape(value: string, f: CsvFormat): string {
  return value.includes(f.separator) || /["\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function toCsv(headers: string[], rows: Cell[][], f: CsvFormat = CSV_STANDARD): string {
  const lines = [headers, ...rows].map((r, i) => r.map((c) => escape(i === 0 ? String(c) : format(c, f), f)).join(f.separator));
  return BOM + lines.join('\r\n') + '\r\n';
}
