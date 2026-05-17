export const fontSize = {
  caption: 11,
  footnote: 13,
  body: 15,
  callout: 16,
  headline: 18,
  title: 22,
  largeTitle: 32,
} as const;

export const lineHeight = {
  caption: 15,
  footnote: 18,
  body: 22,
  callout: 24,
  headline: 24,
  title: 28,
  largeTitle: 38,
} as const;

export const fontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
} as const;

export type TextVariant = keyof typeof fontSize;
