import { parseMetricsForm, type MetricKey } from '../metrics-form';

const empty: Record<MetricKey, string> = { weight_kg: '', waist_cm: '', hip_cm: '', arm_cm: '', thigh_cm: '' };

describe('parseMetricsForm', () => {
  it('acepta coma decimal y omite los campos vacíos', () => {
    expect(parseMetricsForm({ ...empty, weight_kg: '80,45', waist_cm: ' 85 ' })).toEqual({ values: { weight_kg: 80.5, waist_cm: 85 } });
  });
  it('exige al menos una medida', () => {
    expect(parseMetricsForm(empty)).toEqual({ error: 'Rellena al menos una medida.' });
  });
  it('rechaza valores fuera de rango o no numéricos con un mensaje claro', () => {
    expect(parseMetricsForm({ ...empty, weight_kg: '5' })).toEqual({ error: 'Peso: introduce un número entre 30 y 300 kg.' });
    expect(parseMetricsForm({ ...empty, arm_cm: '101' })).toMatchObject({ error: expect.stringContaining('Brazo') });
    expect(parseMetricsForm({ ...empty, thigh_cm: 'abc' })).toMatchObject({ error: expect.stringContaining('Muslo') });
    expect(parseMetricsForm({ ...empty, hip_cm: '-3' })).toMatchObject({ error: expect.stringContaining('Cadera') });
  });
});
