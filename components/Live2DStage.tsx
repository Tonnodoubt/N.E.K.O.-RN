import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ReactNativeLive2dView } from 'react-native-live2d';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTheme } from '@/constants/ThemeContext';
import { useTranslation } from 'react-i18next';
import { VRMAvatarView, type VRMEmotion, type VRMGesture, type VRMLightingConfig, type VRMMotionCalibration, type VRMMotionDebugTelemetry, type VRMRenderPhase } from '@/components/vrm/VRMAvatarView';

const POSITION_LIMIT = 0.9;
const SCALE_MIN = 0.3;
const SCALE_MAX = 2.0;
const VRM_BASE_SCALE = 0.8;
const MOVE_SENSITIVITY = 0.003;
const clampPos = (v: number) => Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, v));
const clampScale = (v: number) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, v));

interface Live2DStageProps {
  isPageFocused: boolean;
  isAdjustingModel: boolean;
  avatarType?: 'live2d' | 'vrm';
  vrmModelUrl?: string;
  vrmLighting?: VRMLightingConfig;
  vrmMotionCalibration?: VRMMotionCalibration;
  vrmEmotion?: VRMEmotion;
  vrmGesture?: VRMGesture;
  vrmGestureRevision?: number;
  transformRevision?: number;
  live2dPropsForLipSync: any;
  live2dProps: { modelPath?: string };
  onTap: () => void;
  onVrmPhase?: (phase: VRMRenderPhase) => void;
  onVrmError?: (message: string | null) => void;
  onVrmNotice?: (message: string | null) => void;
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
  avatarType = 'live2d',
  vrmModelUrl,
  vrmLighting,
  vrmMotionCalibration,
  vrmEmotion = 'neutral',
  vrmGesture = 'none',
  vrmGestureRevision = 0,
  transformRevision = 0,
  live2dPropsForLipSync,
  live2dProps,
  onTap,
  onVrmPhase,
  onVrmError,
  onVrmNotice,
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
  const shouldRenderVrm = avatarType === 'vrm' && !!vrmModelUrl;
  const [vrmTransform, setVrmTransform] = useState(() => ({
    scale: scaleRef.current,
    position: modelPositionRef.current,
  }));
  const [vrmPhase, setVrmPhase] = useState<VRMRenderPhase>('idle');
  const [vrmError, setVrmError] = useState<string | null>(null);
  const [vrmDebugExpanded, setVrmDebugExpanded] = useState(false);
  const [vrmDebugTelemetry, setVrmDebugTelemetry] = useState<VRMMotionDebugTelemetry | null>(null);

  const panStartPositionRef = useRef({ x: modelPositionRef.current.x, y: modelPositionRef.current.y });
  const pinchStartScaleRef = useRef(scaleRef.current);
  const activeGestureRef = useRef({ pan: false, pinch: false });

  useEffect(() => {
    if (avatarType !== 'vrm') return;
    setVrmTransform({
      scale: scaleRef.current,
      position: modelPositionRef.current,
    });
  }, [avatarType, modelPositionRef, scaleRef, transformRevision, vrmModelUrl]);

  useEffect(() => {
    setVrmPhase('idle');
    setVrmError(null);
  }, [vrmModelUrl]);

  const handleVrmPhase = useCallback((phase: VRMRenderPhase) => {
    setVrmPhase(phase);
    onVrmPhase?.(phase);
  }, [onVrmPhase]);

  const handleVrmError = useCallback((message: string | null) => {
    setVrmError(message);
    onVrmError?.(message);
  }, [onVrmError]);

  const handleVrmNotice = useCallback((message: string | null) => {
    onVrmNotice?.(message);
  }, [onVrmNotice]);

  const toggleVrmDebug = useCallback(() => {
    setVrmDebugExpanded((expanded) => !expanded);
  }, []);

  const applyStageTransform = useCallback((scale: number, position: { x: number; y: number }) => {
    const nextScale = clampScale(scale);
    const nextPosition = {
      x: clampPos(position.x),
      y: clampPos(position.y),
    };

    scaleRef.current = nextScale;
    modelPositionRef.current = nextPosition;

    if (avatarType === 'vrm') {
      setVrmTransform({ scale: nextScale, position: nextPosition });
      return;
    }

    setModelScale(nextScale);
    setModelPosition(nextPosition.x, nextPosition.y);
  }, [avatarType, modelPositionRef, scaleRef, setModelScale, setModelPosition]);

