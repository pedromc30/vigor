import { draftToInput, repsFields, validateDraft, type RoutineDraft } from '../routine-draft';

const item = (over: Partial<RoutineDraft['days'][0]['items'][0]> = {}) => ({
  key: 'k',
  exercise: { id: 'e1', name: 'Press de banca con barra', muscle_group: 'pecho' as const },
  sets: '3',
  repsMode: 'fixed' as const,
  reps: '8',
  repsMin: '8',
  repsMax: '8',
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

describe('repeticiones fijas o en rango', () => {
  const withItem = (over: Parameters<typeof item>[0]): RoutineDraft => {
    const d = base();
    d.days[0].items = [item(over)];
    return d;
  };

  it('repsFields: mínimo = máximo es fijo; distintos, rango', () => {
    expect(repsFields(8, 8)).toEqual({ repsMode: 'fixed', reps: '8', repsMin: '8', repsMax: '8' });
    expect(repsFields(6, 8)).toEqual({ repsMode: 'range', reps: '8', repsMin: '6', repsMax: '8' });
  });

  it('modo fijo guarda reps_min = reps_max = reps_target', () => {
    const [it] = draftToInput(withItem({ reps: '12' })).items;
    expect([it.reps_min, it.reps_max, it.reps_target]).toEqual([12, 12, 12]);
  });

  it('modo rango guarda mínimo y máximo, y reps_target = máximo', () => {
    const [it] = draftToInput(withItem({ repsMode: 'range', repsMin: '6', repsMax: '8', reps: '99' })).items;
    expect([it.reps_min, it.reps_max, it.reps_target]).toEqual([6, 8, 8]);
  });

  it('en modo rango el campo de repeticiones fijas se ignora (y al revés)', () => {
    expect(validateDraft(withItem({ repsMode: 'range', repsMin: '6', repsMax: '8', reps: 'x' }))).toBeNull();
    expect(validateDraft(withItem({ repsMode: 'fixed', repsMin: 'x', repsMax: 'y' }))).toBeNull();
  });

  it('valida el rango', () => {
    expect(validateDraft(withItem({ repsMode: 'range', repsMin: '9', repsMax: '8' }))).toMatch(/mínimo no puede ser mayor/);
    expect(validateDraft(withItem({ repsMode: 'range', repsMin: '', repsMax: '8' }))).toMatch(/Rango de repeticiones/);
    expect(validateDraft(withItem({ repsMode: 'range', repsMin: '0', repsMax: '8' }))).toMatch(/Rango de repeticiones/);
    expect(validateDraft(withItem({ repsMode: 'range', repsMin: '6', repsMax: '101' }))).toMatch(/Rango de repeticiones/);
    expect(validateDraft(withItem({ repsMode: 'range', repsMin: '8', repsMax: '8' }))).toBeNull();
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
