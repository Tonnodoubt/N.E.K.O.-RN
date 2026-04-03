import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { CameraView, useCameraPermissions, type CameraType } from 'expo-camera';
import {
  CameraStreamService,
  CameraStreamStatus,
} from '@/services/CameraStreamService';

export interface UseCameraStreamConfig {
  sendMessage: (message: object) => void;
  isConnected: boolean;
  isInBackgroundRef: React.RefObject<boolean>;
}

export interface UseCameraStreamReturn {
  isStreaming: boolean;
  status: CameraStreamStatus;
  error: string | null;
  facing: CameraType;
  cameraRef: React.RefObject<CameraView | null>;
  startStreaming: (facing?: CameraType) => void;
  stopStreaming: () => void;
  onCameraReady: () => void;
  hasPermission: boolean | null;
  isCameraReady: boolean;
  checkAndRequestPermission: () => Promise<boolean>;
  /** CameraView 是否应该挂载（用于条件渲染，避免占用摄像头资源） */
  shouldMount: boolean;
}

/**
 * 摄像头流式 Hook（无预览模式）
 */
export function useCameraStream(
  config: UseCameraStreamConfig
): UseCameraStreamReturn {
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView | null>(null);
  const serviceRef = useRef<CameraStreamService | null>(null);

  // 状态
  const [status, setStatus] = useState<CameraStreamStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [facing, setFacing] = useState<CameraType>('front');
  const [isCameraReady, setIsCameraReady] = useState(false);
  // 控制 CameraView 挂载（只在需要时挂载，避免白占摄像头资源）
  const [shouldMount, setShouldMount] = useState(false);

  // 使用 ref 存储配置，避免闭包过期
  const sendMessageRef = useRef(config.sendMessage);
  const isConnectedRef = useRef(config.isConnected);

  // 同步 ref
  useEffect(() => {
    sendMessageRef.current = config.sendMessage;
    isConnectedRef.current = config.isConnected;
  }, [config.sendMessage, config.isConnected]);

  // 初始化 Service
  useEffect(() => {
    const service = new CameraStreamService({
      sendFrame: (payload) => {
        sendMessageRef.current(payload);
      },
      isConnected: () => isConnectedRef.current,
      onStatusChange: (newStatus) => {
        setStatus(newStatus);
      },
      onError: (err) => {
        console.error('❌ CameraStreamService 错误:', err);
        setError(err.message);
        setStatus('error');
      },
      frameInterval: 1500, // 1.5s，与后端原生视觉节奏对齐
    });

    serviceRef.current = service;

    return () => {
      service.dispose();
      serviceRef.current = null;
    };
  }, []);

  // CameraView 就绪回调 —— 此时 CameraView 已挂载，可以启动服务
  const onCameraReady = useCallback(() => {
    console.log('📹 CameraView 已就绪');
    setIsCameraReady(true);
    if (serviceRef.current && cameraRef.current) {
      serviceRef.current.setCameraRef(cameraRef.current);
      serviceRef.current.start();
    }
  }, []);

  // 开始流式传输：设置方向 + 触发 CameraView 挂载，实际启动由 onCameraReady 完成
  const startStreaming = useCallback((selectedFacing?: CameraType) => {
    console.log('📹 请求启动摄像头流，方向:', selectedFacing || facing);
    setIsCameraReady(false);
    if (selectedFacing) {
      setFacing(selectedFacing);
    }
    setShouldMount(true);
  }, [facing]);

  // 停止流式传输
  const stopStreaming = useCallback(() => {
    console.log('📹 停止摄像头流');
    serviceRef.current?.stop();
    setShouldMount(false);
    setError(null);
  }, []);

  // 后台暂停 / 前台恢复
  useEffect(() => {
    const checkBackground = () => {
      const isInBackground = config.isInBackgroundRef.current;
      const service = serviceRef.current;

      if (!service) return;

      if (isInBackground && status === 'streaming') {
        service.pause();
      } else if (!isInBackground && status === 'paused') {
        service.resume();
      }
    };

    const interval = setInterval(checkBackground, 500);
    return () => clearInterval(interval);
  }, [config.isInBackgroundRef, status]);

  // WS 断连处理
  useEffect(() => {
    if (!config.isConnected && status === 'streaming') {
      console.log('📹 WS 断开，停止摄像头流');
      serviceRef.current?.stop();
    }
  }, [config.isConnected, status]);

  // 权限检查辅助函数
  const checkAndRequestPermission = useCallback(async (): Promise<boolean> => {
    if (permission?.granted) return true;

    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        '需要相机权限',
        '请在设置中允许访问相机以使用实时视觉功能',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '去设置',
            onPress: () => {
              const { Linking } = require('react-native');
              Linking.openSettings();
            },
          },
        ]
      );
      return false;
    }
    return true;
  }, [permission, requestPermission]);

  return {
    isStreaming: status === 'streaming' || status === 'paused',
    status,
    error,
    facing,
    cameraRef,
    startStreaming,
    stopStreaming,
    onCameraReady,
    hasPermission: permission?.granted ?? null,
    isCameraReady,
    checkAndRequestPermission,
    shouldMount,
  };
}