  const beginGesture = useCallback((type: 'pan' | 'pinch') => {
    const active = activeGestureRef.current;
    if (active[type]) return;
    const wasIdle = !active.pan && !active.pinch;
    active[type] = true;
    if (wasIdle) {
      onAdjustStart();
    }
  }, [onAdjustStart]);

  const endGesture = useCallback((type: 'pan' | 'pinch') => {
    const active = activeGestureRef.current;
    if (!active[type]) return;
    active[type] = false;
    if (!active.pan && !active.pinch) {
      onAdjustEnd();
    }
  }, [onAdjustEnd]);

  const transformGesture = useMemo(() => {
    const panGesture = Gesture.Pan()
      .minPointers(2)
      .runOnJS(true)
      .onStart(() => {
        panStartPositionRef.current = { ...modelPositionRef.current };
        beginGesture('pan');
      })
      .onUpdate((e) => {
        const start = panStartPositionRef.current;
        applyStageTransform(scaleRef.current, {
          x: start.x + e.translationX * MOVE_SENSITIVITY,
          y: start.y - e.translationY * MOVE_SENSITIVITY,
        });
      })
      .onFinalize(() => {
        endGesture('pan');
      });

    const pinchGesture = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        pinchStartScaleRef.current = scaleRef.current;
        beginGesture('pinch');
      })
      .onUpdate((e) => {
        applyStageTransform(pinchStartScaleRef.current * e.scale, modelPositionRef.current);
      })
      .onFinalize(() => {
        endGesture('pinch');
      });

