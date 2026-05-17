export const duration = {
  instant: 150,
  fast: 200,
  normal: 300,
  slow: 500,
} as const;

export type DurationToken = keyof typeof duration;
