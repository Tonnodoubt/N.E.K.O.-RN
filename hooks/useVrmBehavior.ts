import { useCallback, useEffect, useRef, useState } from 'react';

import type { VRMEmotion, VRMGesture } from '@/components/vrm/VRMAvatarView';

type VRMBehaviorContext = {
  enabled: boolean;
  isVoiceMode: boolean;
  isVisionMode: boolean;
};

export type VRMBehaviorEvent =
  | { type: 'reset' }
  | { type: 'model_changed' }
  | { type: 'connection_ready' }
  | { type: 'connection_lost' }
  | { type: 'session_started'; inputMode?: string }
  | { type: 'session_preparing' }
  | { type: 'session_failed' }
  | { type: 'session_ended' }
  | { type: 'user_message_sent' }
  | { type: 'assistant_response'; isNewMessage?: boolean }
  | { type: 'user_activity' }
  | { type: 'turn_end' }
  | { type: 'response_discarded' }
  | { type: 'status_error' }
  | { type: 'character_switch_start' }
  | { type: 'character_switch_done' }
  | { type: 'voice_ready' }
  | { type: 'voice_stop' }
  | { type: 'voice_failed' }
  | { type: 'vision_preparing' }
  | { type: 'vision_stream_started' }
  | { type: 'vision_stream_frame' }
  | { type: 'vision_stream_paused' }
  | { type: 'vision_stream_stopped' }
  | { type: 'vision_capture_requested' }
  | { type: 'vision_image_captured' }
  | { type: 'vision_image_sent' }
  | { type: 'vision_result'; mood: 'positive' | 'curious' | 'uncertain' | 'alert' }
  | { type: 'vision_failed' }
  | { type: 'tap' };

type EmotionResolver = VRMEmotion | ((context: VRMBehaviorContext) => VRMEmotion);

type VRMBehaviorIntent = {
  baseEmotion?: EmotionResolver;
  flashEmotion?: EmotionResolver;
  fallbackEmotion?: EmotionResolver;
  durationMs?: number;
  priority?: number;
  gesture?: VRMGesture;
  gestureCooldownMs?: number;
  resetGesture?: boolean;
};

type ActiveTransient = {
  priority: number;
  expiresAt: number;
};

const defaultFallbackEmotion = (context: VRMBehaviorContext): VRMEmotion => (
  context.isVoiceMode || context.isVisionMode ? 'attentive' : 'neutral'
);

function resolveEmotion(
  emotion: EmotionResolver | undefined,
  context: VRMBehaviorContext,
): VRMEmotion | undefined {
  return typeof emotion === 'function' ? emotion(context) : emotion;
}

