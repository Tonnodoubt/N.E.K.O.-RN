import { darkPalette, lightPalette, type SemanticColor } from './colors';

export type PresetId = 'sakura' | 'ocean';

export interface ThemePreset {
  id: PresetId;
  label: string;
  accentPreview: string;
  light: Record<SemanticColor, string>;
  dark: Record<SemanticColor, string>;
}

const sakura: ThemePreset = {
  id: 'sakura',
  label: 'Sakura',
  accentPreview: '#FF7EB3',
  light: lightPalette,
  dark: darkPalette,
};

const ocean: ThemePreset = {
  id: 'ocean',
  label: 'Ocean',
  accentPreview: '#44B7FE',
  light: {
    accent: '#44B7FE',
    accentSecondary: '#0D6E92',
    accentMuted: '#0D6E92',
    accentSoft: 'rgba(68, 183, 254, 0.10)',
    accentGradientStart: '#44B7FE',
    accentGradientEnd: '#0D6E92',
    success: '#52C41A',
    warning: '#FAAD14',
    error: '#FF4D4F',
    page: '#E3F4FF',
    elevated: '#F0F8FF',
    surfaceGlass: 'rgba(245, 245, 250, 0.92)',
    surfaceGlassBorder: 'rgba(68, 183, 254, 0.20)',
    textPrimary: '#1A1A2E',
    textSecondary: '#555555',
    textMuted: '#888888',
    textOnAccent: '#1A1A2E',
    border: '#B3E5FC',
    borderStrong: 'rgba(68, 183, 254, 0.20)',
    separator: 'rgba(0, 0, 0, 0.06)',
    overlay: 'rgba(0, 0, 0, 0.5)',
    chatSheetBg: 'rgba(0, 0, 0, 0.06)',
    aiBubbleBg: 'rgba(255, 255, 255, 0.55)',
    aiBubbleBorder: 'rgba(255, 255, 255, 0.60)',
    aiBubbleText: '#1A1A2E',
    userBubbleBg: 'rgba(68, 183, 254, 0.55)',
    userBubbleText: '#1A1A2E',
    timestampText: 'rgba(26, 26, 46, 0.45)',
    timestampLine: 'rgba(26, 26, 46, 0.10)',
    dotUser: '#44B7FE',
    dotAssistant: '#0D6E92',
    inputBarBg: 'rgba(255, 255, 255, 0.45)',
  },
  dark: {
    accent: '#44B7FE',
    accentSecondary: '#0D6E92',
    accentMuted: '#0D6E92',
    accentSoft: 'rgba(68, 183, 254, 0.10)',
    accentGradientStart: '#44B7FE',
    accentGradientEnd: '#0D6E92',
    success: '#52C41A',
    warning: '#FAAD14',
    error: '#FF4D4F',
    page: '#1A1A2E',
    elevated: '#16213E',
    surfaceGlass: 'rgba(25, 25, 35, 0.97)',
    surfaceGlassBorder: 'rgba(68, 183, 254, 0.18)',
    textPrimary: '#FFFFFF',
    textSecondary: '#AAAAAA',
    textMuted: '#666666',
    textOnAccent: '#1A1A2E',
    border: 'rgba(255, 255, 255, 0.10)',
    borderStrong: 'rgba(255, 255, 255, 0.20)',
    separator: 'rgba(255, 255, 255, 0.08)',
    overlay: 'rgba(0, 0, 0, 0.6)',
    chatSheetBg: 'rgba(0, 0, 0, 0.15)',
    aiBubbleBg: 'rgba(255, 255, 255, 0.08)',
    aiBubbleBorder: 'rgba(255, 255, 255, 0.12)',
    aiBubbleText: '#FFFFFF',
    userBubbleBg: 'rgba(68, 183, 254, 0.50)',
    userBubbleText: '#1A1A2E',
    timestampText: 'rgba(255, 255, 255, 0.35)',
    timestampLine: 'rgba(255, 255, 255, 0.08)',
    dotUser: '#44B7FE',
    dotAssistant: '#0D6E92',
    inputBarBg: 'rgba(0, 0, 0, 0.25)',
  },
};

export const presets: Record<PresetId, ThemePreset> = { sakura, ocean };
export const presetList: ThemePreset[] = [ocean, sakura];
export const defaultPresetId: PresetId = 'ocean';
