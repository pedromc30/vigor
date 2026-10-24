import { useState } from 'react';
import { Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Disclaimer, ErrorText, Screen, Text } from '../src/components/ui';
import { runDeleteAccount } from '../src/lib/account';
import { LEGAL } from '../src/lib/legal';
import { useAuth } from '../src/providers/AuthProvider';
import { spacing } from '../src/theme';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <Text variant="heading">{title}</Text>
      {children}
    </Card>
  );
}

export default function Privacy() {
  const router = useRouter();
  const { profile, session, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const consent = profile?.health_consent_at
    ? `Diste tu consentimiento el ${new Date(profile.health_consent_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })} (versión ${profile.consent_version ?? '—'}).`
    : 'No consta un consentimiento registrado.';

  const remove = async () => {
    setDeleting(true);
    setError(null);
    const msg = await runDeleteAccount(signOut);
    if (msg) setError(msg);
    setDeleting(false);
  };

  return (
    <Screen>
      <Text variant="title">Privacidad y datos</Text>
      <Text muted>Qué guarda Vigor, para qué y cómo ejercer tus derechos. Resumen orientativo en lenguaje sencillo.</Text>

      <Section title="Quién es el responsable">
        {LEGAL.controller ? (
          <Text>
            {LEGAL.controller}
            {LEGAL.email ? ` · ${LEGAL.email}` : ''}
          </Text>
        ) : (
          <Text muted>Los datos de contacto del responsable los debe indicar quien publique esta aplicación.</Text>
        )}
        {LEGAL.email ? (
          <Button title="Escribir al responsable" variant="secondary" onPress={() => void Linking.openURL(`mailto:${LEGAL.email}`)} />
        ) : null}
      </Section>

      <Section title="Qué datos guardamos">
        <Text>
          Tu email para la cuenta y, con tu consentimiento, datos de salud: sexo, edad, altura, peso, nivel de actividad, objetivo, alergias y preferencias de
          dieta; tus entrenos, tu diario de comidas y agua, tus medidas corporales y las fotos de progreso que subas.
        </Text>
        <Text muted>Cuenta registrada: {session?.user.email ?? '—'}</Text>
      </Section>

      <Section title="Para qué los usamos">
        <Text>
          Solo para ofrecerte la aplicación: calcular tus objetivos, registrar y mostrar tu progreso y hacer sugerencias que tú decides aceptar. No
          hay publicidad ni analítica de terceros y tus datos no se venden ni se ceden.
        </Text>
        <Text variant="caption" muted>
          Excepción: al buscar un alimento o escanear un código, el texto o el código se envía a Open Food Facts, un servicio de terceros, que verá tu
          dirección IP. No se le envía nada más.
        </Text>
      </Section>

      <Section title="Tu consentimiento">
        <Text>{consent}</Text>
        <Text variant="caption" muted>
          Los datos de salud se tratan porque tú das tu consentimiento explícito (art. 9.2.a del RGPD). Puedes retirarlo en cualquier momento: la forma de
          hacerlo es eliminar tu cuenta, porque sin esos datos la aplicación no puede funcionar.
        </Text>
      </Section>

      <Section title="Dónde y cómo se guardan">
        <Text>
          Tus datos están en Supabase (base de datos, autenticación y archivos), con conexión cifrada. Cada cuenta solo puede acceder a sus propios datos y
          las fotos están en un espacio privado, visibles solo con enlaces temporales.
        </Text>
        <Text variant="caption" muted>
          Para funcionar sin conexión, la app guarda en este dispositivo una copia de lo que consultas y de los cambios aún sin enviar. Esa copia se
          protege con el sistema del móvil (no se cifra de forma adicional) y se borra al cerrar sesión o eliminar la cuenta.
        </Text>
      </Section>

      <Section title="Tus derechos">
        <Text>
          • Acceso y portabilidad: exporta tus datos en CSV.{'\n'}• Rectificación: edita tus datos y objetivos en Perfil.{'\n'}• Supresión: elimina tu cuenta
          y todos tus datos.{'\n'}• Limitación y oposición: escribe al responsable.{'\n'}• Reclamación: puedes acudir a la Agencia Española de Protección de
          Datos (aepd.es).
        </Text>
        <Button title="Exportar mis datos (CSV)" variant="secondary" onPress={() => router.push('/export')} />
      </Section>

      <Disclaimer />

      <ErrorText>{error}</ErrorText>
      <Button title="Eliminar mi cuenta y todos mis datos" variant="danger" onPress={() => void remove()} loading={deleting} />
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
      <Text style={{ height: spacing.sm }}> </Text>
    </Screen>
  );
}
