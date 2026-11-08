import { averageOfDays, cleanDayTargets, targetsForDate, targetsForWeekday } from '../day-targets';

const general = { target_kcal: 2669, target_protein_g: 205, target_carbs_g: 303, target_fat_g: 65 };
const lunes = { kcal: 2860, protein_g: 217, carbs_g: 358, fat_g: 57 };
const sabado = { kcal: 2340, protein_g: 200, carbs_g: 197, fat_g: 77 };

describe('cleanDayTargets', () => {
  it('acepta días 1-7 bien formados y redondea', () => {
    expect(cleanDayTargets({ '1': { ...lunes, kcal: 2860.4 }, '6': sabado })).toEqual({ '1': lunes, '6': sabado });
  });
  it('descarta lo mal formado, y devuelve null si no queda nada', () => {
    expect(cleanDayTargets({ '0': lunes, '8': lunes, x: lunes, '2': { kcal: 'mucho' }, '3': { ...lunes, kcal: 100 }, '4': { ...lunes, protein_g: -1 }, '5': null })).toBeNull();
    expect(cleanDayTargets({ '1': lunes, '2': { kcal: 99999, protein_g: 1, carbs_g: 1, fat_g: 1 } })).toEqual({ '1': lunes });
    for (const v of [null, undefined, 'x', 3, [], [lunes]]) expect(cleanDayTargets(v)).toBeNull();
  });
});

describe('targetsForWeekday / targetsForDate', () => {
  const profile = { ...general, day_targets: { '1': lunes, '6': sabado } };
  it('usa el objetivo del día si existe', () => {
    expect(targetsForWeekday(profile, 1)).toEqual({ ...lunes, perDay: true });
    expect(targetsForWeekday(profile, 6)).toEqual({ ...sabado, perDay: true });
  });
  it('si ese día no tiene objetivo propio, usa el general', () => {
    expect(targetsForWeekday(profile, 3)).toEqual({ kcal: 2669, protein_g: 205, carbs_g: 303, fat_g: 65, perDay: false });
  });
  it('sin objetivos por día o sin perfil', () => {
    expect(targetsForWeekday({ ...general, day_targets: null }, 1).perDay).toBe(false);
    expect(targetsForWeekday(null, 1)).toEqual({ kcal: null, protein_g: null, carbs_g: null, fat_g: null, perDay: false });
  });
  it('por fecha: 2026-11-07 es sábado y 2026-11-09 es lunes', () => {
    expect(targetsForDate(profile, '2026-11-07').kcal).toBe(2340);
    expect(targetsForDate(profile, '2026-11-09').kcal).toBe(2860);
    expect(targetsForDate(profile, '2026-11-08').kcal).toBe(2669); // domingo sin objetivo propio
  });
});

describe('averageOfDays', () => {
  it('media de los días con objetivo', () => {
    expect(averageOfDays({ '1': lunes, '6': sabado })).toEqual({ kcal: 2600, protein_g: 209, carbs_g: 278, fat_g: 67 });
  });
});
