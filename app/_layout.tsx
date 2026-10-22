import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../src/providers/AuthProvider';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { Button, Screen, Text } from '../src/components/ui';
import { useTheme } from '../src/theme';

function RootStack() {
  const { colors } = useTheme();
  const { loading, session, onboarded, profileError, refreshProfile, signOut } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  // Sesión válida pero sin poder leer el perfil: no mandar al onboarding (sobrescribiría datos).
  if (session && profileError) {
    return (
      <Screen>
        <Text variant="title">Sin conexión</Text>
        <Text muted>{profileError}</Text>
        <Button title="Reintentar" onPress={() => void refreshProfile()} />
        <Button title="Cerrar sesión" variant="ghost" onPress={() => void signOut()} />
      </Screen>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && !onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={!!session && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        <Stack.Screen name="edit-targets" options={{ presentation: 'modal' }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  const { isDark } = useTheme();

  if (!isSupabaseConfigured) {
    return (
      <SafeAreaProvider>
        <Screen>
          <Text variant="title">Falta configurar Supabase</Text>
          <Text muted>
            Copia .env.example a .env y define EXPO_PUBLIC_SUPABASE_URL y EXPO_PUBLIC_SUPABASE_ANON_KEY. Reinicia
            Expo con «npx expo start -c».
          </Text>
        </Screen>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <RootStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
