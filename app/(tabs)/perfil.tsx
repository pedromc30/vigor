import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../src/providers/AuthProvider';
import { runDeleteAccount } from '../../src/lib/account';
import { confirmSignOut } from '../../src/lib/offline/session';
import { ACTIVITY_LABELS, DIET_LABELS, GOAL_LABELS, SEX_LABELS, ALLERGEN_OPTIONS } from '../../src/lib/labels';
import { MacroRow } from '../../src/components/plan-summary';
import { Button, Card, Disclaimer, ErrorText, Screen, Text } from '../../src/components/ui';

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text>
      <Text muted>{label}: </Text>
      {value}
    </Text>
  );
}

export default function Perfil() {
  const router = useRouter();
  const { session, profile, signOut } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const allergyNames = profile.allergies.map((a) => ALLERGEN_OPTIONS.find((o) => o.key === a)?.label ?? a);

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    const msg = await runDeleteAccount(signOut);
    if (msg) setError(msg);
    setDeleting(false);
  };

  return (
    <Screen>
      <Text variant="title">Perfil</Text>
      <Text muted>{session?.user.email}</Text>

      <Card>
        <Text variant="heading">Mis datos</Text>
        <Row label="Sexo" value={profile.sex ? SEX_LABELS[profile.sex] : '—'} />
        <Row label="Edad" value={profile.age != null ? `${profile.age} años` : '—'} />
        <Row label="Altura" value={profile.height_cm != null ? `${profile.height_cm} cm` : '—'} />
        <Row label="Peso" value={profile.weight_kg != null ? `${profile.weight_kg} kg` : '—'} />
        <Row label="Actividad" value={profile.activity_level ? ACTIVITY_LABELS[profile.activity_level].title : '—'} />
        <Row label="Objetivo" value={profile.goal ? GOAL_LABELS[profile.goal].title : '—'} />
        <Row label="Días de entreno" value={profile.training_days_per_week != null ? `${profile.training_days_per_week} / semana` : '—'} />
        <Row label="Dieta" value={profile.diet_preference ? DIET_LABELS[profile.diet_preference] : '—'} />
        <Row label="Alergias" value={allergyNames.length ? allergyNames.join(', ') : 'Ninguna'} />
        <Button title="Editar datos" variant="secondary" onPress={() => router.push('/edit-profile')} />
      </Card>

      <Card>
        <Text variant="heading">Objetivos diarios</Text>
        <Text variant="title">{profile.target_kcal ?? '—'} kcal</Text>
        <MacroRow
          proteinG={profile.target_protein_g ?? 0}
          fatG={profile.target_fat_g ?? 0}
          carbsG={profile.target_carbs_g ?? 0}
        />
        <Text variant="caption" muted>
          {profile.targets_manual ? 'Editados manualmente.' : 'Calculados automáticamente (Mifflin-St Jeor).'}
        </Text>
        <Button title="Editar objetivos" variant="secondary" onPress={() => router.push('/edit-targets')} />
      </Card>

      <Button title="Recordatorios" variant="secondary" onPress={() => router.push('/reminders')} />
      <Button title="Exportar datos (CSV)" variant="secondary" onPress={() => router.push('/export')} />
      <Button title="Privacidad y datos" variant="secondary" onPress={() => router.push('/privacy')} />

      <Disclaimer />

      <ErrorText>{error}</ErrorText>
      <Button title="Cerrar sesión" variant="secondary" onPress={() => void confirmSignOut().then((ok) => { if (ok) void signOut(); })} />
      <Button title="Eliminar cuenta y todos mis datos" variant="danger" onPress={() => void confirmDelete()} loading={deleting} />
    </Screen>
  );
}
