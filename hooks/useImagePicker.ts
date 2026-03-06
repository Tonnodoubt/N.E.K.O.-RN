import { useState, useCallback, useRef } from 'react';
import { Alert, Linking } from 'react-native';
import {
  ImagePickerService,
  ImagePickerResult,
  ImagePickerError,
} from '@/services/imagePicker';

export interface UseImagePickerOptions {
  maxSelectionCount?: number;
  allowsMultipleSelection?: boolean;
}

export interface UseImagePickerReturn {
  images: ImagePickerResult[];
  isLoading: boolean;
  error: string | null;
  pickImages: () => Promise<void>;
  removeImage: (index: number) => void;
  clearImages: () => void;
  hasPermission: boolean | null;
  checkPermission: () => Promise<boolean>;
  requestPermission: () => Promise<boolean>;
}

export function useImagePicker(
  options: UseImagePickerOptions = {}
): UseImagePickerReturn {
  const [images, setImages] = useState<ImagePickerResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // 使用 useRef 保持 service 实例稳定，避免重新渲染时创建新实例
  const serviceRef = useRef<ImagePickerService>(new ImagePickerService());
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
        '需要相册权限',
        '请在设置中允许访问相册以选择图片',
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

  const pickImages = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // 统一使用 expo-image-picker 的权限 API（已封装在服务层）
      console.log('📷 检查相册权限...');
      const currentStatus = await service.checkPermission();
      console.log('📷 当前权限状态:', currentStatus);

      let hasMediaPermission = currentStatus;

      if (!currentStatus) {
        console.log('📷 请求相册权限...');
        hasMediaPermission = await service.requestPermission();
        console.log('📷 权限请求结果:', hasMediaPermission);
      }

      setHasPermission(hasMediaPermission);

      if (!hasMediaPermission) {
        console.log('❌ 相册权限被拒绝');
        setError('需要相册权限');
        Alert.alert(
          '需要相册权限',
          '请允许访问相册以选择图片。您可以在系统设置中更改权限。',
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

      // 权限已获取，打开相册（跳过服务层权限检查）
      console.log('✅ 相册权限已获取，打开相册...');
      const results = await service.pickImage(
        {
          allowsMultipleSelection: options.allowsMultipleSelection ?? false,
          maxSelectionCount: options.maxSelectionCount ?? 5,
        },
        true // 跳过权限检查，因为上面已经检查过了
      );

      if (results.length > 0) {
        setImages((prev) =>
          [...prev, ...results].slice(0, options.maxSelectionCount ?? 5)
        );
      }
    } catch (err) {
      if (err instanceof ImagePickerError) {
        if (err.code === 'PERMISSION_DENIED') {
          setError('需要相册权限');
          Alert.alert(
            '需要相册权限',
            '请在设置中允许访问相册以选择图片',
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
          console.log('👤 用户取消选择图片');
        } else {
          setError('选择图片失败');
        }
      } else {
        console.error('选择图片时发生错误:', err);
        setError('选择图片时发生错误');
      }
    } finally {
      setIsLoading(false);
    }
  }, [options.allowsMultipleSelection, options.maxSelectionCount]);

  const removeImage = useCallback((index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const clearImages = useCallback(() => {
    setImages([]);
    setError(null);
  }, []);

  return {
    images,
    isLoading,
    error,
    pickImages,
    removeImage,
    clearImages,
    hasPermission,
    checkPermission,
    requestPermission,
  };
}
