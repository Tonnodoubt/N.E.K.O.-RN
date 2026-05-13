import { LipSyncService } from '@/services/LipSyncService';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface LipSyncOptions {
  minAmplitude?: number;
  maxAmplitude?: number;
  amplitudeScale?: number;
  attackMs?: number;
  releaseMs?: number;
  curvePower?: number;
  autoStart?: boolean;
}

/**
 * useLipSync Hook - 口型同步钩子
 *
 * 简化 LipSyncService 的使用，提供自动生命周期管理。
 * 默认启用 attack/release 平滑和非线性响应曲线。
 */
export const useLipSync = (options?: LipSyncOptions) => {
  const serviceRef = useRef<LipSyncService | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    serviceRef.current = new LipSyncService({
      minAmplitude: options?.minAmplitude,
      maxAmplitude: options?.maxAmplitude,
      amplitudeScale: options?.amplitudeScale,
      attackMs: options?.attackMs,
      releaseMs: options?.releaseMs,
      curvePower: options?.curvePower,
    });

    if (options?.autoStart) {
      serviceRef.current.start();
      setIsActive(true);
    }

    setConfig(serviceRef.current.getConfig());

    return () => {
      serviceRef.current?.destroy();
      serviceRef.current = null;
      setIsActive(false);
    };
  }, []);

  const start = useCallback(() => {
    if (serviceRef.current && !serviceRef.current.isRunning()) {
      serviceRef.current.start();
      setIsActive(true);
      setConfig(serviceRef.current.getConfig());
    }
  }, []);

  const stop = useCallback(() => {
    if (serviceRef.current && serviceRef.current.isRunning()) {
      serviceRef.current.stop();
      setIsActive(false);
      setConfig(serviceRef.current.getConfig());
    }
  }, []);

  const toggle = useCallback(() => {
    if (isActive) {
      stop();
    } else {
      start();
    }
  }, [isActive, stop, start]);

  const updateConfig = useCallback((newOptions: LipSyncOptions) => {
    if (serviceRef.current) {
      serviceRef.current.updateConfig(newOptions);
      setConfig(serviceRef.current.getConfig());
    }
  }, []);

  const getConfig = useCallback(() => {
    return serviceRef.current?.getConfig() || null;
  }, []);

  return {
    isActive,
    config,
    start,
    stop,
    toggle,
    updateConfig,
    getConfig,
    service: serviceRef.current,
  };
};

export default useLipSync;