    return Gesture.Simultaneous(panGesture, pinchGesture);
  }, [applyStageTransform, beginGesture, endGesture, modelPositionRef, scaleRef]);

  const vrmStageGesture = useMemo(() => {
    const tapGesture = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(1)
      .maxDuration(250)
      .maxDistance(12)
      .onEnd((_event, success) => {
        if (success) {
          onTap();
        }
      });

    return Gesture.Simultaneous(transformGesture, tapGesture);
  }, [onTap, transformGesture]);

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
    vrmView: {
      flex: 1,
      width: '100%',
      height: '100%',
      alignSelf: 'stretch',
      borderRadius: 0,
      borderWidth: 0,
    },
    vrmGestureLayer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: 5,
      backgroundColor: 'transparent',
    },
    vrmStatusOverlay: {
      position: 'absolute',
      left: theme.spacing.xl,
      right: theme.spacing.xl,
      bottom: theme.spacing.xxl + theme.spacing.lg,
      alignItems: 'center',
      zIndex: 6,
    },
    vrmStatusPanel: {
      maxWidth: 320,
      borderRadius: theme.radius.lg,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      backgroundColor: 'rgba(15, 23, 42, 0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.14)',
    },
    vrmStatusText: {
      color: cc.textOnAccent,
      fontSize: theme.fontSize.footnote,
      fontWeight: '600',
      textAlign: 'center',
    },
    vrmStatusHint: {
      color: 'rgba(255,255,255,0.72)',
      fontSize: theme.fontSize.caption,
      marginTop: 4,
      textAlign: 'center',
    },
    vrmDebugOverlay: {
      position: 'absolute',
      top: 86,
      left: theme.spacing.xl,
      zIndex: 12,
      alignItems: 'flex-start',
      gap: 6,
    },
    vrmDebugToggle: {
      borderRadius: 999,
      minWidth: 72,
      minHeight: 44,
      paddingVertical: 10,
      paddingHorizontal: 16,
      backgroundColor: 'rgba(15, 23, 42, 0.82)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    vrmDebugToggleText: {
      color: '#f8fafc',
      fontSize: 13,
      fontWeight: '700',
    },
    vrmDebugPanel: {
      width: 240,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.sm,
      backgroundColor: 'rgba(15, 23, 42, 0.86)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.16)',
      gap: 4,
    },
    vrmDebugText: {
      color: '#e5e7eb',
      fontSize: 11,
      lineHeight: 16,
      fontVariant: ['tabular-nums'],
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

  const isVrmLoading = shouldRenderVrm && !vrmError && (
    vrmPhase === 'idle' ||
    vrmPhase === 'canvas-ready' ||
    vrmPhase === 'fetching' ||
    vrmPhase === 'parsing'
  );

  const stageContent = (
    <View style={s.container}>
      {isPageFocused && shouldRenderVrm && (
        <VRMAvatarView
          modelUrl={vrmModelUrl}
          style={s.vrmView}
          backgroundColor={cc.page}
          lighting={vrmLighting}
          motionCalibration={vrmMotionCalibration}
          idleAnimation
          lipSync
          emotion={vrmEmotion}
          gesture={vrmGesture}
          gestureRevision={vrmGestureRevision}
          relaxedPose
          modelScale={vrmTransform.scale / VRM_BASE_SCALE}
          modelPosition={vrmTransform.position}
          onPhase={handleVrmPhase}
          onError={handleVrmError}
          onNotice={handleVrmNotice}
          debugTelemetry={__DEV__}
          onDebugTelemetry={setVrmDebugTelemetry}
        />
      )}
      {isPageFocused && shouldRenderVrm && (
        <GestureDetector gesture={vrmStageGesture}>
          <View collapsable={false} style={s.vrmGestureLayer} />
        </GestureDetector>
      )}
      {isPageFocused && shouldRenderVrm && (isVrmLoading || vrmError) && (
        <View pointerEvents="none" style={s.vrmStatusOverlay}>
          <View style={s.vrmStatusPanel}>
            <Text style={s.vrmStatusText}>
              {vrmError ? t('main.vrm.failed') : t('main.vrm.loading')}
            </Text>
            {vrmError && (
              <Text style={s.vrmStatusHint}>
                {t('main.vrm.failedHint')}
              </Text>
            )}
          </View>
        </View>
      )}
      {__DEV__ && isPageFocused && shouldRenderVrm && (
        <View pointerEvents="box-none" style={s.vrmDebugOverlay}>
          <Pressable style={s.vrmDebugToggle} onPress={toggleVrmDebug}>
            <Text style={s.vrmDebugToggleText}>VRM</Text>
          </Pressable>
          {vrmDebugExpanded && vrmDebugTelemetry && (
            <View style={s.vrmDebugPanel}>
              <Text style={s.vrmDebugText}>mode: {vrmDebugTelemetry.mode}</Text>
              <Text style={s.vrmDebugText}>emotion: {vrmDebugTelemetry.emotion}</Text>
              <Text style={s.vrmDebugText}>mouth: {vrmDebugTelemetry.mouthValue.toFixed(2)} / speech {vrmDebugTelemetry.speechEnergy.toFixed(2)}</Text>
              <Text style={s.vrmDebugText}>presence: {vrmDebugTelemetry.playbackPresence.toFixed(2)} playing {vrmDebugTelemetry.isPlaying ? 'Y' : 'N'}</Text>
              <Text style={s.vrmDebugText}>gesture: {vrmDebugTelemetry.activeGesture} [{vrmDebugTelemetry.gestureQueue.join(',') || '-'}]</Text>
              <Text style={s.vrmDebugText}>focus: {vrmDebugTelemetry.focusYaw.toFixed(3)}, {vrmDebugTelemetry.focusPitch.toFixed(3)}</Text>
            </View>
          )}
        </View>
      )}
      {isPageFocused && !shouldRenderVrm && (
        <ReactNativeLive2dView
          style={s.view}
          {...live2dPropsForLipSync}
          onTap={onTap}
        />
      )}
      {!isPageFocused && (
        <View style={s.paused}>
          <Text style={s.pausedText}>
            {live2dProps.modelPath || vrmModelUrl ? t('main.live2d.paused') : t('main.live2d.pageInactive')}
          </Text>
        </View>
      )}
      {isAdjustingModel && (
        <View style={s.dragIndicator} pointerEvents="none">
          <Text style={s.dragText}>{t('main.live2d.adjusting')}</Text>
        </View>
      )}
    </View>
  );

  if (shouldRenderVrm) {
    return stageContent;
  }

  return (
    <GestureDetector gesture={transformGesture}>
      {stageContent}
    </GestureDetector>
  );
}
