import { DEFAULT_TRAINING_SLOT, TRAINING_SLOTS, dayEvents, isTrainingSlot, slotLabel } from '../day-order';

const names = (slot: unknown) => dayEvents(slot).map((e) => (e.kind === 'training' ? 'entreno' : e.meal));

describe('dayEvents', () => {
  it('por defecto el entreno va después de la merienda', () => {
    expect(DEFAULT_TRAINING_SLOT).toBe('merienda');
    expect(names(undefined)).toEqual(['desayuno', 'snacks', 'comida', 'merienda', 'entreno', 'cena']);
  });
  it('al principio, después de cada comida y al final; las comidas no cambian de orden', () => {
    expect(names('start')).toEqual(['entreno', 'desayuno', 'snacks', 'comida', 'merienda', 'cena']);
    expect(names('desayuno')).toEqual(['desayuno', 'entreno', 'snacks', 'comida', 'merienda', 'cena']);
    expect(names('comida')).toEqual(['desayuno', 'snacks', 'comida', 'entreno', 'merienda', 'cena']);
    expect(names('cena')).toEqual(['desayuno', 'snacks', 'comida', 'merienda', 'cena', 'entreno']);
  });
  it('siempre aparece una sola vez, y un valor guardado desconocido usa el predeterminado', () => {
    for (const s of TRAINING_SLOTS) expect(names(s).filter((n) => n === 'entreno')).toHaveLength(1);
    for (const bad of ['mañana', 42, null, {}]) expect(names(bad)).toEqual(names(DEFAULT_TRAINING_SLOT));
  });
});

describe('isTrainingSlot / slotLabel', () => {
  it('reconoce los valores válidos', () => {
    expect(TRAINING_SLOTS.every(isTrainingSlot)).toBe(true);
    expect(isTrainingSlot('postre')).toBe(false);
  });
  it('etiquetas legibles', () => {
    expect(slotLabel('start')).toBe('Antes del desayuno');
    expect(slotLabel('cena')).toBe('Después de la cena (al final)');
    expect(slotLabel('comida')).toBe('Después de la comida');
    expect(slotLabel('snacks')).toBe('Después de la media mañana');
  });
});
