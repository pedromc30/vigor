import type { MetricValues } from './progress';
import { parseDecimal } from './validation';

export const METRIC_FIELDS = [
  { key: 'weight_kg', label: 'Peso', unit: 'kg', min: 30, max: 300 },
  { key: 'waist_cm', label: 'Cintura', unit: 'cm', min: 30, max: 250 },
  { key: 'hip_cm', label: 'Cadera', unit: 'cm', min: 30, max: 250 },
  { key: 'arm_cm', label: 'Brazo', unit: 'cm', min: 10, max: 100 },
  { key: 'thigh_cm', label: 'Muslo', unit: 'cm', min: 20, max: 150 },
] as const;

export type MetricKey = (typeof METRIC_FIELDS)[number]['key'];

/**
 * Convierte el formulario (textos) en valores. Los campos vacíos se omiten (así no se borra lo que ya
 * estuviera guardado ese día). Devuelve un error si algún valor es inválido o si no hay ninguno.
 */
export function parseMetricsForm(form: Record<MetricKey, string>): { values: MetricValues } | { error: string } {
  const values: MetricValues = {};
  for (const f of METRIC_FIELDS) {
    const text = form[f.key].trim();
    if (!text) continue;
    const n = parseDecimal(text);
    if (n === null || n < f.min || n > f.max) return { error: `${f.label}: introduce un número entre ${f.min} y ${f.max} ${f.unit}.` };
    values[f.key] = Math.round(n * 10) / 10;
  }
  if (!Object.keys(values).length) return { error: 'Rellena al menos una medida.' };
  return { values };
}
