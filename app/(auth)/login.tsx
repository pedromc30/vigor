import { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { isValidEmail, translateAuthError } from '../../src/lib/validation';
import { Button, ErrorText, Screen, Text, TextField } from '../../src/components/ui';

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!isValidEmail(email) || !password) {
      setError('Introduce tu email y tu contraseña.');
      return;
    }
    setBusy(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError(translateAuthError(err.message));
  };

  return (
    <Screen>
      <Text variant="title">Vigor</Text>
      <Text muted>Entrenamiento y dieta en una sola app.</Text>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
      />
      <ErrorText>{error}</ErrorText>
      <Button title="Iniciar sesión" onPress={submit} loading={busy} />
      <Button title="Crear cuenta" variant="ghost" onPress={() => router.replace('/register')} />
    </Screen>
  );
}
