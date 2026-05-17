function baseShadow(isDark: boolean) {
  return {
    shadowColor: isDark ? '#B794F6' : '#FF7EB3',
    shadowRadius: 12,
    elevation: 3,
  } as const;
}

export function shadowCard(isDark: boolean) {
  return {
    ...baseShadow(isDark),
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: isDark ? 0.15 : 0.08,
  };
}

export function shadowFloating(isDark: boolean) {
  return {
    ...baseShadow(isDark),
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: isDark ? 0.25 : 0.12,
    shadowRadius: 20,
    elevation: 8,
  };
}

export function shadowModal(isDark: boolean) {
  return {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: isDark ? 0.35 : 0.12,
    shadowRadius: 24,
    elevation: 10,
  };
}

export function shadowBubble(isDark: boolean) {
  return {
    ...baseShadow(isDark),
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: isDark ? 0.10 : 0.05,
    shadowRadius: 6,
    elevation: 1,
  };
}
