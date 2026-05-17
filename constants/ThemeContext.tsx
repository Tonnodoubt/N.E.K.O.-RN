import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { buildTheme, type Theme } from '@/constants/theme';
import { presets, defaultPresetId, type PresetId } from '@/constants/tokens/presets';

const STORAGE_KEY = '@neko:theme_preset';

interface ThemeContextValue {
  theme: Theme;
  presetId: PresetId;
  setPreset: (id: PresetId) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: buildTheme(presets[defaultPresetId].light, false),
  presetId: defaultPresetId,
  setPreset: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const [presetId, setPresetIdState] = useState<PresetId | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => {
        if (stored === 'sakura' || stored === 'ocean') {
          setPresetIdState(stored);
        } else {
          setPresetIdState(defaultPresetId);
        }
      })
      .catch(() => {
        setPresetIdState(defaultPresetId);
      });
  }, []);

  const setPreset = useCallback((id: PresetId) => {
    setPresetIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  const resolvedId = presetId ?? defaultPresetId;
  const preset = presets[resolvedId];
  const palette = isDark ? preset.dark : preset.light;
  const theme = useMemo(() => buildTheme(palette, isDark), [palette, isDark]);

  if (presetId === null) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ theme, presetId: resolvedId, setPreset }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Theme {
  const { theme } = useContext(ThemeContext);
  return theme;
}

export function useThemePreset() {
  const { presetId, setPreset } = useContext(ThemeContext);
  return { presetId, setPreset };
}
