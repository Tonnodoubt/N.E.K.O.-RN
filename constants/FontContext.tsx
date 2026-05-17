import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useFonts } from 'expo-font';

const STORAGE_KEY = '@neko:chat_font';

export const FONT_OPTIONS = [
  { id: 'system', label: '系统默认', fontFamily: undefined },
  { id: 'noto', label: 'Noto Sans SC', fontFamily: 'NotoSansSC' },
  { id: 'kuaile', label: '站酷快乐体', fontFamily: 'ZCOOLKuaiLe' },
  { id: 'huangyou', label: '站酷黄油体', fontFamily: 'ZCOOLQingKeHuangYou' },
  { id: 'mashan', label: '马山正体', fontFamily: 'MaShanZheng' },
] as const;

export type FontId = typeof FONT_OPTIONS[number]['id'];

interface FontContextValue {
  fontFamily: string | undefined;
  fontId: FontId;
  setFontId: (id: FontId) => void;
}

const FontContext = createContext<FontContextValue>({
  fontFamily: undefined,
  fontId: 'system',
  setFontId: () => {},
});

export function FontProvider({ children }: { children: React.ReactNode }) {
  const [fontsLoaded] = useFonts({
    'NotoSansSC': require('../assets/fonts/NotoSansSC-Regular.ttf'),
    'ZCOOLKuaiLe': require('../assets/fonts/ZCOOLKuaiLe-Regular.ttf'),
    'ZCOOLQingKeHuangYou': require('../assets/fonts/ZCOOLQingKeHuangYou-Regular.ttf'),
    'MaShanZheng': require('../assets/fonts/MaShanZheng-Regular.ttf'),
  });
  const [fontId, setFontIdState] = useState<FontId>('system');
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      setFontIdState((stored && FONT_OPTIONS.find(f => f.id === stored)) ? stored as FontId : 'system');
      setLoaded(true);
    });
  }, []);

  const setFontId = useCallback((id: FontId) => {
    setFontIdState(id);
    AsyncStorage.setItem(STORAGE_KEY, id).catch(() => {});
  }, []);

  const option = FONT_OPTIONS.find(f => f.id === fontId) ?? FONT_OPTIONS[0];
  const fontFamily = option.id === 'system' ? undefined : option.fontFamily;

  const value = useMemo(() => ({ fontFamily, fontId, setFontId }), [fontFamily, fontId, setFontId]);

  if (!fontsLoaded || !loaded) return null;

  return (
    <FontContext.Provider value={value}>
      {children}
    </FontContext.Provider>
  );
}

export function useChatFont() {
  return useContext(FontContext);
}
