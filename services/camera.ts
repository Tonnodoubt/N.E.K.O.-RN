import * as ImagePicker from 'expo-image-picker';

export interface CameraResult {
  uri: string;
  base64: string;
  width: number;
  height: number;
  mimeType: string;
}

export class CameraError extends Error {
  constructor(
    public code: 'PERMISSION_DENIED' | 'CANCELED' | 'UNKNOWN',
    message: string
  ) {
    super(message);
    this.name = 'CameraError';
  }
}

export class CameraService {
  /**
   * 请求相机权限
   */
  async requestPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    return status === 'granted';
  }

  /**
   * 检查相机权限状态
   */
  async checkPermission(): Promise<boolean> {
    const { status } = await ImagePicker.getCameraPermissionsAsync();
    return status === 'granted';
  }

  /**
   * 启动相机拍照
   * @param options 拍照配置
   * @param skipPermissionCheck 是否跳过权限检查（如果外部已经检查过权限）
   */
  async takePhoto(options?: {
    quality?: number;
    allowsEditing?: boolean;
  }, skipPermissionCheck?: boolean): Promise<CameraResult | null> {
    // 检查权限（除非外部已经检查过）
    if (!skipPermissionCheck) {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new CameraError('PERMISSION_DENIED', '需要相机权限才能拍照');
      }
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: options?.quality ?? 0.8,
      allowsEditing: options?.allowsEditing ?? false,
      base64: true,
    });

    if (result.canceled) {
      return null;
    }

    const asset = result.assets[0];
    return {
      uri: asset.uri,
      base64: asset.base64!,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? 'image/jpeg',
    };
  }
}
