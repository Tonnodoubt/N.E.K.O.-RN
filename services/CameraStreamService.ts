import { CameraView } from 'expo-camera';

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
    this.frameInterval = config.frameInterval ?? 15000; // 默认 15s
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
    this.scheduleNextCapture();
  }

  private scheduleNextCapture() {
    if (this.status !== 'streaming') return;

    this.timeoutId = setTimeout(() => {
      this.captureAndSend().then(() => {
        if (this.status === 'streaming') {
          this.scheduleNextCapture();
        }
      });
    }, this.frameInterval);
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
    this.setStatus('paused');
  }

  resume() {
    if (this.status !== 'paused') return;
    console.log('📹 恢复摄像头流');
    this.setStatus('streaming');
    this.scheduleNextCapture();
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

      // Step 2: 拍照（最低质量）
      const photo = await this.cameraRef.takePictureAsync({
        base64: true,
        quality: 0.1,        // 极低质量，减少处理时间
        shutterSound: false,
        skipProcessing: true,
      });

      // Step 3: 立即让出主线程
      await yieldToMain(100);

      if (!photo.base64) {
        console.warn('⚠️ 拍照失败');
        return;
      }

      // Step 4: 构造消息（同步操作，但很快）
      const base64WithPrefix = `data:image/jpeg;base64,${photo.base64}`;
      const sizeKB = Math.round(photo.base64.length * 0.75 / 1024);

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
