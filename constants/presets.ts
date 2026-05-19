import { type Theme } from './theme';

export function cardPreset(t: Theme) {
  return {
    backgroundColor: t.colors.elevated,
    borderRadius: t.radius.md,
    padding: t.spacing.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    ...t.shadowCard,
  } as const;
}

export function inputPreset(t: Theme) {
  return {
    backgroundColor: t.colors.elevated,
    borderRadius: t.radius.sm,
    paddingHorizontal: t.spacing.md,
    paddingVertical: t.spacing.sm,
    fontSize: t.fontSize.body,
    color: t.colors.textPrimary,
    borderWidth: 1,
    borderColor: t.colors.border,
  } as const;
}

export function primaryButtonPreset(t: Theme) {
  return {
    backgroundColor: t.colors.accent,
    borderRadius: t.radius.sm,
    paddingVertical: t.spacing.sm,
    paddingHorizontal: t.spacing.xl,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  } as const;
}

export function glassPanelPreset(t: Theme) {
  return {
    backgroundColor: t.colors.surfaceGlass,
    borderColor: 'rgba(255,255,255,0.3)',
    borderWidth: 1,
    borderBottomWidth: 0,
  } as const;
}
