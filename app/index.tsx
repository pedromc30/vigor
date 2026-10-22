import { Redirect } from 'expo-router';
import { useAuth } from '../src/providers/AuthProvider';

/** Punto de entrada: envía al usuario a la pantalla que le corresponde según su estado. */
export default function Index() {
  const { session, onboarded } = useAuth();
  if (!session) return <Redirect href="/login" />;
  if (!onboarded) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
