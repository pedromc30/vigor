import { useColorScheme } from 'react-native';

export interface Colors {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  warningBg: string;
  warningText: string;
  protein: string;
  carbs: string;
  fat: string;
  chart1: string;
  chart2: string;
}

const light: Colors = {
  background: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF1F4',
  border: '#DDE2E8',
  text: '#101828',
  textMuted: '#5B6573',
  primary: '#047857',
  onPrimary: '#FFFFFF',
  danger: '#B42318',
  warningBg: '#FEF6E0',
  warningText: '#7A4B00',
  protein: '#2563EB',
  carbs: '#D97706',
  fat: '#9333EA',
  chart1: '#2a78d6',
  chart2: '#eb6834',
};

const dark: Colors = {
  background: '#0B0F14',
  surface: '#151B23',
  surfaceAlt: '#1D2530',
  border: '#2A3441',
  text: '#F2F4F7',
  textMuted: '#9AA4B2',
  primary: '#34D399',
  onPrimary: '#04281D',
  danger: '#F97066',
  warningBg: '#2E2410',
  warningText: '#F5C26B',
  protein: '#60A5FA',
  carbs: '#FBBF24',
  fat: '#C084FC',
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