export function resolveVRMBehaviorEvent(
  event: VRMBehaviorEvent,
  context: VRMBehaviorContext,
): VRMBehaviorIntent | null {
  switch (event.type) {
    case 'reset':
    case 'model_changed':
      return { baseEmotion: 'neutral', resetGesture: true, priority: 5 };
    case 'connection_ready':
      return { baseEmotion: defaultFallbackEmotion, priority: 1 };
    case 'connection_lost':
      return {
        flashEmotion: 'sad',
        fallbackEmotion: 'neutral',
        durationMs: 900,
        gesture: 'shake',
        gestureCooldownMs: 1800,
        priority: 3,
      };
    case 'session_started':
      return {
        baseEmotion: event.inputMode === 'audio' ? 'attentive' : defaultFallbackEmotion,
        priority: 2,
      };
    case 'session_preparing':
      return {
        baseEmotion: context.isVoiceMode ? 'attentive' : 'thinking',
        gesture: context.isVoiceMode ? 'tilt' : undefined,
        gestureCooldownMs: 1800,
        priority: 2,
      };
    case 'session_failed':
    case 'session_ended':
    case 'status_error':
    case 'voice_failed':
      return {
        flashEmotion: 'sad',
        fallbackEmotion: defaultFallbackEmotion,
        durationMs: 1300,
        gesture: 'shake',
        gestureCooldownMs: 1500,
        priority: 4,
      };
    case 'vision_failed':
      return {
        flashEmotion: 'sad',
        fallbackEmotion: context.isVoiceMode ? 'attentive' : 'neutral',
        durationMs: 1300,
        gesture: 'shake',
        gestureCooldownMs: 1500,
        priority: 4,
      };
    case 'user_message_sent':
      return {
        baseEmotion: 'thinking',
        gesture: 'tilt',
        gestureCooldownMs: 2200,
        priority: 2,
      };
    case 'assistant_response':
      if (!event.isNewMessage) return null;
      return {
        baseEmotion: 'happy',
        gesture: 'nod',
        gestureCooldownMs: 1200,
        priority: 2,
      };
    case 'user_activity':
      return {
        flashEmotion: 'surprised',
        fallbackEmotion: defaultFallbackEmotion,
        durationMs: 650,
        gesture: 'recoil',
        gestureCooldownMs: 1600,
        priority: 3,
      };
    case 'turn_end':
    case 'response_discarded':
      return { baseEmotion: defaultFallbackEmotion, priority: 1 };
    case 'character_switch_start':
      return { baseEmotion: 'neutral', resetGesture: true, priority: 5 };
    case 'character_switch_done':
      return {
        flashEmotion: 'happy',
        fallbackEmotion: defaultFallbackEmotion,
        durationMs: 850,
        gesture: 'bounce',
        gestureCooldownMs: 1100,
        priority: 2,
      };
    case 'voice_ready':
    case 'vision_preparing':
      return {
        baseEmotion: 'attentive',
        gesture: 'tilt',
        gestureCooldownMs: 1400,
        priority: 2,
      };
    case 'vision_stream_started':
      return {
        flashEmotion: 'happy',
        fallbackEmotion: 'attentive',
        durationMs: 600,
        gesture: 'bounce',
        gestureCooldownMs: 1400,
        priority: 2,
      };
    case 'vision_stream_frame':
      return {
        baseEmotion: 'attentive',
        gesture: 'nod',
        gestureCooldownMs: 4500,
        priority: 1,
      };
    case 'vision_stream_paused':
      return { baseEmotion: 'thinking', priority: 2 };
    case 'vision_stream_stopped':
      return { baseEmotion: context.isVoiceMode ? 'attentive' : 'neutral', priority: 2 };
    case 'vision_capture_requested':
      return {
        baseEmotion: 'attentive',
        gesture: 'tilt',
        gestureCooldownMs: 1600,
        priority: 2,
      };
    case 'vision_image_captured':
      return {
        flashEmotion: 'surprised',
        fallbackEmotion: defaultFallbackEmotion,
        durationMs: 520,
        gesture: 'recoil',
        gestureCooldownMs: 1800,
        priority: 2,
      };
    case 'vision_image_sent':
      return {
        baseEmotion: 'thinking',
        gesture: 'nod',
        gestureCooldownMs: 1600,
        priority: 2,
      };
    case 'vision_result':
      if (event.mood === 'positive') {
        return {
          flashEmotion: 'happy',
          fallbackEmotion: defaultFallbackEmotion,
          durationMs: 900,
          gesture: 'bounce',
          gestureCooldownMs: 1600,
          priority: 3,
        };
      }
      if (event.mood === 'alert') {
        return {
          flashEmotion: 'surprised',
          fallbackEmotion: defaultFallbackEmotion,
          durationMs: 900,
          gesture: 'recoil',
          gestureCooldownMs: 1600,
          priority: 3,
        };
      }
      return {
        baseEmotion: event.mood === 'uncertain' ? 'thinking' : 'attentive',
        gesture: 'tilt',
        gestureCooldownMs: 1800,
        priority: 2,
      };
    case 'voice_stop':
      return { baseEmotion: 'neutral', priority: 2 };
    case 'tap':
      return {
        flashEmotion: 'happy',
        fallbackEmotion: defaultFallbackEmotion,
        durationMs: 900,
        gesture: 'bounce',
        gestureCooldownMs: 900,
        priority: 2,
      };
  }
}

