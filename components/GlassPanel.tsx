import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

let BlurView: React.ComponentType<{ intensity: number; tint: string; style: any; children?: React.ReactNode }> | null = null;
try { BlurView = require('expo-blur').BlurView; } catch { /* not linked */ }

interface GlassPanelProps extends ViewProps {
  intensity?: number;
  tint?: 'light' | 'dark' | 'default';
  children?: React.ReactNode;
}

export default function GlassPanel({
  intensity = 40,
  tint,
  style,
  children,
  ...rest
}: GlassPanelProps) {
  const theme = useTheme();
  const resolvedTint = tint ?? (theme.isDark ? 'dark' : 'light');
  const fallbackBg = theme.colors.surfaceGlass;

  if (BlurView) {
    return (
      <BlurView intensity={intensity} tint={resolvedTint} style={style}>
        {children}
      </BlurView>
    );
  }

  return (
    <View style={[{ backgroundColor: fallbackBg }, style]} {...rest}>
      {children}
    </View>
  );
}
