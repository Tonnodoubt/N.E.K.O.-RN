import * as ImagePicker from 'expo-image-picker';

export interface ImagePickerResult {
  uri: string;
  base64: string;
  width: number;
  height: number;
  mimeType: string;
}

export class ImagePickerError extends Error {
  constructor(
    public code: 'PERMISSION_DENIED' | 'CANCELED' | 'UNKNOWN',
    message: string
  ) {
    super(message);
    this.name = 'ImagePickerError';
  }
}

export class ImagePickerService {
  /**
   * 请求媒体库权限
   */
  async requestPermission(): Promise<boolean> {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === 'granted';
  }

  /**
   * 检查权限状态
   */
  async checkPermission(): Promise<boolean> {
    const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
    return status === 'granted';
  }

  /**
   * 打开相册选择器
   * @param options 选择配置
   * @param skipPermissionCheck 是否跳过权限检查（如果外部已经检查过权限）
   */
  async pickImage(options?: {
    allowsMultipleSelection?: boolean;
    maxSelectionCount?: number;
  }, skipPermissionCheck?: boolean): Promise<ImagePickerResult[]> {
    // 检查权限（除非外部已经检查过）
    if (!skipPermissionCheck) {
      const hasPermission = await this.requestPermission();
      if (!hasPermission) {
        throw new ImagePickerError('PERMISSION_DENIED', '需要相册权限才能选择图片');
      }
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: options?.allowsMultipleSelection ?? false,
      selectionLimit: options?.maxSelectionCount ?? 5,
      quality: 0.8, // 降低质量以减小 base64 大小
      base64: true,
    });

    if (result.canceled) {
      return [];
    }

    return result.assets.map(asset => ({
      uri: asset.uri,
      base64: asset.base64!,
      width: asset.width,
      height: asset.height,
      mimeType: asset.mimeType ?? 'image/jpeg',
    }));
  }
}
