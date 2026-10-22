import { useState } from 'react';
import { useRouter } from 'expo-router';
import { supabase } from '../../src/lib/supabase';
import { PASSWORD_MIN_LENGTH, isValidEmail, translateAuthError } from '../../src/lib/validation';
import { Button, ErrorText, Screen, Text, TextField } from '../../src/components/ui';

export default function Register() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    setNotice(null);
    if (!isValidEmail(email)) return setError('Introduce un email válido.');
    if (password.length < PASSWORD_MIN_LENGTH) return setError(`La contraseña debe tener al menos ${PASSWORD_MIN_LENGTH} caracteres.`);
    if (password !== confirm) return setError('Las contraseñas no coinciden.');

    setBusy(true);
    const { data, error: err } = await supabase.auth.signUp({ email: email.trim(), password });
    setBusy(false);
    if (err) return setError(translateAuthError(err.message));
    // Con confirmación de email activada no hay sesión hasta pulsar el enlace.
    if (!data.session) setNotice('Te hemos enviado un email de confirmación. Ábrelo y vuelve para iniciar sesión.');
  };

  return (
    <Screen>
      <Text variant="title">Crear cuenta</Text>
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
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <TextField label="Repite la contraseña" value={confirm} onChangeText={setConfirm} secureTextEntry autoComplete="new-password" />
      <ErrorText>{error}</ErrorText>
      {notice ? <Text>{notice}</Text> : null}
      <Button title="Registrarme" onPress={submit} loading={busy} />
      <Button title="Ya tengo cuenta" variant="ghost" onPress={() => router.replace('/login')} />
    </Screen>
  );
}
