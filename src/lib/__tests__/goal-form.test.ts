import { parseGoalForm } from '../goal-form';

describe('parseGoalForm', () => {
  it('objetivo de carga: carga y repeticiones mínimas', () => {
    expect(parseGoalForm({ kind: 'weight', weight: '100', reps: '1' })).toEqual({ values: { kind: 'weight', target_weight_kg: 100, target_reps: 1 } });
    expect(parseGoalForm({ kind: 'weight', weight: '62,5', reps: '3' })).toEqual({ values: { kind: 'weight', target_weight_kg: 62.5, target_reps: 3 } });
  });
  it('objetivo de carga: la carga es obligatoria y mayor que 0', () => {
    expect(parseGoalForm({ kind: 'weight', weight: '', reps: '1' })).toHaveProperty('error');
    expect(parseGoalForm({ kind: 'weight', weight: '0', reps: '1' })).toHaveProperty('error');
    expect(parseGoalForm({ kind: 'weight', weight: '1001', reps: '1' })).toHaveProperty('error');
    expect(parseGoalForm({ kind: 'weight', weight: 'cien', reps: '1' })).toHaveProperty('error');
  });
  it('objetivo de repeticiones: carga vacía o 0 = peso corporal', () => {
    expect(parseGoalForm({ kind: 'reps', weight: '', reps: '12' })).toEqual({ values: { kind: 'reps', target_weight_kg: 0, target_reps: 12 } });
    expect(parseGoalForm({ kind: 'reps', weight: '0', reps: '12' })).toEqual({ values: { kind: 'reps', target_weight_kg: 0, target_reps: 12 } });
    expect(parseGoalForm({ kind: 'reps', weight: '80', reps: '8' })).toEqual({ values: { kind: 'reps', target_weight_kg: 80, target_reps: 8 } });
    expect(parseGoalForm({ kind: 'reps', weight: '-5', reps: '8' })).toHaveProperty('error');
  });
  it('las repeticiones son un entero de 1 a 200', () => {
    for (const reps of ['', '0', '201', '2,5', 'x']) expect(parseGoalForm({ kind: 'reps', weight: '', reps })).toHaveProperty('error');
    expect(parseGoalForm({ kind: 'reps', weight: '', reps: '200' })).toHaveProperty('values');
  });
});
