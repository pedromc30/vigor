import { View } from 'react-native';
import type { NutritionPlan } from '../lib/nutrition';
import { Card, Text } from './ui';
import { spacing, useTheme } from '../theme';

export function MacroRow({ proteinG, fatG, carbsG }: { proteinG: number; fatG: number; carbsG: number }) {
  const { colors } = useTheme();
  const items = [
    { label: 'Proteína', value: proteinG, color: colors.protein },
    { label: 'Carbohidratos', value: carbsG, color: colors.carbs },
    { label: 'Grasa', value: fatG, color: colors.fat },
  ];
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      {items.map((i) => (
        <View key={i.label} style={{ flex: 1, gap: 2 }}>
          <Text variant="heading" style={{ color: i.color }}>
            {i.value} g
          </Text>
          <Text variant="caption" muted>
            {i.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function PlanSummary({ plan }: { plan: NutritionPlan }) {
  return (
    <Card>
      <Text variant="caption" muted>
        Objetivo diario
      </Text>
      <Text variant="title">{plan.kcal} kcal</Text>
      <MacroRow {...plan} />
      <Text variant="caption" muted>
        TMB {plan.bmr} kcal · Gasto total estimado {plan.tdee} kcal (Mifflin-St Jeor)
      </Text>
      {plan.warnings.includes('kcal_floor_applied') ? (
        <Text variant="caption">
          Se ha aplicado un mínimo de calorías por seguridad. Consulta con un profesional antes de seguir una dieta tan
          baja.
        </Text>
      ) : null}
      {plan.warnings.includes('macros_exceed_kcal') ? (
        <Text variant="caption">
          Con tus datos, proteína y grasa mínimas superan las calorías objetivo. Ajusta los objetivos manualmente.
        </Text>
      ) : null}
    </Card>
  );
}
