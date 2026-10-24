// Recordatorios: ajustes y construcción de la lista de avisos (lógica pura, sin depender de expo-notifications).

export interface ReminderSettings {
  workout: { on: boolean; time: string };
  meals: { on: boolean; breakfast: string; lunch: string; dinner: string };
  water: { on: boolean; everyHours: number; from: string; to: string };
  weighIn: { on: boolean; weekday: number; time: string };
}

export const DEFAULT_REMINDERS: ReminderSettings = {
  workout: { on: false, time: '18:00' },
  meals: { on: false, breakfast: '08:30', lunch: '14:00', dinner: '21:00' },
  water: { on: false, everyHours: 3, from: '09:00', to: '21:00' },
  weighIn: { on: false, weekday: 1, time: '08:00' },
};

export interface PlannedReminder {
  id: string;
  title: string;
  body: string;
  /** Día de la semana ISO (1 = lunes … 7 = domingo); null = todos los días. */
  weekday: number | null;
  hour: number;
  minute: number;
}

export function parseTime(text: string): { hour: number; minute: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

export const formatTime = (hour: number, minute: number) => `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/** Convierte un día ISO (1 = lunes) al que usa Expo (1 = domingo). */
export const expoWeekday = (isoDay: number) => (isoDay % 7) + 1;

export function hasAnyReminder(s: ReminderSettings): boolean {
  return s.workout.on || s.meals.on || s.water.on || s.weighIn.on;
}

/** Devuelve el primer error de validación de los ajustes (solo de los avisos activados) o null. */
export function validateReminders(s: ReminderSettings): string | null {
  const bad = (t: string) => parseTime(t) === null;
  if (s.workout.on && bad(s.workout.time)) return 'La hora del entreno no es válida (usa HH:MM, por ejemplo 18:00).';
  if (s.meals.on && (bad(s.meals.breakfast) || bad(s.meals.lunch) || bad(s.meals.dinner))) return 'Alguna hora de comida no es válida (usa HH:MM).';
  if (s.water.on) {
    const f = parseTime(s.water.from);
    const t = parseTime(s.water.to);
    if (!f || !t) return 'Las horas del recordatorio de agua no son válidas (usa HH:MM).';
    if (f.hour * 60 + f.minute > t.hour * 60 + t.minute) return 'En el agua, la hora de inicio debe ser anterior a la de fin.';
  }
  if (s.weighIn.on && bad(s.weighIn.time)) return 'La hora del pesaje no es válida (usa HH:MM).';
  return null;
}

/**
 * Lista de avisos a programar según los ajustes. `trainingWeekdays` son los días ISO con entreno
 * programado en tus rutinas; si no tienes ninguno no se programa el aviso de entreno.
 */
export function buildReminders(s: ReminderSettings, trainingWeekdays: number[]): PlannedReminder[] {
  const out: PlannedReminder[] = [];
  const at = (t: string) => parseTime(t) ?? { hour: 0, minute: 0 };

  if (s.workout.on) {
    const { hour, minute } = at(s.workout.time);
    for (const d of [...new Set(trainingWeekdays)].sort()) {
      out.push({ id: `workout-${d}`, title: 'Hoy toca entrenar', body: 'Abre Vigor y empieza tu sesión.', weekday: d, hour, minute });
    }
  }
  if (s.meals.on) {
    const meals: [string, string, string][] = [
      ['breakfast', s.meals.breakfast, 'Desayuno'],
      ['lunch', s.meals.lunch, 'Comida'],
      ['dinner', s.meals.dinner, 'Cena'],
    ];
    for (const [key, time, name] of meals) {
      const { hour, minute } = at(time);
      out.push({ id: `meal-${key}`, title: `Hora de: ${name.toLowerCase()}`, body: 'Registra lo que comas para llevar tu diario al día.', weekday: null, hour, minute });
    }
  }
  if (s.water.on && s.water.everyHours >= 1) {
    const from = at(s.water.from);
    const to = at(s.water.to);
    const end = to.hour * 60 + to.minute;
    for (let m = from.hour * 60 + from.minute, i = 0; m <= end && i < 24; m += s.water.everyHours * 60, i++) {
      const hour = Math.floor(m / 60);
      const minute = m % 60;
      out.push({ id: `water-${formatTime(hour, minute)}`, title: 'Bebe agua', body: 'Un vaso de agua ahora te acerca a tu objetivo de hoy.', weekday: null, hour, minute });
    }
  }
  if (s.weighIn.on) {
    const { hour, minute } = at(s.weighIn.time);
    out.push({ id: 'weigh-in', title: 'Pesaje semanal', body: 'Pésate en las mismas condiciones de siempre y regístralo en Vigor.', weekday: s.weighIn.weekday, hour, minute });
  }
  return out;
}
