import { Platform } from 'react-native';
import { lightPalette, darkPalette, type SemanticColor } from './tokens/colors';
import { spacing, type SpacingToken } from './tokens/spacing';
import { fontSize, lineHeight, fontWeight, type TextVariant } from './tokens/typography';
import { radius, type RadiusToken } from './tokens/borderRadius';
import { shadowCard, shadowFloating, shadowModal, shadowBubble } from './tokens/shadows';
import { duration, type DurationToken } from './tokens/durations';

interface ShadowPreset {
  readonly shadowColor: string;
  readonly shadowOffset: { readonly width: number; readonly height: number };
  readonly shadowOpacity: number;
  readonly shadowRadius: number;
  readonly elevation: number;
}

export interface Theme {
  colors: Record<SemanticColor, string>;
  isDark: boolean;
  spacing: Record<SpacingToken, number>;
  fontSize: Record<TextVariant, number>;
  lineHeight: Record<TextVariant, number>;
  fontWeight: { regular: '400'; medium: '500'; semibold: '600'; bold: '700' };
  radius: Record<RadiusToken, number>;
  shadowCard: ShadowPreset;
  shadowFloating: ShadowPreset;
  shadowModal: ShadowPreset;
  shadowBubble: ShadowPreset;
  duration: Record<DurationToken, number>;
}

export const lightTheme: Theme = {
  colors: lightPalette as Record<SemanticColor, string>,
  isDark: false,
  spacing,
  fontSize,
  lineHeight,
  fontWeight,
  radius,
  shadowCard: shadowCard(false) as ShadowPreset,
  shadowFloating: shadowFloating(false) as ShadowPreset,
  shadowModal: shadowModal(false) as ShadowPreset,
  shadowBubble: shadowBubble(false) as ShadowPreset,
  duration,
};

export const darkTheme: Theme = {
  colors: darkPalette as Record<SemanticColor, string>,
  isDark: true,
  spacing,
  fontSize,
  lineHeight,
  fontWeight,
  radius,
  shadowCard: shadowCard(true) as ShadowPreset,
  shadowFloating: shadowFloating(true) as ShadowPreset,
  shadowModal: shadowModal(true) as ShadowPreset,
  shadowBubble: shadowBubble(true) as ShadowPreset,
  duration,
};

export function buildTheme(colors: Record<SemanticColor, string>, isDark: boolean): Theme {
  return {
    colors,
    isDark,
    spacing,
    fontSize,
    lineHeight,
    fontWeight,
    radius,
    shadowCard: shadowCard(isDark) as ShadowPreset,
    shadowFloating: shadowFloating(isDark) as ShadowPreset,
    shadowModal: shadowModal(isDark) as ShadowPreset,
    shadowBubble: shadowBubble(isDark) as ShadowPreset,
    duration,
  };
}

const tintColorLight = '#FF7EB3';
const tintColorDark = '#F5F0F8';

// Backward compatibility: keep old Colors export for existing code
export const Colors = {
  light: {
    text: lightPalette.textPrimary,
    background: lightPalette.page,
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: darkPalette.textPrimary,
    background: darkPalette.page,
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