export function useVrmBehavior(context: VRMBehaviorContext) {
  const [emotion, setEmotion] = useState<VRMEmotion>('neutral');
  const [gesture, setGesture] = useState<VRMGesture>('none');
  const [gestureRevision, setGestureRevision] = useState(0);

  const contextRef = useRef(context);
  const baseEmotionRef = useRef<VRMEmotion>('neutral');
  const transientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeTransientRef = useRef<ActiveTransient | null>(null);
  const gestureLastAtRef = useRef<Partial<Record<VRMGesture, number>>>({});

  contextRef.current = context;

  const clearTransient = useCallback((nextEmotion?: VRMEmotion) => {
    if (transientTimerRef.current) {
      clearTimeout(transientTimerRef.current);
      transientTimerRef.current = null;
    }
    activeTransientRef.current = null;
    if (nextEmotion) {
      baseEmotionRef.current = nextEmotion;
      setEmotion(nextEmotion);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (transientTimerRef.current) {
        clearTimeout(transientTimerRef.current);
        transientTimerRef.current = null;
      }
    };
  }, []);

  const applyBaseEmotion = useCallback((nextEmotion: VRMEmotion) => {
    baseEmotionRef.current = nextEmotion;
    if (!activeTransientRef.current || activeTransientRef.current.expiresAt <= Date.now()) {
      activeTransientRef.current = null;
      setEmotion(nextEmotion);
    }
  }, []);

  const applyFlashEmotion = useCallback((
    nextEmotion: VRMEmotion,
    fallbackEmotion: VRMEmotion,
    durationMs: number,
    priority: number,
  ) => {
    const now = Date.now();
    const active = activeTransientRef.current;
    if (active && active.expiresAt > now && active.priority > priority) return;

    if (transientTimerRef.current) {
      clearTimeout(transientTimerRef.current);
      transientTimerRef.current = null;
    }

    activeTransientRef.current = {
      priority,
      expiresAt: now + durationMs,
    };
    baseEmotionRef.current = fallbackEmotion;
    setEmotion(nextEmotion);
    transientTimerRef.current = setTimeout(() => {
      activeTransientRef.current = null;
      transientTimerRef.current = null;
      setEmotion(baseEmotionRef.current);
    }, durationMs);
  }, []);

  const applyGesture = useCallback((nextGesture: VRMGesture, cooldownMs = 0) => {
    if (!contextRef.current.enabled || nextGesture === 'none') return;

    const now = Date.now();
    const lastAt = gestureLastAtRef.current[nextGesture] ?? 0;
    if (cooldownMs > 0 && now - lastAt < cooldownMs) return;

    gestureLastAtRef.current[nextGesture] = now;
    setGesture(nextGesture);
    setGestureRevision((revision) => revision + 1);
  }, []);

  const dispatch = useCallback((event: VRMBehaviorEvent) => {
    const currentContext = contextRef.current;
    const intent = resolveVRMBehaviorEvent(event, currentContext);
    if (!intent) return;

    if (intent.resetGesture) {
      setGesture('none');
      setGestureRevision((revision) => revision + 1);
    }

    const baseEmotion = resolveEmotion(intent.baseEmotion, currentContext);
    if (baseEmotion) {
      applyBaseEmotion(baseEmotion);
    }

    const flashEmotion = resolveEmotion(intent.flashEmotion, currentContext);
    if (flashEmotion) {
      applyFlashEmotion(
        flashEmotion,
        resolveEmotion(intent.fallbackEmotion, currentContext) || baseEmotionRef.current,
        intent.durationMs ?? 900,
        intent.priority ?? 1,
      );
    }

    if (intent.gesture) {
      applyGesture(intent.gesture, intent.gestureCooldownMs);
    }
  }, [applyBaseEmotion, applyFlashEmotion, applyGesture]);

  const reset = useCallback(() => {
    clearTransient('neutral');
    setGesture('none');
    setGestureRevision((revision) => revision + 1);
  }, [clearTransient]);

  return {
    emotion,
    gesture,
    gestureRevision,
    dispatch,
    reset,
  };
}
