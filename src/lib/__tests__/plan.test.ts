import {
  dropIndex,
  effectiveOrder,
  insertAt,
  itemForPosition,
  moveItem,
  nextSetIndex,
  nextSlot,
  orderByKeys,
  orderUpdates,
  removeAt,
  repsLabel,
  repsRange,
  setLabels,
  targetLabel,
  warmupInsertIndex,
  withSlots,
  type SetRowLike,
} from '../plan';

describe('objetivo de repeticiones', () => {
  it('rango; los datos antiguos solo tienen reps_target (fijo)', () => {
    expect(repsRange({ reps_target: 8 })).toEqual({ min: 8, max: 8 });
    expect(repsRange({ reps_target: 8, reps_min: 6, reps_max: 8 })).toEqual({ min: 6, max: 8 });
    expect(repsRange({ reps_target: 8, reps_min: 9, reps_max: 8 })).toEqual({ min: 8, max: 8 }); // mínimo incoherente: se recorta
  });
  it('etiquetas «3 × 8» y «3 × 6–8»', () => {
    expect(repsLabel(8, 8)).toBe('8');
    expect(repsLabel(6, 8)).toBe('6–8');
    expect(targetLabel(3, { reps_target: 8 })).toBe('3 × 8');
    expect(targetLabel(3, { reps_target: 8, reps_min: 8, reps_max: 8 })).toBe('3 × 8');
    expect(targetLabel(4, { reps_target: 8, reps_min: 6, reps_max: 8 })).toBe('4 × 6–8');
  });
});

type P = { n: string; slot?: number };
const P = (n: string, slot?: number): P => ({ n, slot });

describe('slots de los ejercicios de una sesión', () => {
  it('una sesión antigua (sin slot) usa el índice, que es lo que position significaba', () => {
    expect(withSlots([P('a'), P('b')]).map((p) => p.slot)).toEqual([0, 1]);
  });
  it('respeta los slots existentes y da uno nuevo y único a los que faltan', () => {
    expect(withSlots([P('a', 1), P('b', 0)]).map((p) => p.slot)).toEqual([1, 0]);
    expect(withSlots([P('a', 3), P('b'), P('c')]).map((p) => p.slot)).toEqual([3, 4, 5]);
  });
  it('nextSlot y búsqueda por posición, también tras reordenar', () => {
    const plan = [P('press', 1), P('remo', 0)];
    expect(nextSlot(plan)).toBe(2);
    expect(nextSlot([])).toBe(0);
    expect(itemForPosition(plan, 0)?.n).toBe('remo'); // las series con position 0 siguen siendo del remo
    expect(itemForPosition([P('x'), P('y')], 1)?.n).toBe('y'); // sin slot: índice
    expect(itemForPosition(plan, 7)).toBeUndefined();
  });
});

describe('reordenar', () => {
  it('moveItem', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
    const same = ['a', 'b'];
    expect(moveItem(same, 1, 1)).toBe(same);
    expect(moveItem(['a', 'b', 'c'], 0, 99)).toEqual(['b', 'c', 'a']);
    expect(moveItem(['a', 'b', 'c'], 2, -5)).toEqual(['c', 'a', 'b']);
  });
  it('orderByKeys deja al final lo que no está en la lista', () => {
    const l = [{ k: 'a' }, { k: 'b' }, { k: 'c' }];
    expect(orderByKeys(l, (x) => x.k, ['c', 'a']).map((x) => x.k)).toEqual(['c', 'a', 'b']);
  });
  it('dropIndex: redondea al hueco más cercano y no se sale de la lista', () => {
    expect(dropIndex(2, 0, 56, 5)).toBe(2);
    expect(dropIndex(2, 30, 56, 5)).toBe(3);
    expect(dropIndex(2, 27, 56, 5)).toBe(2);
    expect(dropIndex(2, -60, 56, 5)).toBe(1);
    expect(dropIndex(2, 9999, 56, 5)).toBe(4);
    expect(dropIndex(2, -9999, 56, 5)).toBe(0);
  });
});

describe('series: numeración, inserción y orden', () => {
  const row = (type: SetRowLike['type'], setIndex: number, sortOrder: number | null, dbId: string | null = null): SetRowLike => ({ type, setIndex, sortOrder, dbId });

  it('A para aproximación, D para dropset y las normales numeradas sin contar las demás', () => {
    expect(setLabels([{ type: 'warmup' }, { type: 'warmup' }, { type: 'normal' }, { type: 'dropset' }, { type: 'normal' }, { type: 'dropset' }])).toEqual(['A', 'A', '1', 'D', '2', 'D']);
  });
  it('la aproximación nueva va tras las existentes y antes de las demás', () => {
    expect(warmupInsertIndex([{ type: 'normal' }, { type: 'normal' }])).toBe(0);
    expect(warmupInsertIndex([{ type: 'warmup' }, { type: 'normal' }])).toBe(1);
    expect(warmupInsertIndex([{ type: 'warmup' }, { type: 'warmup' }])).toBe(2);
    expect(warmupInsertIndex([])).toBe(0);
  });
  it('identidad nueva = siguiente set_index libre', () => {
    expect(nextSetIndex([])).toBe(0);
    expect(nextSetIndex([{ setIndex: 0 }, { setIndex: 4 }, { setIndex: 2 }])).toBe(5);
  });
  it('insertAt / removeAt', () => {
    expect(insertAt([1, 2, 3], 1, 9)).toEqual([1, 9, 2, 3]);
    expect(insertAt([1], 1, 9)).toEqual([1, 9]);
    expect(removeAt([1, 2, 3], 1)).toEqual([1, 3]);
  });

  it('insertar una aproximación delante de series guardadas actualiza solo el orden de las guardadas desplazadas', () => {
    const before = [row('normal', 0, 0, 'a'), row('normal', 1, 1, 'b'), row('normal', 2, null)];
    const after = insertAt(before, warmupInsertIndex(before), row('warmup', 3, null));
    expect(orderUpdates(after)).toEqual([
      { dbId: 'a', sortOrder: 1 },
      { dbId: 'b', sortOrder: 2 },
    ]);
  });
  it('un dropset tras la serie 1 desplaza a las guardadas posteriores', () => {
    const before = [row('normal', 0, 0, 'a'), row('normal', 1, 1, 'b'), row('normal', 2, 2, 'c')];
    const after = insertAt(before, 1, row('dropset', 3, null));
    expect(orderUpdates(after)).toEqual([
      { dbId: 'b', sortOrder: 2 },
      { dbId: 'c', sortOrder: 3 },
    ]);
  });
  it('borrar una serie intermedia recoloca las siguientes; borrar la última no toca nada', () => {
    const before = [row('normal', 0, 0, 'a'), row('normal', 1, 1, 'b'), row('normal', 2, 2, 'c')];
    expect(orderUpdates(removeAt(before, 0))).toEqual([
      { dbId: 'b', sortOrder: 0 },
      { dbId: 'c', sortOrder: 1 },
    ]);
    expect(orderUpdates(removeAt(before, 2))).toEqual([]);
  });
  it('las series antiguas (sin sort_order) se ordenan por set_index y no generan escrituras si no se mueven', () => {
    expect(effectiveOrder({ set_index: 3 })).toBe(3);
    expect(effectiveOrder({ set_index: 3, sort_order: 0 })).toBe(0);
    expect(orderUpdates([row('normal', 0, null, 'a'), row('normal', 1, null, 'b')])).toEqual([]);
  });
});
