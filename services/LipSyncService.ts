import { ReactNativeLive2dModule } from 'react-native-live2d';
import PCMStream, { OnAmplitudeUpdateEventPayload } from 'react-native-pcm-stream';

interface LipSyncConfig {
  minAmplitude: number;
  maxAmplitude: number;
  amplitudeScale: number;
  attackMs: number;
  releaseMs: number;
  curvePower: number;
}

const DEFAULT_CONFIG: LipSyncConfig = {
  minAmplitude: 0.008,
  maxAmplitude: 1.0,
  amplitudeScale: 1.0,
  attackMs: 25,
  releaseMs: 90,
  curvePower: 0.55,
};

// Hermes-safe 数值检查
function isGood(v: unknown): v is number {
  return typeof v === 'number' && v === v && v !== Infinity && v !== -Infinity;
}

/**
 * LipSyncService — 音频振幅 → Live2D 嘴型。
 * attack/release 时间增量平滑 + 非线性响应曲线。
 */
export class LipSyncService {
  private config!: LipSyncConfig;
  private ampSub: any = null;
  private stopSub: any = null;
  private active = false;
  private mouth = 0;
  private lastTs = 0;
  private callN = 0;

  constructor(options?: Partial<LipSyncConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...options };
    this.mouth = 0;
    this.lastTs = Date.now();
  }

  start(): void {
    if (this.active) return;

    this.mouth = 0;
    this.lastTs = Date.now();

    this.ampSub = PCMStream.addListener(
      'onAmplitudeUpdate',
      (event: OnAmplitudeUpdateEventPayload) => {
        const amp = event?.amplitude;
        if (typeof amp === 'number') {
          this.tick(amp);
        }
      },
    );

    this.stopSub = PCMStream.addListener('onPlaybackStop', () => {
      this.mouth = 0;
      this.lastTs = Date.now();
      try { ReactNativeLive2dModule.setMouthValue(0); } catch (_) {}
    });

    this.active = true;
  }

  stop(): void {
    if (!this.active) return;
    this.ampSub?.remove();
    this.ampSub = null;
    this.stopSub?.remove();
    this.stopSub = null;
    this.mouth = 0;
    this.lastTs = Date.now();
    try { ReactNativeLive2dModule.setMouthValue(0); } catch (_) {}
    this.active = false;
  }

  private tick(raw: number): void {
    // 防护：入口检查
    if (!isGood(raw)) return;
    if (!isGood(this.mouth)) { this.mouth = 0; this.lastTs = Date.now(); }
    if (!isGood(this.lastTs)) { this.lastTs = Date.now(); }

    const cfg = this.config;
    if (!cfg) return;

    // 1. 噪声门限
    let target = raw < cfg.minAmplitude ? 0 : raw;

    // 2. 缩放
    target = target * cfg.amplitudeScale;

    // 3. 非线性曲线
    if (target > 0 && cfg.curvePower !== 1) {
      target = Math.pow(target, cfg.curvePower);
    }

    // 4. 钳位
    if (target > cfg.maxAmplitude) target = cfg.maxAmplitude;
    if (!isGood(target)) target = 0;

    // 5. Attack/Release 平滑
    const now = Date.now();
    let dt = now - this.lastTs;
    if (dt <= 0 || dt > 5000) dt = 16;
    this.lastTs = now;

    const rate = target > this.mouth ? cfg.attackMs : cfg.releaseMs;
    const alpha = dt / rate;
    const a = alpha < 1 ? alpha : 1;

    this.mouth = this.mouth + (target - this.mouth) * a;

    // 二次防护
    if (!isGood(this.mouth)) this.mouth = target;

    // 6. 写入
    try { ReactNativeLive2dModule.setMouthValue(this.mouth); } catch (_) {}

    // 日志
    this.callN = this.callN + 1;
    if (this.callN <= 10 || this.callN % 100 === 0) {
      const rs = isGood(raw) ? raw.toFixed(4) : 'bad';
      const ms = isGood(this.mouth) ? this.mouth.toFixed(4) : 'bad';
      console.log(`[LipSync] v3 #${this.callN} raw=${rs} target=${target.toFixed(4)} mouth=${ms} dt=${dt.toFixed(0)} alpha=${a.toFixed(3)}`);
    }
  }

  isRunning(): boolean { return this.active; }

  updateConfig(options: Partial<LipSyncConfig>): void {
    this.config = { ...this.config, ...options };
  }

  getConfig(): LipSyncConfig & { isActive: boolean } {
    return { ...this.config, isActive: this.active };
  }

  destroy(): void { this.stop(); }
}

export default LipSyncService;
