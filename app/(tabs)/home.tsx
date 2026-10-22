import { useAuth } from '../../src/providers/AuthProvider';
import { MacroRow } from '../../src/components/plan-summary';
import { Card, Screen, Text } from '../../src/components/ui';

export default function Inicio() {
  const { profile } = useAuth();
  return (
    <Screen>
      <Text variant="title">Inicio</Text>
      {profile?.target_kcal != null && (
        <Card>
          <Text variant="caption" muted>
            Objetivo diario
          </Text>
          <Text variant="title">{profile.target_kcal} kcal</Text>
          <MacroRow
            proteinG={profile.target_protein_g ?? 0}
            fatG={profile.target_fat_g ?? 0}
            carbsG={profile.target_carbs_g ?? 0}
          />
        </Card>
      )}
      <Card>
        <Text variant="heading">Resumen del día</Text>
        <Text muted>
          El entreno programado, las calorías restantes, el agua y tu racha aparecerán aquí a medida que se activen los
          módulos de entreno y dieta (fases 2 a 4).
        </Text>
      </Card>
    </Screen>
  );
}
