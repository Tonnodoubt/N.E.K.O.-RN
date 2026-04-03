import { CameraView } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';

export type CameraStreamStatus = 'idle' | 'streaming' | 'paused' | 'error';

export interface CameraStreamConfig {
  sendFrame: (payload: object) => void;
  isConnected: () => boolean;
  onStatusChange?: (status: CameraStreamStatus) => void;
  onError?: (error: Error) => void;
  frameInterval?: number;
}

/**
 * 延迟让出主线程的辅助函数
 */
const yieldToMain = (ms: number = 0): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

/**
 * 摄像头流式服务
 * 使用 aggressive yielding 策略避免阻塞 JS 线程
 */
export class CameraStreamService {
  private cameraRef: CameraView | null = null;
  private isCapturing = false;
  private status: CameraStreamStatus = 'idle';
  private timeoutId: ReturnType<typeof setTimeout> | null = null;

  private readonly config: CameraStreamConfig;
  private readonly frameInterval: number;

  constructor(config: CameraStreamConfig) {
    this.config = config;
    this.frameInterval = config.frameInterval ?? 1500; // 默认 1.5s，与后端原生视觉节奏对齐
  }

  private setStatus(status: CameraStreamStatus) {
    if (this.status === status) return;
    this.status = status;
    this.config.onStatusChange?.(status);
  }

  getStatus(): CameraStreamStatus {
    return this.status;
  }

  setCameraRef(ref: CameraView | null) {
    this.cameraRef = ref;
  }

  start() {
    if (this.status === 'streaming' || this.status === 'paused') {
      console.log('📹 摄像头流已在运行');
      return;
    }

    if (!this.cameraRef) {
      console.warn('⚠️ CameraView ref 未设置');
      this.setStatus('error');
      this.config.onError?.(new Error('CameraView ref 未设置'));
      return;
    }

    console.log('📹 启动摄像头流');
    this.setStatus('streaming');
    this.scheduleNextCapture(0);
  }

  private scheduleNextCapture(delayMs: number = this.frameInterval) {
    if (this.status !== 'streaming') return;

    this.timeoutId = setTimeout(() => {
      this.captureAndSend().then(() => {
        if (this.status === 'streaming') {
          this.scheduleNextCapture();
        }
      });
    }, delayMs);
  }

  stop() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.isCapturing = false;
    this.setStatus('idle');
    console.log('📹 停止摄像头流');
  }

  pause() {
    if (this.status !== 'streaming') return;
    console.log('📹 暂停摄像头流');
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.setStatus('paused');
  }

  resume() {
    if (this.status !== 'paused') return;
    console.log('📹 恢复摄像头流');
    this.setStatus('streaming');
    this.scheduleNextCapture(0);
  }

  /**
   * 分片执行捕获，每步之间让出主线程
   */
  private async captureAndSend(): Promise<void> {
    if (this.isCapturing) {
      console.log('📹 上一帧处理中，跳过');
      return;
    }

    if (!this.config.isConnected()) {
      console.log('📹 WS 未连接，跳过');
      return;
    }

    if (this.status !== 'streaming') {
      return;
    }

    if (!this.cameraRef) {
      console.warn('⚠️ CameraView ref 不可用');
      return;
    }

    this.isCapturing = true;

    try {
      // Step 1: 让出主线程，确保音频有机会播放
      await yieldToMain(50);

      console.log('📷 开始捕获...');

      // Step 2: 拍照（跳过处理，拿原始帧）
      const photo = await this.cameraRef.takePictureAsync({
        base64: false,
        quality: 1,
        shutterSound: false,
        skipProcessing: true,
      });

      // Step 3: 让出主线程
      await yieldToMain(100);

      if (!photo.uri) {
        console.warn('⚠️ 拍照失败');
        return;
      }

      // Step 4: resize 到 512px 以内，压缩到 ~50-100KB
      const resized = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 512 } }],
        { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );

      await yieldToMain(50);

      if (!resized.base64) {
        console.warn('⚠️ 压缩失败');
        return;
      }

      const base64WithPrefix = `data:image/jpeg;base64,${resized.base64}`;
      const sizeKB = Math.round(resized.base64.length * 0.75 / 1024);

      console.log('📷 帧完成:', `${sizeKB}KB`);

      // Step 5: 再次让出主线程
      await yieldToMain(50);

      // Step 6: 发送
      this.config.sendFrame({
        action: 'stream_data',
        data: base64WithPrefix,
        input_type: 'camera',
      });

      console.log('📤 发送完成');
    } catch (error) {
      console.error('❌ 捕获失败:', error);
      this.config.onError?.(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.isCapturing = false;
    }
  }

  dispose() {
    this.stop();
    this.cameraRef = null;
  }
}
