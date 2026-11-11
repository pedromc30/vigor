import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { TopTabs } from '../../src/components/top-tabs';
import { useAuth } from '../../src/providers/AuthProvider';
import { runDeleteAccount } from '../../src/lib/account';
import { confirmSignOut } from '../../src/lib/offline/session';
import { ACTIVITY_LABELS, DIET_LABELS, GOAL_LABELS, SEX_LABELS, ALLERGEN_OPTIONS, WEEKDAY_LONG } from '../../src/lib/labels';
import { MacroRow } from '../../src/components/plan-summary';
import { FORMULA_LABELS, bmrFormula } from '../../src/lib/nutrition';
import { Button, Card, Disclaimer, ErrorText, LinkButton, LinkRow, Screen, Text } from '../../src/components/ui';
import { spacing } from '../../src/theme';
import { confirm } from '../../src/lib/confirm';
import { cleanDayTargets } from '../../src/lib/day-targets';

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
  const { session, profile, signOut, saveProfile } = useAuth();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!profile) return null;

  const perDay = cleanDayTargets(profile.day_targets);

  const removePerDay = async () => {
    if (!(await confirm('Quitar objetivos por día', 'Todos los días usarán el objetivo general. ¿Seguro?', 'Quitar', true))) return;
    try {
      await saveProfile({ day_targets: null });
    } catch {
      setError('No se pudo guardar. Comprueba tu conexión e inténtalo de nuevo.');
    }
  };

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
      <TopTabs />
      <Text variant="title">Perfil</Text>
      <Text muted>{session?.user.email}</Text>

      <Card>
        <Text variant="heading">Mis datos</Text>
        <Row label="Sexo" value={profile.sex ? SEX_LABELS[profile.sex] : '—'} />
        <Row label="Edad" value={profile.age != null ? `${profile.age} años` : '—'} />
        <Row label="Altura" value={profile.height_cm != null ? `${profile.height_cm} cm` : '—'} />
        <Row label="Peso" value={profile.weight_kg != null ? `${profile.weight_kg} kg` : '—'} />
        <Row label="Grasa corporal" value={profile.body_fat_pct != null ? `${String(profile.body_fat_pct).replace('.', ',')} %` : '—'} />
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
          {profile.targets_manual ? 'Editados manualmente.' : `Calculados automáticamente (${FORMULA_LABELS[bmrFormula({ bodyFatPct: profile.body_fat_pct })]}).`}
        </Text>
        {perDay ? (
          <View style={{ gap: 2 }}>
            <Text variant="caption" muted>
              Objetivo de cada día (media semanal arriba)
            </Text>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => {
              const t = perDay[String(d)];
              return (
                <Pressable
                  key={d}
                  accessibilityRole="button"
                  accessibilityLabel={`Objetivo del ${WEEKDAY_LONG[d]}`}
                  onPress={() => router.push({ pathname: '/edit-day-target', params: { day: String(d) } })}
                  style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 40, gap: spacing.md }}
                >
                  <Text variant="label">{WEEKDAY_LONG[d][0].toUpperCase() + WEEKDAY_LONG[d].slice(1)}</Text>
                  <Text variant="caption" muted>
                    {t ? `${t.kcal} kcal · P ${t.protein_g} · C ${t.carbs_g} · G ${t.fat_g}` : 'Objetivo general'}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
        <Button title="Editar objetivos" variant="secondary" onPress={() => router.push('/edit-targets')} />
        {perDay ? <LinkButton title="Quitar los objetivos por día" danger onPress={() => void removePerDay()} /> : null}
      </Card>

      <View>
        <LinkRow title="Recordatorios" onPress={() => router.push('/reminders')} />
        <LinkRow title="Exportar datos (CSV)" onPress={() => router.push('/export')} />
        <LinkRow title="Privacidad y datos" onPress={() => router.push('/privacy')} />
      </View>

      <Disclaimer />

      <ErrorText>{error}</ErrorText>
      <Button title="Cerrar sesión" variant="secondary" onPress={() => void confirmSignOut().then((ok) => { if (ok) void signOut(); })} />
      <Button title="Eliminar cuenta y todos mis datos" variant="danger" onPress={() => void confirmDelete()} loading={deleting} />
    </Screen>
  );
}
