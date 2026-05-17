import { AudioService, AudioStats } from '@/services/AudioService';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { DevConnectionConfig } from '@/utils/devConnectionConfig';

interface UseAudioConfig {
  host: string;
  port: number;
  characterName: string;
  // P2P 配置（可选）
  p2p?: DevConnectionConfig['p2p'];
  // 配置是否已加载完成，为 false 时不初始化连接
  enabled?: boolean;
  onMessage?: (event: MessageEvent) => void;
  onConnectionChange?: (isConnected: boolean) => void;
  // 🔥 新增：角色切换标志 ref，用于在切换期间忽略错误
  isSwitchingRef?: React.RefObject<boolean>;
  // 🔥 新增：应用是否在后台的标志 ref，用于在应用进入后台期间忽略 WebSocket 错误
  isInBackgroundRef?: React.RefObject<boolean>;
}

export type AudioConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'failed';

export interface UseAudioReturn {
  // 状态
  isConnected: boolean;
  isConnectedRef: React.MutableRefObject<boolean>;
  isRecording: boolean;
  connectionStatus: string;
  connectionPhase: AudioConnectionPhase;
  connectionError: string | null;
  audioStats: AudioStats;

  // 方法
  toggleRecording: () => Promise<void>;
  clearAudioQueue: () => void;
  handleUserSpeechDetection: () => void;
  sendMessage: (message: string | object) => void;
  reconnect: () => void;

  // 原始 Service 引用（供高级用户使用）
  audioService: AudioService | null;

  // 🔥 新增：AudioService 是否完全就绪的 ref（避免闭包引用问题）
  isReadyRef: React.RefObject<boolean>;
}

