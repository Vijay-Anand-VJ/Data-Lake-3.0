import { useColorScheme } from 'react-native';

/**
 * Global color palette tokens.
 */
export const palette = {
  primary: '#185FA5',
  primaryDark: '#0C447C',
  primaryLight: '#378ADD',
  success: '#3B6D11',
  successLight: '#EAF3DE',
  error: '#A32D2D',
  errorLight: '#FCEBEB',
  warning: '#854F0B',
  warningLight: '#FAEEDA',
  
  // Neutrals
  white: '#FFFFFF',
  black: '#000000',
  lightGray: '#F5F7FA',
  mediumGray: '#E1E4E8',
  darkGray: '#4F5E71',
  charcoal: '#1E2530',
  navyBG: '#080C14',
  cardDark: '#121926',
  borderDark: '#1E293B',
};

/**
 * Spacing constants for consistent margins and paddings.
 */
export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

/**
 * Smooth border-radius values.
 */
export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
};

/**
 * Typography font size scales.
 */
export const fontSize = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 18,
  xl: 24,
};

/**
 * Hook to resolve active styles and color schemes based on device settings.
 */
export const theme = {
  light: {
    background: palette.lightGray,
    card: palette.white,
    text: palette.charcoal,
    textMuted: palette.darkGray,
    border: palette.mediumGray,
    primary: palette.primary,
    primaryDark: palette.primaryDark,
    primaryLight: palette.primaryLight,
    success: palette.success,
    successBG: palette.successLight,
    error: palette.error,
    errorBG: palette.errorLight,
    warning: palette.warning,
    warningBG: palette.warningLight,
  },
  dark: {
    background: palette.navyBG,
    card: palette.cardDark,
    text: palette.white,
    textMuted: palette.mediumGray,
    border: palette.borderDark,
    primary: palette.primaryLight,
    primaryDark: palette.primaryDark,
    primaryLight: palette.primary,
    success: palette.success,
    successBG: '#1B2E0B',
    error: '#D32F2F',
    errorBG: '#3E1414',
    warning: '#D97706',
    warningBG: '#3A1E02',
  },
};

/**
 * Custom React hook returning structural values and active color sets.
 */
export const useAppTheme = () => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';
  const colors = isDark ? theme.dark : theme.light;

  return {
    colors,
    isDark,
    palette,
    spacing,
    borderRadius,
    fontSize,
  };
};
