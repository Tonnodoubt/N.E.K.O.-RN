import * as ImageManipulator from 'expo-image-manipulator';

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png';
}

export interface CompressedImage {
  uri: string;
  base64: string;
  width: number;
  height: number;
  size: number;
}

export class ImageCompressionService {
  private defaultOptions: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 0.8,
    format: 'jpeg',
  };

  /**
   * 压缩图片
   */
  async compress(
    uri: string,
    options?: CompressionOptions
  ): Promise<CompressedImage> {
    const opts = { ...this.defaultOptions, ...options };

    // 获取原始尺寸
    const original = await ImageManipulator.manipulateAsync(uri, [], {});

    // 计算缩放比例
    let { width, height } = original;
    const ratio = Math.min(
      opts.maxWidth! / width,
      opts.maxHeight! / height,
      1
    );

    if (ratio < 1) {
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    // 执行压缩
    const compressed = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width, height } }],
      {
        compress: opts.quality,
        format: opts.format === 'png'
          ? ImageManipulator.SaveFormat.PNG
          : ImageManipulator.SaveFormat.JPEG,
        base64: true,
      }
    );

    // 计算 base64 大小
    const base64Size = compressed.base64
      ? Math.round((compressed.base64.length * 3) / 4)
      : 0;

    return {
      uri: compressed.uri,
      base64: `data:image/${opts.format};base64,${compressed.base64}`,
      width,
      height,
      size: base64Size,
    };
  }

  /**
   * 智能压缩：自动降低质量直到满足大小限制
   */
  async smartCompress(
    uri: string,
    maxSize: number = 500 * 1024
  ): Promise<CompressedImage> {
    const qualities = [0.9, 0.8, 0.7, 0.6, 0.5];

    for (const quality of qualities) {
      const result = await this.compress(uri, {
        quality,
        maxWidth: 1920,
        maxHeight: 1080,
      });

      if (result.size <= maxSize) {
        return result;
      }
    }

    // 如果还是太大，降低分辨率
    return this.compress(uri, {
      quality: 0.5,
      maxWidth: 1280,
      maxHeight: 720,
    });
  }

  /**
   * 批量压缩
   */
  async compressBatch(
    images: { uri: string; base64?: string }[],
    options?: CompressionOptions
  ): Promise<CompressedImage[]> {
    return Promise.all(
      images.map(img => this.compress(img.uri, options))
    );
  }
}
