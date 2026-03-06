import { useState, useCallback, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import {
  CameraService,
  type CameraResult,
  CameraError,
} from '@/services/camera';

export interface UseCameraReturn {
  photo: CameraResult | null;
  isLoading: boolean;
  error: string | null;
  takePhoto: () => Promise<void>;
  clearPhoto: () => void;
  hasPermission: boolean | null;
  checkPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
}

export function useCamera(): UseCameraReturn {
  const [photo, setPhoto] = useState<CameraResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // 使用 useRef 保持 service 实例稳定，避免重新渲染时创建新实例
  const serviceRef = useRef<CameraService>(new CameraService());
  const service = serviceRef.current;

  const checkPermission = useCallback(async (): Promise<boolean> => {
    const granted = await service.checkPermission();
    setHasPermission(granted);
    return granted;
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    const granted = await service.requestPermission();
    setHasPermission(granted);

    if (!granted) {
      Alert.alert(
        '需要相机权限',
        '请在设置中允许访问相机以拍照',
        [
          { text: '取消', style: 'cancel' },
          {
            text: '去设置',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
    }

    return granted;
  }, []);

  const takePhoto = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 统一使用 expo-image-picker 的权限 API（已封装在服务层）
      console.log('📷 检查相机权限...');
      const currentStatus = await service.checkPermission();
      console.log('📷 当前权限状态:', currentStatus);

      let hasCameraPermission = currentStatus;

      if (!currentStatus) {
        console.log('📷 请求相机权限...');
        hasCameraPermission = await service.requestPermission();
        console.log('📷 权限请求结果:', hasCameraPermission);
      }

      setHasPermission(hasCameraPermission);

      if (!hasCameraPermission) {
        console.log('❌ 相机权限被拒绝');
        setError('需要相机权限');
        Alert.alert(
          '需要相机权限',
          '请允许访问相机以拍照。您可以在系统设置中更改权限。',
          [
            { text: '取消', style: 'cancel' },
            {
              text: '去设置',
              onPress: () => Linking.openSettings(),
            },
          ]
        );
        return;
      }

      // 权限已获取，打开相机（跳过服务层权限检查）
      console.log('✅ 相机权限已获取，打开相机...');
      const result = await service.takePhoto(
        {
          quality: 0.9,
          allowsEditing: false,
        },
        true // 跳过权限检查，因为上面已经检查过了
      );

      if (result) {
        setPhoto(result);
      }
    } catch (err) {
      if (err instanceof CameraError) {
        if (err.code === 'PERMISSION_DENIED') {
          setError('需要相机权限');
          Alert.alert(
            '需要相机权限',
            '请在设置中允许访问相机以拍照',
            [
              { text: '取消', style: 'cancel' },
              {
                text: '去设置',
                onPress: () => Linking.openSettings(),
              },
            ]
          );
        } else if (err.code === 'CANCELED') {
          // 用户取消，不需要显示错误
          console.log('👤 用户取消拍照');
        } else {
          setError('拍照失败');
        }
      } else {
        console.error('拍照时发生错误:', err);
        setError('拍照时发生错误');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPhoto = useCallback(() => {
    setPhoto(null);
    setError(null);
  }, []);

  return {
    photo,
    isLoading,
    error,
    takePhoto,
    clearPhoto,
    hasPermission,
    checkPermission,
    requestPermission,
  };
}
