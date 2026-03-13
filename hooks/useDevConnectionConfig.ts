import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_DEV_CONNECTION_CONFIG,
  parseDevConnectionConfig,
  type DevConnectionConfig,
} from '@/utils/devConnectionConfig';
import { clearStoredDevConnectionConfig, getStoredDevConnectionConfig, setStoredDevConnectionConfig } from '@/services/DevConnectionStorage';
import { queryDeviceInfo } from '@/services/CloudRegistryService';

export type ApplyQrResult =
  | { ok: true; config: DevConnectionConfig; isP2p?: boolean }
  | { ok: false; error: string };

export function useDevConnectionConfig(): {
  config: DevConnectionConfig;
  isLoaded: boolean;
  setConfig: (next: Partial<DevConnectionConfig> | ((prev: DevConnectionConfig) => DevConnectionConfig)) => Promise<DevConnectionConfig>;
  applyQrRaw: (raw: string) => Promise<ApplyQrResult>;
  refreshFromCloud: () => Promise<boolean>;  // 从云端刷新
  clear: () => Promise<void>;
  reload: () => Promise<void>;  // 重新加载配置
} {
  const [config, _setConfig] = useState<DevConnectionConfig>(DEFAULT_DEV_CONNECTION_CONFIG);
  const [isLoaded, setIsLoaded] = useState(false);
  const configRef = useRef<DevConnectionConfig>(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await getStoredDevConnectionConfig();
      if (cancelled) return;
      _setConfig(stored);
      setIsLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setConfig = useCallback(
    async (next: Partial<DevConnectionConfig> | ((prev: DevConnectionConfig) => DevConnectionConfig)) => {
      const prev = configRef.current;
      const computed =
        typeof next === 'function' ? (next as (p: DevConnectionConfig) => DevConnectionConfig)(prev) : { ...prev, ...next };
      _setConfig(computed);
      configRef.current = computed;
      // 统一走 storage 的 sanitize + merge
      const persisted = await setStoredDevConnectionConfig(computed);
      _setConfig(persisted);
      configRef.current = persisted;
      return persisted;
    },
    []
  );

  const applyQrRaw = useCallback(
    async (raw: string): Promise<ApplyQrResult> => {
      const parsed = parseDevConnectionConfig(raw);
      if (!parsed) return { ok: false, error: '二维码内容不可解析（请扫 JSON / URL / host:port 格式）' };
      const isP2p = !!parsed.p2p;
      const next = await setConfig((prev) => ({ ...prev, ...parsed }));
      return { ok: true, config: next, isP2p };
    },
    [setConfig]
  );

  const clear = useCallback(async () => {
    await clearStoredDevConnectionConfig();
    _setConfig(DEFAULT_DEV_CONNECTION_CONFIG);
    configRef.current = DEFAULT_DEV_CONNECTION_CONFIG;
  }, []);

  /** 从 AsyncStorage 重新加载配置（用于其他页面写入后同步到当前实例）。 */
  const reload = useCallback(async () => {
    const stored = await getStoredDevConnectionConfig();
    _setConfig(stored);
    configRef.current = stored;
  }, []);

  /**
   * 从云端刷新设备信息（如果配置中有 deviceId）
   */
  const refreshFromCloud = useCallback(async (): Promise<boolean> => {
    const currentConfig = configRef.current;

    // 如果没有 P2P 配置或 deviceId，跳过
    if (!currentConfig.p2p?.deviceId) {
      console.log('[useDevConnectionConfig] 没有 deviceId，跳过云端刷新');
      return false;
    }

    try {
      console.log(`[useDevConnectionConfig] 从云端刷新设备信息: ${currentConfig.p2p.deviceId}`);
      const latest = await queryDeviceInfo(currentConfig.p2p.deviceId);

      if (latest) {
        await setConfig(latest);
        console.log('[useDevConnectionConfig] 云端刷新成功');
        return true;
      } else {
        console.log('[useDevConnectionConfig] 云端查询失败');
        return false;
      }
    } catch (e) {
      console.error('[useDevConnectionConfig] 云端刷新异常:', e);
      return false;
    }
  }, [setConfig]);

  return { config, isLoaded, setConfig, applyQrRaw, refreshFromCloud, clear, reload };
}

