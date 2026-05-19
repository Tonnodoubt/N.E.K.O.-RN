import { StyleSheet, Text, type TextProps } from 'react-native';
import type { PropsWithChildren } from 'react';

import { useTheme } from '@/constants/ThemeContext';
import type { TextVariant } from '@/constants/tokens/typography';

export type ThemedTextProps = PropsWithChildren<TextProps & {
  lightColor?: string;
  darkColor?: string;
  /** @deprecated Use `variant` instead */
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
  variant?: TextVariant;
}>;

const typeToVariant: Record<string, TextVariant> = {
  default: 'body',
  title: 'largeTitle',
  defaultSemiBold: 'body',
  subtitle: 'headline',
  link: 'body',
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type,
  variant,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();

  const resolvedVariant: TextVariant = variant ?? typeToVariant[type ?? 'default'] ?? 'body';

  const color = theme.isDark
    ? (darkColor ?? theme.colors.textPrimary)
    : (lightColor ?? theme.colors.textPrimary);

  return (
    <Text
      style={[
        {
          color,
          fontSize: theme.fontSize[resolvedVariant],
          lineHeight: theme.lineHeight[resolvedVariant],
        },
        resolvedVariant === 'largeTitle' && { fontWeight: theme.fontWeight.bold },
        resolvedVariant === 'title' && { fontWeight: theme.fontWeight.bold },
        resolvedVariant === 'headline' && { fontWeight: theme.fontWeight.bold },
        resolvedVariant === 'body' && type === 'defaultSemiBold' && { fontWeight: theme.fontWeight.semibold },
        type === 'link' && { color: theme.colors.accent, textDecorationLine: 'underline' },
        style,
      ]}
      {...rest}
    />
  );
}
