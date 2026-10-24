/**
 * Datos del responsable del tratamiento. Quien publique la app debe indicarlos en el archivo .env
 * (EXPO_PUBLIC_LEGAL_NAME y EXPO_PUBLIC_LEGAL_EMAIL) antes de distribuirla.
 */
export const LEGAL = {
  controller: (process.env.EXPO_PUBLIC_LEGAL_NAME ?? '').trim(),
  email: (process.env.EXPO_PUBLIC_LEGAL_EMAIL ?? '').trim(),
};
