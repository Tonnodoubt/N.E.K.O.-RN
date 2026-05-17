import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { useTheme } from '@/constants/ThemeContext';

type ReturnToParam = string | undefined;
type AllowedReturnTo =
  | '/explore'
  | '/audio-test'
  | '/pcmstream-test'
  | '/rnlive2d'
  | '/(tabs)'
  | '/(tabs)/main'
  | '/main';

export default function QrScannerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ returnTo?: string }>();
  const returnTo: ReturnToParam = typeof params.returnTo === 'string' ? params.returnTo : undefined;
  const devConfig = useDevConnectionConfig();
  const { t } = useTranslation();
  const theme = useTheme();
  const cc = theme.colors;

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: '#000' },
    center: { flex: 1, padding: theme.spacing.xl, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0b0b' },
    title: { fontSize: theme.fontSize.headline, fontWeight: theme.fontWeight.bold, color: cc.textOnAccent, marginBottom: theme.spacing.md },
    text: { fontSize: theme.fontSize.body, color: cc.textSecondary, textAlign: 'center' },
    overlay: { position: 'absolute', top: 0, left: 0, right: 0, paddingTop: 64, paddingHorizontal: theme.spacing.lg },
    overlayTitle: { fontSize: theme.fontSize.headline, fontWeight: theme.fontWeight.bold, color: cc.textOnAccent },
    overlayText: { marginTop: theme.spacing.xs, fontSize: theme.fontSize.footnote, color: 'rgba(255,255,255,0.85)' },
    bottomBar: { position: 'absolute', left: theme.spacing.lg, right: theme.spacing.lg, bottom: theme.spacing.xxl, flexDirection: 'row', justifyContent: 'center' },
    button: { paddingVertical: theme.spacing.md, paddingHorizontal: theme.spacing.lg, borderRadius: theme.radius.md, backgroundColor: cc.accent },
    buttonSecondary: { backgroundColor: 'rgba(255,255,255,0.15)' },
    buttonText: { color: cc.textOnAccent, fontSize: theme.fontSize.body, fontWeight: theme.fontWeight.semibold },
  }), [theme, cc]);

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const titleText = __DEV__ ? t('qrScanner.titleDev') : t('qrScanner.title');

  const handleCancel = useCallback(() => {
    router.back();
  }, [router]);

  const handleBarcodeScanned = useCallback(
    (result: BarcodeScanningResult) => {
      if (scanned) return;
      setScanned(true);

      const raw = (result?.data ?? '').trim();
      if (!raw) {
        Alert.alert(t('qrScanner.scanFailed'), t('qrScanner.noValidContent'));
        setScanned(false);
        return;
      }

      const target: AllowedReturnTo =
        returnTo === '/explore' ||
        returnTo === '/audio-test' ||
        returnTo === '/pcmstream-test' ||
        returnTo === '/rnlive2d' ||
        returnTo === '/(tabs)' ||
        returnTo === '/(tabs)/main' ||
        returnTo === '/main'
          ? returnTo
      : '/main';

      (async () => {
        const applied = await devConfig.applyQrRaw(raw);
        if (!applied.ok) {
          Alert.alert(t('qrScanner.invalidQRContent'), `${applied.error}\n\n${t('common.content')}: ${raw.slice(0, 256)}`);
          setScanned(false);
          return;
        }

        if (applied.isP2p) {
          Alert.alert(
            t('qrScanner.p2pConfigSuccess'),
            t('qrScanner.p2pConfigMessage', {
              host: applied.config.host,
              port: applied.config.port,
              character: applied.config.characterName,
            }),
            [
              {
                text: t('common.ok'),
                onPress: () => {
                  router.replace({
                    pathname: target,
                    params: { qr: encodeURIComponent(raw), p2p: 'true' },
                  });
                },
              },
            ]
          );
          return;
        }

        router.replace({
          pathname: target,
          params: { qr: encodeURIComponent(raw) },
        });
      })();
    },
    [devConfig, router, returnTo, scanned, t]
  );

  if (!permission) {
    return (
      <View style={s.center}>
        <Text style={s.title}>{titleText}</Text>
        <Text style={s.text}>{t('qrScanner.checkingPermission')}</Text>
        <Pressable style={s.button} onPress={handleCancel}>
          <Text style={s.buttonText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={s.center}>
        <Text style={s.title}>{titleText}</Text>
        <Text style={s.text}>{t('qrScanner.cameraPermissionRequired')}</Text>
        <View style={{ height: theme.spacing.md }} />
        <Pressable style={s.button} onPress={() => requestPermission()}>
          <Text style={s.buttonText}>{t('qrScanner.grantCameraPermission')}</Text>
        </Pressable>
        <View style={{ height: theme.spacing.md }} />
        <Pressable style={[s.button, s.buttonSecondary]} onPress={handleCancel}>
          <Text style={s.buttonText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
      />

      <View pointerEvents="none" style={s.overlay}>
        <Text style={s.overlayTitle}>{titleText}</Text>
        <Text style={s.overlayText}>{t('qrScanner.autoDetectHint')}</Text>
      </View>

      <View style={s.bottomBar}>
        <Pressable style={[s.button, s.buttonSecondary]} onPress={handleCancel}>
          <Text style={s.buttonText}>{t('common.cancel')}</Text>
        </Pressable>
        <View style={{ width: theme.spacing.md }} />
        <Pressable style={s.button} onPress={() => setScanned(false)}>
          <Text style={s.buttonText}>{scanned ? t('qrScanner.continueScan') : t('qrScanner.refocus')}</Text>
        </Pressable>
      </View>
    </View>
  );
}
