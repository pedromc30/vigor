import { DEFAULT_REMINDERS, buildReminders, expoWeekday, parseTime, validateReminders, type ReminderSettings } from '../reminders';

const on = (patch: Partial<ReminderSettings>): ReminderSettings => ({ ...DEFAULT_REMINDERS, ...patch });

describe('parseTime', () => {
  it('acepta HH:MM válidas', () => {
    expect(parseTime('08:30')).toEqual({ hour: 8, minute: 30 });
    expect(parseTime('8:05')).toEqual({ hour: 8, minute: 5 });
    expect(parseTime('23:59')).toEqual({ hour: 23, minute: 59 });
  });
  it('rechaza el resto', () => {
    for (const t of ['24:00', '12:60', '1230', 'a:b', '', '12:5']) expect(parseTime(t)).toBeNull();
  });
});

describe('expoWeekday', () => {
  it('convierte ISO (1 = lunes) a Expo (1 = domingo)', () => {
    expect([1, 2, 6, 7].map(expoWeekday)).toEqual([2, 3, 7, 1]);
  });
});

describe('buildReminders', () => {
  it('sin nada activado no programa nada', () => {
    expect(buildReminders(DEFAULT_REMINDERS, [1, 3])).toEqual([]);
  });
  it('entreno: un aviso por cada día programado, sin duplicados', () => {
    const r = buildReminders(on({ workout: { on: true, time: '18:30' } }), [3, 1, 3]);
    expect(r.map((x) => [x.weekday, x.hour, x.minute])).toEqual([[1, 18, 30], [3, 18, 30]]);
  });
  it('entreno sin días programados no genera avisos', () => {
    expect(buildReminders(on({ workout: { on: true, time: '18:00' } }), [])).toEqual([]);
  });
  it('comidas: tres avisos diarios', () => {
    const r = buildReminders(on({ meals: { on: true, breakfast: '08:00', lunch: '14:00', dinner: '21:30' } }), []);
    expect(r.map((x) => [x.weekday, x.hour, x.minute])).toEqual([[null, 8, 0], [null, 14, 0], [null, 21, 30]]);
  });
  it('agua: cada N horas entre inicio y fin (ambos incluidos)', () => {
    const r = buildReminders(on({ water: { on: true, everyHours: 3, from: '09:00', to: '21:00' } }), []);
    expect(r.map((x) => x.hour)).toEqual([9, 12, 15, 18, 21]);
    const r2 = buildReminders(on({ water: { on: true, everyHours: 4, from: '09:30', to: '20:00' } }), []);
    expect(r2.map((x) => `${x.hour}:${x.minute}`)).toEqual(['9:30', '13:30', '17:30']);
  });
  it('pesaje semanal', () => {
    const r = buildReminders(on({ weighIn: { on: true, weekday: 1, time: '07:45' } }), []);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ weekday: 1, hour: 7, minute: 45 });
  });
  it('los ids son únicos', () => {
    const r = buildReminders(
      { workout: { on: true, time: '18:00' }, meals: { on: true, breakfast: '08:00', lunch: '14:00', dinner: '21:00' }, water: { on: true, everyHours: 2, from: '09:00', to: '21:00' }, weighIn: { on: true, weekday: 7, time: '09:00' } },
      [1, 2, 4, 5],
    );
    expect(new Set(r.map((x) => x.id)).size).toBe(r.length);
  });
});

describe('validateReminders', () => {
  it('ignora los avisos desactivados aunque su hora sea inválida', () => {
    expect(validateReminders(on({ workout: { on: false, time: 'zz' } }))).toBeNull();
  });
  it('detecta horas inválidas y rangos al revés en los activados', () => {
    expect(validateReminders(on({ workout: { on: true, time: '25:00' } }))).toMatch(/entreno/);
    expect(validateReminders(on({ water: { on: true, everyHours: 2, from: '21:00', to: '09:00' } }))).toMatch(/anterior/);
  });
});