function errorToString(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function getConnectionErrorMessage(error: unknown, config: UseAudioConfig): string {
  const raw = errorToString(error);
  const lower = raw.toLowerCase();

  if (config.p2p?.token && /401|403|token|credential|unauthorized|forbidden|invalid/.test(lower)) {
    return '连接凭证可能已失效，请重新扫码。';
  }

  if (/timeout|timed out|network|failed to connect|econnrefused|1006|abnormal/.test(lower)) {
    return `无法连接 ${config.host}:${config.port}。请确认电脑端在线、手机和电脑在同一网络，或重新扫码。`;
  }

  return raw ? `连接失败：${raw}` : '连接失败，请重试或重新扫码。';
}

export const useAudio = (config: UseAudioConfig): UseAudioReturn => {
  // 状态管理
  const [isConnected, setIsConnected] = useState(false);
  const isConnectedRef = useRef(false);
  const [isRecording, setIsRecording] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('未连接');
  const [connectionPhase, setConnectionPhase] = useState<AudioConnectionPhase>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [audioStats, setAudioStats] = useState<AudioStats>({
    audioChunksCount: 0,
    sendCount: 0,
    tempBufferLength: 0,
    isStreaming: false,
    isPlaying: false,
    feedbackControlStatus: '正常',
    isSpeechDetected: false,
  });

  // Service 引用（内部使用 ref，外部暴露 state 以避免 stale snapshot）
  const audioServiceRef = useRef<AudioService | null>(null);
  const [audioService, setAudioService] = useState<AudioService | null>(null);

  // 🔥 AudioService 是否完全就绪的 ref（避免闭包引用问题）
  const isReadyRef = useRef<boolean>(false);

  // 切换录音状态
  const toggleRecording = async () => {
    if (!audioServiceRef.current) {
      console.warn('⚠️ 音频服务未初始化');
      return;
    }

    await audioServiceRef.current.toggleRecording();
  };

  // 清空音频队列
  const clearAudioQueue = () => {
    audioServiceRef.current?.clearAudioQueue();
  };

  // 处理用户语音检测（打断）
  const handleUserSpeechDetection = () => {
    audioServiceRef.current?.handleUserSpeechDetection();
  };

  // 发送消息
  const sendMessage = (message: string | object) => {
    audioServiceRef.current?.sendMessage(message);
  };

  // 稳定化 P2P token，避免对象引用变化导致不必要的重连
  const p2pToken = config.p2p?.token;

  // 重连 key：递增触发 useEffect 销毁旧连接并重建
  const [reconnectKey, setReconnectKey] = useState(0);
  const hasConnectedRef = useRef(false);

  const reconnect = useCallback(() => {
    console.log('🔄 手动触发重连');
    setConnectionPhase((prev) => prev === 'idle' ? 'connecting' : 'reconnecting');
    setConnectionStatus('重新连接中...');
    setConnectionError(null);
    setReconnectKey(k => k + 1);
  }, []);

  // 自动重连定时器
  const autoReconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件初始化
  useEffect(() => {
    // 配置未加载完成时不初始化连接，避免用 DEFAULT config 发起无效连接
    if (config.enabled === false) {
      console.log('🎧 useAudio 跳过初始化（配置未就绪）');
      setConnectionPhase('idle');
      setConnectionStatus('等待连接配置');
      return;
    }

    console.log('🎧 useAudio 初始化中...', {
      host: config.host,
      port: config.port,
      characterName: config.characterName,
      p2pToken: p2pToken ? '***' : undefined,
    });
    setConnectionPhase(hasConnectedRef.current ? 'reconnecting' : 'connecting');
    setConnectionStatus(hasConnectedRef.current ? '重新连接中...' : '连接中...');
    setConnectionError(null);

    // 创建 AudioService
    const service = new AudioService({
      host: config.host,
      port: config.port,
      characterName: config.characterName,
      p2p: config.p2p,
      onConnectionChange: (connected) => {
        isConnectedRef.current = connected;
        setIsConnected(connected);
        setConnectionStatus(connected ? '已连接' : '未连接');
        if (connected) {
          hasConnectedRef.current = true;
          setConnectionPhase('connected');
          setConnectionError(null);
          // 连接恢复，清除自动重连定时器
          if (autoReconnectTimerRef.current) {
            clearTimeout(autoReconnectTimerRef.current);
            autoReconnectTimerRef.current = null;
          }
        } else {
          setConnectionPhase(hasConnectedRef.current ? 'reconnecting' : 'disconnected');
          // 连接断开，延迟后触发重建（兜底 realtime client 内部重连耗尽的情况）
          if (autoReconnectTimerRef.current) clearTimeout(autoReconnectTimerRef.current);
          autoReconnectTimerRef.current = setTimeout(() => {
            autoReconnectTimerRef.current = null;
            console.log('🔄 连接断开超时，触发完整重建');
            setReconnectKey(k => k + 1);
          }, 20_000); // realtime client 内部重连最多 5*3s=15s，给 20s 余量
        }
        config.onConnectionChange?.(connected);
      },
      onMessage: (event) => {
        config.onMessage?.(event);
      },
      onError: (error) => {
        // 🔥 修复：在角色切换期间忽略错误，避免显示"连接错误"
        if (config.isSwitchingRef?.current) {
          console.log('🔄 角色切换中，忽略 WebSocket 错误:', error);
          return;
        }
        // 🔥 修复：在应用进入后台期间忽略错误（如拍照时）
        if (config.isInBackgroundRef?.current) {
          console.log('📷 应用处于后台，忽略 WebSocket 错误:', error);
          return;
        }
        console.warn('⚠️ 音频服务错误:', error);
        const message = getConnectionErrorMessage(error, config);
        setConnectionStatus('连接错误');
        setConnectionPhase(hasConnectedRef.current ? 'reconnecting' : 'failed');
        setConnectionError(message);
      },
      onRecordingStateChange: (recording) => {
        setIsRecording(recording);
      },
      onAudioStatsUpdate: (stats) => {
        setAudioStats(stats);
      },
    });

    audioServiceRef.current = service;
    setAudioService(service);

    // 初始化服务（先 .then 再 .catch，避免 catch 后 then 仍执行的问题）
    service.init().then(() => {
      // 守护：若 cleanup 已执行（旧 service 已换），忽略此回调，避免污染 isReadyRef
      if (audioServiceRef.current !== service) return;
      if (service.isReady()) {
        console.log('✅ AudioService 已完全就绪，更新 isReadyRef');
        isReadyRef.current = true;
      }
    }).catch(error => {
      if (audioServiceRef.current !== service) return;
      console.error('❌ AudioService 初始化失败:', error);
      setConnectionStatus('初始化失败');
      setConnectionPhase('failed');
      setConnectionError(getConnectionErrorMessage(error, config));
      isReadyRef.current = false;
    });

    // 清理函数
    return () => {
      console.log('🧹 useAudio 清理中...');
      if (autoReconnectTimerRef.current) {
        clearTimeout(autoReconnectTimerRef.current);
        autoReconnectTimerRef.current = null;
      }
      audioServiceRef.current?.destroy();
      audioServiceRef.current = null;
      setAudioService(null);
      setIsRecording(false);
      setIsConnected(false);
      isReadyRef.current = false;
    };
  }, [config.host, config.port, config.characterName, p2pToken, config.enabled, reconnectKey]);

  return {
    // 状态
    isConnected,
    isConnectedRef,
    isRecording,
    connectionStatus,
    connectionPhase,
    connectionError,
    audioStats,

    // 方法
    toggleRecording,
    clearAudioQueue,
    handleUserSpeechDetection,
    sendMessage,
    reconnect,

    // 原始 Service 引用（供高级用户使用）
    audioService,

    // AudioService 是否完全就绪的 ref（避免闭包引用问题）
    isReadyRef,
  };
};
