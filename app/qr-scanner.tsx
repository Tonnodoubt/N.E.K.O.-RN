import React, { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';

type ReturnToParam = string | undefined;
type AllowedReturnTo =
  | '/explore'
  | '/audio-test'
  | '/modal'
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
        returnTo === '/modal' ||
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
      <View style={styles.center}>
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.text}>{t('qrScanner.checkingPermission')}</Text>
        <Pressable style={styles.button} onPress={handleCancel}>
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>{titleText}</Text>
        <Text style={styles.text}>{t('qrScanner.cameraPermissionRequired')}</Text>
        <View style={{ height: 12 }} />
        <Pressable style={styles.button} onPress={() => requestPermission()}>
          <Text style={styles.buttonText}>{t('qrScanner.grantCameraPermission')}</Text>
        </Pressable>
        <View style={{ height: 12 }} />
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleCancel}>
          <Text style={styles.buttonText}>{t('common.back')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        onBarcodeScanned={handleBarcodeScanned}
      />

      <View pointerEvents="none" style={styles.overlay}>
        <Text style={styles.overlayTitle}>{titleText}</Text>
        <Text style={styles.overlayText}>{t('qrScanner.autoDetectHint')}</Text>
      </View>

      <View style={styles.bottomBar}>
        <Pressable style={[styles.button, styles.buttonSecondary]} onPress={handleCancel}>
          <Text style={styles.buttonText}>{t('common.cancel')}</Text>
        </Pressable>
        <View style={{ width: 12 }} />
        <Pressable style={styles.button} onPress={() => setScanned(false)}>
          <Text style={styles.buttonText}>{scanned ? t('qrScanner.continueScan') : t('qrScanner.refocus')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  center: {
    flex: 1,
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0b0b0b',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 12,
  },
  text: {
    fontSize: 14,
    color: '#cfcfcf',
    textAlign: 'center',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: 64,
    paddingHorizontal: 16,
  },
  overlayTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  overlayText: {
    marginTop: 6,
    fontSize: 13,
    color: 'rgba(255,255,255,0.85)',
  },
  bottomBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: '#2f6fed',
  },
  buttonSecondary: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
