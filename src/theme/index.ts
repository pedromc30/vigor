import { useColorScheme } from 'react-native';

export interface Colors {
  background: string;
  surface: string;
  surfaceAlt: string;
  /** Líneas finas que separan secciones y contornos de campos. */
  border: string;
  text: string;
  textMuted: string;
  /** Color de acento (enlaces, progreso, marcas de «hecho»). No se usa como relleno de botones. */
  primary: string;
  onPrimary: string;
  /** Tinta: botones principales y selecciones. Casi negra en claro, casi blanca en oscuro. */
  ink: string;
  onInk: string;
  danger: string;
  warningBg: string;
  warningText: string;
  protein: string;
  carbs: string;
  fat: string;
  chart1: string;
  chart2: string;
}

// Paleta «niebla y tinta»: fondo gris verdoso muy claro, tinta carbón con un matiz verde y un único acento pino.
// Las superficies son planas (sin sombras ni bordes marcados); los colores de macros y gráficas son los de datos.
const light: Colors = {
  background: '#F4F5F3',
  surface: '#FFFFFF',
  surfaceAlt: '#E9ECE9',
  border: '#D6DBD8',
  text: '#171C1A',
  textMuted: '#66706B',
  primary: '#0D6652',
  onPrimary: '#FFFFFF',
  ink: '#171C1A',
  onInk: '#F4F5F3',
  danger: '#B3261E',
  warningBg: '#F5EED8',
  warningText: '#6B4A00',
  protein: '#3C6E91',
  carbs: '#A8741A',
  fat: '#7A5C9E',
  chart1: '#2a78d6',
  chart2: '#eb6834',
};

const dark: Colors = {
  background: '#0E1211',
  surface: '#161B1A',
  surfaceAlt: '#1E2423',
  border: '#2B3331',
  text: '#ECEFED',
  textMuted: '#8E9894',
  primary: '#62CBAE',
  onPrimary: '#06231C',
  ink: '#ECEFED',
  onInk: '#0E1211',
  danger: '#F0857D',
  warningBg: '#2B2512',
  warningText: '#E8C477',
  protein: '#7FB0D1',
  carbs: '#DDAA55',
  fat: '#B79BDA',
  chart1: '#3987e5',
  chart2: '#d95926',
};

export function useTheme(): { colors: Colors; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  return { colors: isDark ? dark : light, isDark };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 16 } as const;

// ---------- Tipografía ----------
// Hanken Grotesk, en cinco grosores. Con una fuente personalizada cada grosor es un archivo distinto,
// así que se elige la familia a partir del `fontWeight` (en Android `fontWeight` solo no cambia de archivo).
export const FONT_FILES = {
  HankenGrotesk_300Light: require('@expo-google-fonts/hanken-grotesk/300Light/HankenGrotesk_300Light.ttf'),
  HankenGrotesk_400Regular: require('@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf'),
  HankenGrotesk_500Medium: require('@expo-google-fonts/hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf'),
  HankenGrotesk_600SemiBold: require('@expo-google-fonts/hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf'),
  HankenGrotesk_700Bold: require('@expo-google-fonts/hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf'),
};

const FAMILY: Record<string, string> = {
  '300': 'HankenGrotesk_300Light',
  '400': 'HankenGrotesk_400Regular',
  normal: 'HankenGrotesk_400Regular',
  '500': 'HankenGrotesk_500Medium',
  '600': 'HankenGrotesk_600SemiBold',
  '700': 'HankenGrotesk_700Bold',
  bold: 'HankenGrotesk_700Bold',
};

/** Familia de la fuente para un grosor; sin la fuente cargada se usa la del sistema. */
export function fontFamily(weight: string | number | undefined = '400'): string {
  return FAMILY[String(weight)] ?? FAMILY['400'];
}
