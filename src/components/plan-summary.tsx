import { View } from 'react-native';
import type { NutritionPlan } from '../lib/nutrition';
import { Card, Text } from './ui';
import { spacing, useTheme } from '../theme';

/** Tres cifras en columna: el número en tinta y el nombre apagado debajo; un punto de color da la pista sin pintarlo todo. */
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
          <Text variant="heading" style={{ fontWeight: '500' }}>
            {String(i.value).replace('.', ',')} g
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i.color }} />
            <Text variant="caption" muted>
              {i.label}
            </Text>
          </View>
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
