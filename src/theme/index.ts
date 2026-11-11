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
  /** Fondos pastel de las baldosas por zona . */
  tintBlue: string;
  tintMint: string;
  tintAmber: string;
}

// Paleta «papel y terracota»: fondo crema, tarjetas blancas con borde fino, tinta casi negra y un único acento terracota.
// `primary` es el acento (botones principales, progreso, enlaces); `ink` es la tinta (selecciones y botones oscuros).
const light: Colors = {
  background: '#F6F1E7',
  surface: '#FFFFFF',
  surfaceAlt: '#E3DBC9',
  border: '#E8E0CF',
  text: '#1D1A16',
  textMuted: '#8A8173',
  primary: '#D9502B',
  onPrimary: '#FFFFFF',
  ink: '#1D1A16',
  onInk: '#F6F1E7',
  danger: '#B3261E',
  warningBg: '#F5EED8',
  warningText: '#6B4A00',
  protein: '#3C6E91',
  carbs: '#C98A1E',
  fat: '#8E5BD6',
  chart1: '#2a78d6',
  chart2: '#eb6834',
  tintBlue: '#FFFFFF',
  tintMint: '#FFFFFF',
  tintAmber: '#FFFFFF',
};

const dark: Colors = {
  background: '#15120F',
  surface: '#1F1B17',
  surfaceAlt: '#2E2821',
  border: '#332D26',
  text: '#F3ECDF',
  textMuted: '#A39A8A',
  primary: '#F0643C',
  onPrimary: '#1A0C07',
  ink: '#F3ECDF',
  onInk: '#15120F',
  danger: '#F0857D',
  warningBg: '#2B2512',
  warningText: '#E8C477',
  protein: '#7FB0D1',
  carbs: '#DDAA55',
  fat: '#B79BDA',
  chart1: '#3987e5',
  chart2: '#d95926',
  tintBlue: '#1F1B17',
  tintMint: '#1F1B17',
  tintAmber: '#1F1B17',
};

export function useTheme(): { colors: Colors; isDark: boolean } {
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? dark : light, isDark };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 14, lg: 20 } as const;

// ---------- Tipografía ----------
// Títulos y cifras: Barlow Condensed (condensada, en mayúsculas). Textos: Manrope. Con una fuente personalizada cada
// grosor es un archivo distinto, así que la familia se elige a partir del `fontWeight` (en Android `fontWeight` solo no cambia de archivo).
export const FONT_FILES = {
  BarlowCondensed_700Bold: require('@expo-google-fonts/barlow-condensed/700Bold/BarlowCondensed_700Bold.ttf'),
  BarlowCondensed_800ExtraBold: require('@expo-google-fonts/barlow-condensed/800ExtraBold/BarlowCondensed_800ExtraBold.ttf'),
  Manrope_400Regular: require('@expo-google-fonts/manrope/400Regular/Manrope_400Regular.ttf'),
  Manrope_500Medium: require('@expo-google-fonts/manrope/500Medium/Manrope_500Medium.ttf'),
  Manrope_600SemiBold: require('@expo-google-fonts/manrope/600SemiBold/Manrope_600SemiBold.ttf'),
  Manrope_700Bold: require('@expo-google-fonts/manrope/700Bold/Manrope_700Bold.ttf'),
  Manrope_800ExtraBold: require('@expo-google-fonts/manrope/800ExtraBold/Manrope_800ExtraBold.ttf'),
};

const FAMILY: Record<string, string> = {
  '300': 'Manrope_400Regular',
  '400': 'Manrope_400Regular',
  normal: 'Manrope_400Regular',
  '500': 'Manrope_500Medium',
  '600': 'Manrope_600SemiBold',
  '700': 'Manrope_700Bold',
  bold: 'Manrope_700Bold',
  '800': 'Manrope_800ExtraBold',
};

/** Familia de los textos (Manrope) para un grosor; sin la fuente cargada se usa la del sistema. */
export function fontFamily(weight: string | number | undefined = '400'): string {
  return FAMILY[String(weight)] ?? FAMILY['400'];
}

/** Familia de los títulos y las cifras (Barlow Condensed). */
export const DISPLAY_FONT = 'BarlowCondensed_800ExtraBold';
