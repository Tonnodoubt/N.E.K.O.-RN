import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { useTranslation } from 'react-i18next';

type VoicePrepareStatus = 'preparing' | 'ready' | null;

interface VoicePrepareOverlayProps {
  status: VoicePrepareStatus;
}

export function VoicePrepareOverlay({ status }: VoicePrepareOverlayProps) {
  const theme = useTheme();
  const cc = theme.colors;
  const { t } = useTranslation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const pulseOpacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    if (status) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [status, fadeAnim]);

  useEffect(() => {
    if (status !== 'preparing') {
      pulseAnim.setValue(1);
      pulseOpacity.setValue(0.6);
      return;
    }

    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.8,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.6,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [status, pulseAnim, pulseOpacity]);

  if (!status) return null;

  const isPreparing = status === 'preparing';

  return (
    <Animated.View style={[styles.overlay, { opacity: fadeAnim, backgroundColor: cc.overlay }]} pointerEvents="none">
      <View style={styles.content}>
        <View style={styles.circleArea}>
          {isPreparing && (
            <Animated.View
              style={[
                styles.pulseRing,
                {
                  transform: [{ scale: pulseAnim }],
                  opacity: pulseOpacity,
                  borderColor: cc.accent,
                  backgroundColor: cc.accentSoft,
                },
              ]}
            />
          )}

          <View
            style={[
              styles.centerCircle,
              isPreparing
                ? { backgroundColor: cc.accentSoft, borderWidth: 2, borderColor: cc.accent }
                : { backgroundColor: `${cc.success}80`, borderWidth: 2, borderColor: cc.success },
            ]}
          >
            {isPreparing ? (
              <Ionicons name="mic" size={32} color={cc.textOnAccent} />
            ) : (
              <Ionicons name="checkmark" size={32} color={cc.success} />
            )}
          </View>
        </View>

        <Text style={[styles.statusText, { color: cc.textOnAccent, textShadowColor: cc.accent }]}>
          {isPreparing ? t('main.voice.systemPreparing') : t('main.voice.systemReady')}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleArea: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
  },
  centerCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    marginTop: 16,
    fontWeight: '600',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
});
