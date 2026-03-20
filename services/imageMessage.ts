import {
  ImageCompressionService,
  type CompressedImage,
} from './imageCompression';

export interface ImageMessagePayload {
  action: 'stream_data';
  input_type: 'image';
  data: string[];
  metadata?: {
    width: number;
    height: number;
    size: number;
    format: string;
  };
}

export class ImageMessageService {
  private compression = new ImageCompressionService();

  /**
   * 处理图片并生成 WebSocket 消息
   * @param images 图片列表（包含 uri 和 base64）
   * @returns 压缩后的图片消息负载
   */
  async processImages(
    images: { uri: string; base64: string; mimeType?: string }[],
    options?: { maxSize?: number; compress?: boolean }
  ): Promise<{
    compressedImages: CompressedImage[];
    payload: ImageMessagePayload;
  }> {
    const maxSize = options?.maxSize ?? 500 * 1024;
    const shouldCompress = options?.compress ?? true;

    let compressedImages: CompressedImage[];

    if (shouldCompress) {
      // 智能压缩每张图片
      compressedImages = await Promise.all(
        images.map((img) => this.compression.smartCompress(img.uri, maxSize))
      );
    } else {
      // 仅调整尺寸，不压缩质量
      compressedImages = await this.compression.compressBatch(images);
    }

    // 构建 WebSocket 消息
    const totalSize = compressedImages.reduce((sum, img) => sum + img.size, 0);

    const payload: ImageMessagePayload = {
      action: 'stream_data',
      input_type: 'image',
      data: compressedImages.map((img) => img.base64),
      metadata: {
        width: compressedImages[0]?.width ?? 0,
        height: compressedImages[0]?.height ?? 0,
        size: totalSize,
        format: 'jpeg',
      },
    };

    return { compressedImages, payload };
  }

  /**
   * 计算压缩进度
   */
  calculateProgress(currentIndex: number, total: number): number {
    return Math.round(((currentIndex + 1) / total) * 100);
  }
}
