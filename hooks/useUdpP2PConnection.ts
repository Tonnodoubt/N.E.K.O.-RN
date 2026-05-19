/**
 * UDP P2P 连接 Hook
 *
 * 自动处理 UDP P2P 两层连接，并更新 config 中的 host 和 port
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { UdpP2PClient, type TcpEndpoint } from '@/services/UdpP2PClient';
import { appendP2PToken } from '@/utils/devConnectionConfig';
import type { DevConnectionConfig } from '@/utils/devConnectionConfig';

export type UdpConnectionStatus = 'idle' | 'connecting' | 'connected' | 'failed';

export function useUdpP2PConnection(
  config: DevConnectionConfig,
  isConfigLoaded: boolean,
  setConfig: (next: Partial<DevConnectionConfig> | ((prev: DevConnectionConfig) => DevConnectionConfig)) => Promise<DevConnectionConfig>,
  refreshFromCloud: () => Promise<DevConnectionConfig | null>
): {
  status: UdpConnectionStatus;
  endpoint: TcpEndpoint | null;
  layer: number | null;
  isConnecting: boolean;
  retry: () => void;
  logs: string[];
} {
  const [status, setStatus] = useState<UdpConnectionStatus>('idle');
  const [endpoint, setEndpoint] = useState<TcpEndpoint | null>(null);
  const [layer, setLayer] = useState<number | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    setLogs(prev => [...prev.slice(-49), `[${ts}] ${msg}`]);
    console.log(`[useUdpP2PConnection] ${msg}`);
  };

  // 使用 ref 防止重复连接
  const hasAttemptedRef = useRef(false);
  const lastTokenRef = useRef<string | undefined>(undefined);
  const latestConfigRef = useRef(config);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    latestConfigRef.current = config;
  }, [config]);

  const retry = useCallback(() => {
    hasAttemptedRef.current = false;
    setEndpoint(null);
    setLayer(null);
    setStatus('idle');
    setRetryKey(key => key + 1);
  }, []);

  useEffect(() => {
    const token = config.p2p?.token;
    if (lastTokenRef.current === token) return;
    lastTokenRef.current = token;
    hasAttemptedRef.current = false;
    setEndpoint(null);
    setLayer(null);
    setStatus(config.p2p ? (token ? 'idle' : 'failed') : 'connected');
  }, [config.p2p, config.p2p?.token]);

  useEffect(() => {
    // 如果配置未加载，跳过
    if (!isConfigLoaded) {
      return;
    }

    // 如果没有 P2P 配置，标记为已连接（普通 HTTP 模式）
    if (!config.p2p) {
      console.log('[useUdpP2PConnection] 没有 P2P 配置，使用普通连接');
      if (status === 'idle') {
        setStatus('connected');
      }
      return;
    }

    if (!config.p2p.token) {
      console.log('[useUdpP2PConnection] P2P 配置缺少 token，等待重新扫码或 pairing 刷新');
      setStatus('failed');
      return;
    }

    // 如果已经尝试过，跳过
    if (hasAttemptedRef.current) {
      return;
    }

    // 开始连接
    let cancelled = false;
    let client: UdpP2PClient | null = null;

    const connect = async () => {
      hasAttemptedRef.current = true;
      setStatus('connecting');
      let activeConfig = latestConfigRef.current;
      addLog(`开始连接，P2P token: ${activeConfig.p2p?.token?.slice(0, 8)}...`);

      // 1. 先尝试 LAN 直连测试（如果在同一 WiFi 环境）
      if (activeConfig.p2p?.lanIp && activeConfig.p2p?.lanPort) {
        addLog(`第1层：LAN 直连 ${activeConfig.p2p.lanIp}:${activeConfig.p2p.lanPort}`);
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 5000);
          const testResponse = await fetch(
            appendP2PToken(`http://${activeConfig.p2p.lanIp}:${activeConfig.p2p.lanPort}/health`, activeConfig.p2p.token),
            {
              method: 'GET',
              headers: activeConfig.p2p.token ? { 'X-Proxy-Token': activeConfig.p2p.token } : undefined,
              signal: controller.signal,
            }
          );
          clearTimeout(timeoutId);
          if (cancelled) return;
          addLog(`✅ 第1层可达：LAN HTTP ${testResponse.status}`);
          await setConfig((prev) => ({
            ...prev,
            host: activeConfig.p2p!.lanIp!,
            port: activeConfig.p2p!.lanPort!,
          }));
          setStatus('connected');
          setEndpoint({ ip: activeConfig.p2p.lanIp, port: activeConfig.p2p.lanPort });
          setLayer(1);
          return;
        } catch (e) {
          addLog(`⏱️ 第1层失败：${e instanceof Error ? e.message : String(e)}`);
        }
      }

      addLog('开始 UDP P2P 连接...');
      try {
        // 2. 先从云端刷新最新配置（如果有 deviceId）
        if (activeConfig.p2p?.deviceId) {
          addLog(`从云端刷新配置: ${activeConfig.p2p.deviceId}`);
          const refreshed = await refreshFromCloud();
          if (cancelled) return;
          if (refreshed) activeConfig = refreshed;
          addLog(refreshed ? '云端刷新成功' : '云端刷新失败，使用本地配置');
        }

        // 3. 创建 UDP 客户端
        if (!activeConfig.p2p?.token) {
          addLog('❌ P2P token 不存在');
          setStatus('failed');
          return;
        }
        client = new UdpP2PClient({
          token: activeConfig.p2p.token,
          deviceId: activeConfig.p2p.deviceId,
          lanIp: activeConfig.p2p.lanIp,
          lanPort: activeConfig.p2p.lanPort,
          stunIp: activeConfig.p2p.stunIp,
          stunPort: activeConfig.p2p.stunPort,
          cloudRegistryUrl: process.env.EXPO_PUBLIC_CLOUD_REGISTRY_URL,
        });

        // 4. 先注册事件监听，再发起连接
        client.on('log', (msg: string) => addLog(`[client] ${msg}`));
        client.on('connected', ({ layer: connectedLayer, method }) => {
          addLog(`✅ 第${connectedLayer}层成功：${method}`);
          setLayer(connectedLayer);
        });

        addLog(`stunIp=${activeConfig.p2p.stunIp} stunPort=${activeConfig.p2p.stunPort}`);

        const tcpEndpoint = await client.connect();
        if (cancelled) return;

        if (tcpEndpoint) {
          addLog(`连接成功，TCP endpoint: ${tcpEndpoint.ip}:${tcpEndpoint.port}`);
          await setConfig((prev) => ({
            ...prev,
            host: tcpEndpoint.ip,
            port: tcpEndpoint.port,
          }));
          setStatus('connected');
          setEndpoint(tcpEndpoint);
        } else {
          addLog('❌ 所有连接方式都失败');
          setStatus('failed');
          setLayer(null);
        }
      } catch (e) {
        addLog(`❌ 连接异常: ${e instanceof Error ? e.message : String(e)}`);
        setStatus('failed');
      }
    };

    // 延迟 1 秒后连接（等待配置稳定）
    const timer = setTimeout(connect, 1000);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      client?.disconnect();
    };
  }, [
    isConfigLoaded,
    config.p2p?.token,
    config.p2p?.lanIp,
    config.p2p?.lanPort,
    config.p2p?.stunIp,
    config.p2p?.stunPort,
    retryKey,
    refreshFromCloud,
    setConfig,
  ]);

  return {
    status,
    endpoint,
    layer,
    isConnecting: status === 'connecting',
    retry,
    logs,
  };
}
