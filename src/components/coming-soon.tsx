import { Card, Screen, Text } from './ui';

export function ComingSoon({ title, phase, description }: { title: string; phase: number; description: string }) {
  return (
    <Screen>
      <Text variant="title">{title}</Text>
      <Card>
        <Text variant="heading">Próximamente</Text>
        <Text muted>{description}</Text>
        <Text variant="caption" muted>
          Disponible en la Fase {phase} del desarrollo.
        </Text>
      </Card>
    </Screen>
  );
}
