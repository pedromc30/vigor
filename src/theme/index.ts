import { useColorScheme } from 'react-native';

/**
 * Dos propuestas de diseño para comparar: «a» (editorial, sin cajas, tinta y verde pino) y «b» (baldosas suaves,
 * azul índigo y un tono por zona). Se elige al compilar con EXPO_PUBLIC_DESIGN=a|b (por defecto «a»).
 */
export const DESIGN: 'a' | 'b' = process.env.EXPO_PUBLIC_DESIGN === 'b' ? 'b' : 'a';
export const isB = DESIGN === 'b';

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
  /** Fondos pastel de las baldosas por zona (solo el diseño B los usa). */
  tintBlue: string;
  tintMint: string;
  tintAmber: string;
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
  tintBlue: '#EEF1F4',
  tintMint: '#EEF1F4',
  tintAmber: '#EEF1F4',
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
  tintBlue: '#161B1A',
  tintMint: '#161B1A',
  tintAmber: '#161B1A',
};

// Diseño B: lienzo gris azulado, baldosas blancas, acento índigo y tonos pastel por zona (entreno azul, dieta menta, progreso ámbar).
const lightB: Colors = {
  background: '#ECEFF5',
  surface: '#FFFFFF',
  surfaceAlt: '#E1E6EF',
  border: '#DCE1EA',
  text: '#131722',
  textMuted: '#667086',
  primary: '#3555E0',
  onPrimary: '#FFFFFF',
  ink: '#3555E0',
  onInk: '#FFFFFF',
  danger: '#D1352B',
  warningBg: '#FFF1D2',
  warningText: '#7A4A00',
  protein: '#3555E0',
  carbs: '#E08A1E',
  fat: '#8E5BD6',
  chart1: '#2a78d6',
  chart2: '#eb6834',
  tintBlue: '#DDE5FF',
  tintMint: '#D6F2E4',
  tintAmber: '#FFE8BF',
};

const darkB: Colors = {
  background: '#0D1017',
  surface: '#171B25',
  surfaceAlt: '#212736',
  border: '#272D3C',
  text: '#EEF1F8',
  textMuted: '#8F98AE',
  primary: '#8FA4FF',
  onPrimary: '#0C1233',
  ink: '#8FA4FF',
  onInk: '#0C1233',
  danger: '#FF8F86',
  warningBg: '#332A12',
  warningText: '#F0CB7C',
  protein: '#8FA4FF',
  carbs: '#F2B35A',
  fat: '#BC98F0',
  chart1: '#3987e5',
  chart2: '#d95926',
  tintBlue: '#1C2547',
  tintMint: '#14322A',
  tintAmber: '#3A2E14',
};

export function useTheme(): { colors: Colors; isDark: boolean } {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const palette = isB ? { light: lightB, dark: darkB } : { light, dark };
  return { colors: isDark ? palette.dark : palette.light, isDark };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = isB ? ({ sm: 10, md: 16, lg: 24 } as const) : ({ sm: 8, md: 12, lg: 16 } as const);

// ---------- Tipografía ----------
// Hanken Grotesk, en cinco grosores. Con una fuente personalizada cada grosor es un archivo distinto,
// así que se elige la familia a partir del `fontWeight` (en Android `fontWeight` solo no cambia de archivo).
export const FONT_FILES = isB
  ? {
      Figtree_400Regular: require('@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf'),
      Figtree_500Medium: require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf'),
      Figtree_600SemiBold: require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),
      Figtree_700Bold: require('@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'),
      Figtree_800ExtraBold: require('@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf'),
    }
  : {
      HankenGrotesk_300Light: require('@expo-google-fonts/hanken-grotesk/300Light/HankenGrotesk_300Light.ttf'),
      HankenGrotesk_400Regular: require('@expo-google-fonts/hanken-grotesk/400Regular/HankenGrotesk_400Regular.ttf'),
      HankenGrotesk_500Medium: require('@expo-google-fonts/hanken-grotesk/500Medium/HankenGrotesk_500Medium.ttf'),
      HankenGrotesk_600SemiBold: require('@expo-google-fonts/hanken-grotesk/600SemiBold/HankenGrotesk_600SemiBold.ttf'),
      HankenGrotesk_700Bold: require('@expo-google-fonts/hanken-grotesk/700Bold/HankenGrotesk_700Bold.ttf'),
    };

const FAMILY_A: Record<string, string> = {
  '300': 'HankenGrotesk_300Light',
  '400': 'HankenGrotesk_400Regular',
  normal: 'HankenGrotesk_400Regular',
  '500': 'HankenGrotesk_500Medium',
  '600': 'HankenGrotesk_600SemiBold',
  '700': 'HankenGrotesk_700Bold',
  bold: 'HankenGrotesk_700Bold',
  '800': 'HankenGrotesk_700Bold',
};
const FAMILY_B: Record<string, string> = {
  '300': 'Figtree_400Regular',
  '400': 'Figtree_400Regular',
  normal: 'Figtree_400Regular',
  '500': 'Figtree_500Medium',
  '600': 'Figtree_600SemiBold',
  '700': 'Figtree_700Bold',
  bold: 'Figtree_700Bold',
  '800': 'Figtree_800ExtraBold',
};
const FAMILY = isB ? FAMILY_B : FAMILY_A;

/** Familia de la fuente para un grosor; sin la fuente cargada se usa la del sistema. */
export function fontFamily(weight: string | number | undefined = '400'): string {
  return FAMILY[String(weight)] ?? FAMILY['400'];
}
