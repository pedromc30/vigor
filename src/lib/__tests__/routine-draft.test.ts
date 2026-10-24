import { draftToInput, validateDraft, type RoutineDraft } from '../routine-draft';

const item = (over: Partial<RoutineDraft['days'][0]['items'][0]> = {}) => ({
  key: 'k',
  exercise: { id: 'e1', name: 'Press de banca con barra', muscle_group: 'pecho' as const },
  sets: '3',
  reps: '8',
  rest: '90',
  notes: '',
  ...over,
});

const base = (): RoutineDraft => ({
  id: null,
  name: 'Empuje',
  notes: '',
  days: [{ name: 'Día 1', weekday: 1, items: [item()] }],
});

describe('validateDraft', () => {
  it('acepta un borrador correcto', () => {
    expect(validateDraft(base())).toBeNull();
  });
  it('exige nombre', () => {
    expect(validateDraft({ ...base(), name: ' a ' })).toMatch(/nombre/);
  });
  it('exige ejercicios en cada día', () => {
    const d = base();
    d.days[0].items = [];
    expect(validateDraft(d)).toMatch(/no tiene ejercicios/);
  });
  it('valida series, repeticiones y descanso', () => {
    const d = base();
    d.days[0].items = [item({ sets: '0' })];
    expect(validateDraft(d)).toMatch(/Series/);
    d.days[0].items = [item({ reps: 'ocho' })];
    expect(validateDraft(d)).toMatch(/Repeticiones/);
    d.days[0].items = [item({ rest: '1000' })];
    expect(validateDraft(d)).toMatch(/Descanso/);
    d.days[0].items = [item({ rest: '0' })];
    expect(validateDraft(d)).toBeNull();
  });
});

describe('draftToInput', () => {
  it('numera días y posiciones y convierte los números', () => {
    const d = base();
    d.days.push({ name: 'Día 2', weekday: 0, items: [item({ sets: '4' }), item({ reps: '12' })] });
    const input = draftToInput(d);
    expect(input.dayNames).toEqual(['Día 1', 'Día 2']);
    expect(input.schedule).toEqual([1, 0]);
    expect(input.items.map((i) => [i.day_index, i.position])).toEqual([
      [0, 0],
      [1, 0],
      [1, 1],
    ]);
    expect(input.items[1].sets).toBe(4);
    expect(input.items[2].reps_target).toBe(12);
  });
});
