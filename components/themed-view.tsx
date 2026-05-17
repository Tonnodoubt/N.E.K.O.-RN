import { View, type ViewProps } from 'react-native';
import type { PropsWithChildren } from 'react';

import { useTheme } from '@/constants/ThemeContext';

export type ThemedViewProps = PropsWithChildren<ViewProps & {
  lightColor?: string;
  darkColor?: string;
}>;

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const theme = useTheme();

  const backgroundColor = lightColor && !theme.isDark
    ? lightColor
    : darkColor && theme.isDark
      ? darkColor
      : (lightColor ?? darkColor ?? theme.colors.page);

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
