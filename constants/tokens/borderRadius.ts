export const radius = {
  xs: 6,
  sm: 10,
  md: 16,
  lg: 20,
  xl: 28,
  xxl: 32,
  full: 9999,
} as const;

export type RadiusToken = keyof typeof radius;
