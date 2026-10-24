import { confirm } from './confirm';
import { deleteAccount } from './profile';

/**
 * Elimina la cuenta y todos sus datos (con confirmación). Devuelve un mensaje de error o null si todo fue bien o
 * si el usuario canceló. `signOut` limpia además los datos guardados en este dispositivo.
 */
export async function runDeleteAccount(signOut: () => Promise<void>): Promise<string | null> {
  const ok = await confirm(
    'Eliminar cuenta',
    'Se borrarán de forma permanente tu cuenta y todos tus datos: perfil, entrenos, dieta, medidas y fotos. Esta acción no se puede deshacer. Si quieres conservar algo, exporta tus datos antes.',
    'Eliminar todo',
    true,
  );
  if (!ok) return null;
  try {
    await deleteAccount();
  } catch {
    return 'No se pudo eliminar la cuenta. Comprueba tu conexión e inténtalo de nuevo.';
  }
  await signOut();
  return null;
}
