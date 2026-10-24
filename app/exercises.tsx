import { useRouter } from 'expo-router';
import { ExerciseBrowser } from '../src/components/exercise-browser';
import { Button, Screen, Text } from '../src/components/ui';

export default function Exercises() {
  const router = useRouter();
  return (
    <Screen>
      <Text variant="title">Biblioteca</Text>
      <ExerciseBrowser />
      <Button title="Volver" variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
