import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  NEKO_DEFAULT_VRM_MOTION_CALIBRATION,
  type VRMMotionCalibration,
} from '@/components/vrm/VRMAvatarView';

const STORAGE_KEY = '@neko:vrm_motion_calibration:v1';
const calibrationKeys = Object.keys(
  NEKO_DEFAULT_VRM_MOTION_CALIBRATION,
) as (keyof VRMMotionCalibration)[];

export type VrmMotionCalibrationSnapshot = Required<VRMMotionCalibration>;

function defaultCalibration(): VrmMotionCalibrationSnapshot {
  return { ...NEKO_DEFAULT_VRM_MOTION_CALIBRATION };
}

function clampCalibrationValue(value: number): number {
  return Math.max(0, Math.min(2, value));
}

export function normalizeVrmMotionCalibration(
  calibration?: VRMMotionCalibration | null,
): VrmMotionCalibrationSnapshot {
  const next = defaultCalibration();
  if (!calibration) return next;

  for (const key of calibrationKeys) {
    const value = calibration[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = clampCalibrationValue(value);
    }
  }

  return next;
}

export async function getStoredVrmMotionCalibration(): Promise<VrmMotionCalibrationSnapshot> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultCalibration();
    return normalizeVrmMotionCalibration(JSON.parse(raw));
  } catch (error) {
    console.error('[VrmMotionCalibration] Failed to load calibration', error);
    return defaultCalibration();
  }
}

export async function setStoredVrmMotionCalibration(
  calibration: VRMMotionCalibration,
): Promise<VrmMotionCalibrationSnapshot> {
  const next = normalizeVrmMotionCalibration(calibration);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (error) {
    console.error('[VrmMotionCalibration] Failed to save calibration', error);
  }
  return next;
}

export async function clearStoredVrmMotionCalibration(): Promise<VrmMotionCalibrationSnapshot> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[VrmMotionCalibration] Failed to clear calibration', error);
  }
  return defaultCalibration();
}

export function useVrmMotionCalibration() {
  const [calibration, setCalibration] = useState<VrmMotionCalibrationSnapshot>(
    defaultCalibration,
  );
  const [isLoaded, setIsLoaded] = useState(false);

  const loadCalibration = useCallback(async () => {
    const next = await getStoredVrmMotionCalibration();
    setCalibration(next);
    setIsLoaded(true);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    getStoredVrmMotionCalibration()
      .then((next) => {
        if (cancelled) return;
        setCalibration(next);
        setIsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) setIsLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const saveCalibration = useCallback(async (nextCalibration: VRMMotionCalibration) => {
    const next = await setStoredVrmMotionCalibration(nextCalibration);
    setCalibration(next);
    return next;
  }, []);

  const resetCalibration = useCallback(async () => {
    const next = await clearStoredVrmMotionCalibration();
    setCalibration(next);
    return next;
  }, []);

  return {
    calibration,
    isLoaded,
    loadCalibration,
    saveCalibration,
    resetCalibration,
  };
}
