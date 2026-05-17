import { useMemo, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ReactNativeLive2dView } from 'react-native-live2d';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTheme } from '@/constants/ThemeContext';
import { useTranslation } from 'react-i18next';

const POSITION_LIMIT = 0.9;
const SCALE_MIN = 0.3;
const SCALE_MAX = 2.0;
const clampPos = (v: number) => Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, v));
const clampScale = (v: number) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, v));

interface Live2DStageProps {
  isPageFocused: boolean;
  isAdjustingModel: boolean;
  live2dPropsForLipSync: any;
  live2dProps: { modelPath?: string };
  onTap: () => void;
  setModelScale: (scale: number) => void;
  setModelPosition: (x: number, y: number) => void;
  onAdjustStart: () => void;
  onAdjustEnd: () => void;
  modelPositionRef: React.MutableRefObject<{ x: number; y: number }>;
  scaleRef: React.MutableRefObject<number>;
}

export function Live2DStage({
  isPageFocused,
  isAdjustingModel,
  live2dPropsForLipSync,
  live2dProps,
  onTap,
  setModelScale,
  setModelPosition,
  onAdjustStart,
  onAdjustEnd,
  modelPositionRef,
  scaleRef,
}: Live2DStageProps) {
  const theme = useTheme();
  const cc = theme.colors;
  const { t } = useTranslation();

  const manualRef = useRef({
    startDist: 0,
    startMidX: 0,
    startMidY: 0,
    startPosX: 0,
    startPosY: 0,
    startScale: 0.8,
    active: false,
  });

  const gesture = useMemo(() => {
    return Gesture.Manual()
      .runOnJS(true)
      .onTouchesDown((e, manager) => {
        if (e.numberOfTouches >= 2) {
          manager.activate();
          const [t1, t2] = [e.allTouches[0], e.allTouches[1]];
          const s = manualRef.current;
          s.startDist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
          s.startMidX = (t1.x + t2.x) / 2;
          s.startMidY = (t1.y + t2.y) / 2;
          s.startPosX = modelPositionRef.current.x;
          s.startPosY = modelPositionRef.current.y;
          s.startScale = scaleRef.current;
          s.active = true;
          onAdjustStart();
        } else {
          manager.fail();
        }
      })
      .onTouchesMove((e) => {
        const s = manualRef.current;
        if (!s.active || e.numberOfTouches < 2) return;
        const [t1, t2] = [e.allTouches[0], e.allTouches[1]];
        const dist = Math.hypot(t1.x - t2.x, t1.y - t2.y);
        const midX = (t1.x + t2.x) / 2;
        const midY = (t1.y + t2.y) / 2;

        const scale = clampScale(s.startScale * (dist / (s.startDist || 1)));
        const dx = clampPos(s.startPosX + (midX - s.startMidX) * 0.003);
        const dy = clampPos(s.startPosY - (midY - s.startMidY) * 0.003);

        setModelScale(scale);
        setModelPosition(dx, dy);
        modelPositionRef.current = { x: dx, y: dy };
        scaleRef.current = scale;
      })
      .onTouchesUp(() => {
        manualRef.current.active = false;
        onAdjustEnd();
      })
      .onEnd(() => {
        manualRef.current.active = false;
        onAdjustEnd();
      });
  }, [modelPositionRef, scaleRef, setModelScale, setModelPosition, onAdjustStart, onAdjustEnd]);

  const s = useMemo(() => StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: cc.page,
    },
    view: {
      flex: 1,
      width: '100%',
      alignSelf: 'stretch',
    },
    paused: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pausedText: {
      color: cc.textSecondary,
      fontSize: theme.fontSize.callout,
    },
    dragIndicator: {
      position: 'absolute',
      top: theme.spacing.xl,
      alignSelf: 'center',
      backgroundColor: cc.accentSoft,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.xl,
      borderWidth: 1,
      borderColor: cc.accent,
      zIndex: 10,
    },
    dragText: {
      color: cc.accent,
      fontSize: theme.fontSize.footnote,
    },
  }), [theme, cc]);

  return (
    <GestureDetector gesture={gesture}>
      <View style={s.container}>
        {isPageFocused && (
          <ReactNativeLive2dView
            style={s.view}
            {...live2dPropsForLipSync}
            onTap={onTap}
          />
        )}
        {!isPageFocused && (
          <View style={s.paused}>
            <Text style={s.pausedText}>
              {live2dProps.modelPath ? t('main.live2d.paused') : t('main.live2d.pageInactive')}
            </Text>
          </View>
        )}
        {isAdjustingModel && (
          <View style={s.dragIndicator} pointerEvents="none">
            <Text style={s.dragText}>{t('main.live2d.adjusting')}</Text>
          </View>
        )}
      </View>
    </GestureDetector>
  );
}
