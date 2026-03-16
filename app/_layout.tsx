import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { I18nextProvider } from 'react-i18next';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useEffect } from 'react';

import { initI18n, i18n } from '@/i18n';
import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Initialize i18n on mount
  useEffect(() => {
    initI18n().catch(err => console.error('Failed to initialize i18n:', err));
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <I18nextProvider i18n={i18n}>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          {/* <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} /> */}
          <Stack.Screen name="audio-test" options={{ title: '音频测试' }} />
          <Stack.Screen name="audio-debug" options={{ title: '🎤 音频诊断' }} />
          <Stack.Screen name="qr-scanner" options={{ title: '扫码（Dev）' }} />
          <Stack.Screen name="request-lab" options={{ title: 'Request/组件实验室' }} />
          <Stack.Screen name="webapp" options={{ title: 'WebApp（对齐 frontend/src/web/App.tsx）' }} />
        </Stack>
        <StatusBar style="auto" />
        </ThemeProvider>
      </I18nextProvider>
    </GestureHandlerRootView>
  );
}
