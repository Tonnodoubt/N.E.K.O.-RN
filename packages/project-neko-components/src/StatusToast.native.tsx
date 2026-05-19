import React, {
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
  useMemo,
} from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { useTheme } from '@/constants/ThemeContext';

export interface StatusToastProps {
  staticBaseUrl?: string;
}

interface StatusToastState {
  message: string;
  duration: number;
  isVisible: boolean;
}

export interface StatusToastHandle {
  show: (message: string, duration?: number) => void;
}

const { width: screenWidth } = Dimensions.get('window');

const StatusToast = forwardRef<StatusToastHandle | null, StatusToastProps>(
  function StatusToastComponent(_props, ref) {
    const t = useTheme();
    const [toastState, setToastState] = useState<StatusToastState>({
      message: '',
      duration: 3000,
      isVisible: false,
    });

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const translateY = useRef(new Animated.Value(-20)).current;

    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearTimers = useCallback(() => {
      if (hideTimer.current) {
        clearTimeout(hideTimer.current);
        hideTimer.current = null;
      }
      if (clearTimer.current) {
        clearTimeout(clearTimer.current);
        clearTimer.current = null;
      }
    }, []);

    const showToast = useCallback(
      (message: string, duration: number = 3000) => {
        clearTimers();

        if (!message || message.trim() === '') {
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: t.duration.fast,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: -20,
              duration: t.duration.fast,
              useNativeDriver: true,
            }),
          ]).start(() => {
            setToastState((prev) => ({ ...prev, isVisible: false, message: '' }));
          });
          return;
        }

        setToastState({
          message,
          duration,
          isVisible: true,
        });

        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 1,
            duration: t.duration.fast,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: t.duration.fast,
            useNativeDriver: true,
          }),
        ]).start();

        hideTimer.current = setTimeout(() => {
          Animated.parallel([
            Animated.timing(fadeAnim, {
              toValue: 0,
              duration: t.duration.fast,
              useNativeDriver: true,
            }),
            Animated.timing(translateY, {
              toValue: -20,
              duration: t.duration.fast,
              useNativeDriver: true,
            }),
          ]).start(() => {
            clearTimer.current = setTimeout(() => {
              setToastState((prev) => ({ ...prev, isVisible: false, message: '' }));
            }, 100);
          });
        }, duration);
      },
      [fadeAnim, translateY, clearTimers, t.duration.fast]
    );

    useImperativeHandle(
      ref,
      () => ({
        show: showToast,
      }),
      [showToast]
    );

    useEffect(() => {
      return () => {
        clearTimers();
      };
    }, [clearTimers]);

    const s = useMemo(() => StyleSheet.create({
      container: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 99999,
      },
      toast: {
        maxWidth: screenWidth - 48,
        paddingHorizontal: t.spacing.xl,
        paddingVertical: t.spacing.sm,
        borderRadius: t.radius.lg,
        borderWidth: 1,
      },
      text: {
        fontSize: t.fontSize.footnote,
        textAlign: 'center',
        lineHeight: t.lineHeight.footnote,
      },
    }), [t]);

    if (!toastState.isVisible || !toastState.message) {
      return null;
    }

    return (
      <Animated.View
        style={[
          s.container,
          {
            opacity: fadeAnim,
            transform: [{ translateY }],
          },
        ]}
        pointerEvents="none"
      >
        <View style={[s.toast, { backgroundColor: t.colors.overlay, borderColor: t.colors.accent + '99' }]}>
          <Text style={[s.text, { color: t.colors.accent }]} numberOfLines={2}>
            {toastState.message}
          </Text>
        </View>
      </Animated.View>
    );
  }
);

export { StatusToast };
export default StatusToast;
