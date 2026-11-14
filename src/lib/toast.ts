// Mensajes breves de confirmación («Comida añadida al diario»). Lo muestra `ToastHost`, montado una sola vez en la raíz.
type Listener = (message: string) => void;
const listeners = new Set<Listener>();

export function showToast(message: string): void {
  listeners.forEach((l) => l(message));
}

export function subscribeToast(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
