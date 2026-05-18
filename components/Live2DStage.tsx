import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ImageBackground, View, Text, StyleSheet } from 'react-native';
import { ReactNativeLive2dView } from 'react-native-live2d';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import { useTheme } from '@/constants/ThemeContext';
import { useTranslation } from 'react-i18next';
import { VRMAvatarView, type VRMEmotion, type VRMGesture, type VRMLightingConfig, type VRMMotionCalibration, type VRMRenderPhase } from '@/components/vrm/VRMAvatarView';

const POSITION_LIMIT = 0.9;
const SCALE_MIN = 0.3;
const SCALE_MAX = 2.0;
const VRM_BASE_SCALE = 0.8;
const MOVE_SENSITIVITY = 0.003;
const STAGE_BACKGROUND = require('../assets/images/live2d-stage-background.png');
const clampPos = (v: number) => Math.max(-POSITION_LIMIT, Math.min(POSITION_LIMIT, v));
const clampScale = (v: number) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, v));

interface Live2DStageProps {
  isPageFocused: boolean;
  avatarType?: 'live2d' | 'vrm';
  vrmModelUrl?: string;
  vrmAnimationUrl?: string;
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
  onAdjustEnd: () => void;
  modelPositionRef: React.MutableRefObject<{ x: number; y: number }>;
  scaleRef: React.MutableRefObject<number>;
}

export function Live2DStage({
  isPageFocused,
  avatarType = 'live2d',
  vrmModelUrl,
  vrmAnimationUrl,
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

  const handleVrmPhase = useCallback((phase: VRMRenderPhase) => {
    onVrmPhase?.(phase);
  }, [onVrmPhase]);

  const handleVrmError = useCallback((message: string | null) => {
    onVrmError?.(message);
  }, [onVrmError]);

  const handleVrmNotice = useCallback((message: string | null) => {
    onVrmNotice?.(message);
  }, [onVrmNotice]);

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

  const resetVrmTransform = useCallback(() => {
    applyStageTransform(VRM_BASE_SCALE, { x: 0, y: 0 });
    onAdjustEnd();
  }, [applyStageTransform, onAdjustEnd]);

  const beginGesture = useCallback((type: 'pan' | 'pinch') => {
    const active = activeGestureRef.current;
    if (active[type]) return;
    active[type] = true;
  }, []);

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
    const resetGesture = Gesture.Tap()
      .runOnJS(true)
      .numberOfTaps(2)
      .maxDuration(280)
      .maxDelay(260)
      .maxDistance(18)
      .onEnd((_event, success) => {
        if (success) {
          resetVrmTransform();
        }
      });

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

    return Gesture.Simultaneous(transformGesture, Gesture.Exclusive(resetGesture, tapGesture));
  }, [onTap, resetVrmTransform, transformGesture]);

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
    backgroundImage: {
      width: '100%',
      height: '100%',
    },
    gestureRoot: {
      flex: 1,
      width: '100%',
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
    paused: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pausedText: {
      color: cc.textSecondary,
      fontSize: theme.fontSize.callout,
    },
  }), [theme, cc]);

  const stageContent = (
    <ImageBackground
      source={STAGE_BACKGROUND}
      resizeMode="cover"
      style={s.container}
      imageStyle={s.backgroundImage}
    >
      {isPageFocused && shouldRenderVrm && (
        <VRMAvatarView
          modelUrl={vrmModelUrl}
          animationUrl={vrmAnimationUrl}
          style={s.vrmView}
          transparentBackground
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
        />
      )}
      {isPageFocused && shouldRenderVrm && (
        <GestureDetector gesture={vrmStageGesture}>
          <View collapsable={false} style={s.vrmGestureLayer} />
        </GestureDetector>
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
    </ImageBackground>
  );

  if (shouldRenderVrm) {
    return stageContent;
  }

  return (
    <GestureDetector gesture={transformGesture}>
      <View collapsable={false} style={s.gestureRoot}>
        {stageContent}
      </View>
    </GestureDetector>
  );
}
