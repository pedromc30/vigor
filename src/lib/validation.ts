export const LIMITS = {
  age: { min: 18, max: 100 },
  heightCm: { min: 120, max: 230 },
  weightKg: { min: 30, max: 300 },
  kcal: { min: 500, max: 10000 },
} as const;

/** Acepta coma o punto decimal ("70,5"). Devuelve null si no es un número válido. */
export function parseDecimal(text: string): number | null {
  const normalized = text.trim().replace(',', '.');
  if (normalized === '' || !/^\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
}

export function rangeError(value: number | null, min: number, max: number, unit = ''): string | null {
  if (value === null) return 'Introduce un número válido';
  if (value < min || value > max) return `Debe estar entre ${min} y ${max}${unit ? ' ' + unit : ''}`;
  return null;
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const PASSWORD_MIN_LENGTH = 8;

export function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return 'Email o contraseña incorrectos.';
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con ese email.';
  if (m.includes('email not confirmed')) return 'Confirma tu email antes de iniciar sesión.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Demasiados intentos. Espera un momento e inténtalo de nuevo.';
  if (m.includes('network') || m.includes('fetch')) return 'Sin conexión. Comprueba tu red e inténtalo de nuevo.';
  if (m.includes('password')) return 'La contraseña no cumple los requisitos.';
  return 'Ha ocurrido un error. Inténtalo de nuevo.';
}
