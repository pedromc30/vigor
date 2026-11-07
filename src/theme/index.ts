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

// Paleta: lienzo gris azulado, baldosas blancas, acento índigo y tonos pastel por zona (entreno azul, dieta menta, progreso ámbar).
const light: Colors = {
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

const dark: Colors = {
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
  const isDark = useColorScheme() === 'dark';
  return { colors: isDark ? dark : light, isDark };
}

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 10, md: 16, lg: 24 } as const;

// ---------- Tipografía ----------
// Figtree, en cinco grosores. Con una fuente personalizada cada grosor es un archivo distinto,
// así que se elige la familia a partir del `fontWeight` (en Android `fontWeight` solo no cambia de archivo).
export const FONT_FILES = {
  Figtree_400Regular: require('@expo-google-fonts/figtree/400Regular/Figtree_400Regular.ttf'),
  Figtree_500Medium: require('@expo-google-fonts/figtree/500Medium/Figtree_500Medium.ttf'),
  Figtree_600SemiBold: require('@expo-google-fonts/figtree/600SemiBold/Figtree_600SemiBold.ttf'),
  Figtree_700Bold: require('@expo-google-fonts/figtree/700Bold/Figtree_700Bold.ttf'),
  Figtree_800ExtraBold: require('@expo-google-fonts/figtree/800ExtraBold/Figtree_800ExtraBold.ttf'),
};

const FAMILY: Record<string, string> = {
  '300': 'Figtree_400Regular',
  '400': 'Figtree_400Regular',
  normal: 'Figtree_400Regular',
  '500': 'Figtree_500Medium',
  '600': 'Figtree_600SemiBold',
  '700': 'Figtree_700Bold',
  bold: 'Figtree_700Bold',
  '800': 'Figtree_800ExtraBold',
};

/** Familia de la fuente para un grosor; sin la fuente cargada se usa la del sistema. */
export function fontFamily(weight: string | number | undefined = '400'): string {
  return FAMILY[String(weight)] ?? FAMILY['400'];
}
