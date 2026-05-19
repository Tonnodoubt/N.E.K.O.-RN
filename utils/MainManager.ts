import { AudioService } from '@/services/AudioService';
import { Live2DService } from '@/services/Live2DService';

/**
 * 情感类型枚举
 */
export enum EmotionType {
  NEUTRAL = 'neutral',
  HAPPY = 'happy',
  SAD = 'sad',
  SURPRISED = 'surprised',
  ANGRY = 'angry',
}

/**
 * 情感到表情的映射
 */
const EMOTION_TO_EXPRESSION_MAP: Record<EmotionType, string> = {
  [EmotionType.NEUTRAL]: 'exp_exp_01',
  [EmotionType.HAPPY]: 'exp_exp_02',
  [EmotionType.SAD]: 'exp_exp_03',
  [EmotionType.SURPRISED]: 'exp_exp_04',
  [EmotionType.ANGRY]: 'exp_exp_05',
};

/**
 * 情感到动作的映射
 */
const EMOTION_TO_MOTION_MAP: Record<EmotionType, string> = {
  [EmotionType.NEUTRAL]: 'Idle',
  [EmotionType.HAPPY]: 'happy',
  [EmotionType.SAD]: 'sad',
  [EmotionType.SURPRISED]: 'surprised',
  [EmotionType.ANGRY]: 'sad', // 可以自定义
};

/**
 * MainManager - 主管理器（协调层）
 * 
 * 职责：
 * - 协调 Audio 和 Live2D 服务之间的交互
 * - 根据音频事件触发 Live2D 动作/表情
 * - 管理全局状态和配置
 * - 提供统一的业务逻辑接口
 */
class MainManager {
  private audioService: AudioService | null = null;
  private live2dService: Live2DService | null = null;
  private isInitialized: boolean = false;
  private currentEmotion: EmotionType = EmotionType.NEUTRAL;

  /**
   * 初始化管理器
   */
  init() {
    if (this.isInitialized) {
      console.warn('⚠️ MainManager 已经初始化过了');
      return;
    }

    console.log('🎯 MainManager 初始化中...');
    this.isInitialized = true;
    console.log('✅ MainManager 初始化完成');
  }

  /**
   * 注册 Audio 服务
   */
  registerAudioService(audioService: AudioService) {
    console.log('🎧 注册 AudioService');
    this.audioService = audioService;
  }

  clearAudioService() {
    this.audioService = null;
  }

  /**
   * 注册 Live2D 服务
   */
  registerLive2DService(live2dService: Live2DService) {
    console.log('🎨 注册 Live2DService');
    this.live2dService = live2dService;
  }

  clearLive2DService() {
    this.live2dService = null;
  }

  /**
   * 处理 Gemini 响应（AI 开始说话）
   */
  onGeminiResponse(isNewMessage: boolean) {
    console.log('💬 处理 Gemini 响应, isNewMessage:', isNewMessage);

    if (isNewMessage) {
      // 新消息开始，清空音频队列
      this.audioService?.clearAudioQueue();

      // Live2D 做出反应（开心的动作）
      this.applyEmotion(EmotionType.HAPPY);
    }
  }

  /**
   * 处理用户语音活动（用户说话，打断 AI）
   */
  onUserSpeechDetected() {
    console.log('🎤 检测到用户语音活动');

    // 处理音频打断
    this.audioService?.handleUserSpeechDetection();

    // Live2D 做出反应（惊讶的动作）
    this.applyEmotion(EmotionType.SURPRISED);
  }

  /**
   * 处理回合结束
   */
  onTurnEnd(fullText?: string) {
    console.log('🏁 回合结束');

    // TODO: 在这里可以进行情感分析
    // const emotion = await analyzeEmotion(fullText);
    // this.applyEmotion(emotion);

    // 暂时使用中性表情
    this.applyEmotion(EmotionType.NEUTRAL);
  }

  /**
   * 应用情感（同时改变 Live2D 的动作和表情）
   */
  applyEmotion(emotion: EmotionType) {
    console.log('😊 应用情感:', emotion);
    this.currentEmotion = emotion;

    if (!this.live2dService) {
      console.warn('⚠️ Live2DService 未注册，无法应用情感');
      return;
    }

    // 获取对应的表情和动作
    const expression = EMOTION_TO_EXPRESSION_MAP[emotion] || 'exp_exp_01';
    const motion = EMOTION_TO_MOTION_MAP[emotion] || 'Idle';

    // 应用到 Live2D
    this.live2dService.setExpression(expression);
    this.live2dService.playMotion(motion);
  }

  /**
   * 播放特定动作
   */
  playMotion(motion: string) {
    console.log('🎬 播放动作:', motion);
    this.live2dService?.playMotion(motion);
  }

  /**
   * 设置表情
   */
  setExpression(expression: string) {
    console.log('😊 设置表情:', expression);
    this.live2dService?.setExpression(expression);
  }

  /**
   * 开始录音
   */
  async startRecording() {
    console.log('🎤 开始录音');
    await this.audioService?.startRecording();

    // Live2D 做出倾听的姿态
    this.live2dService?.playMotion('Idle');
  }

  /**
   * 停止录音
   */
  async stopRecording() {
    console.log('⏸️ 停止录音');
    await this.audioService?.stopRecording();
  }

  /**
   * 切换录音状态
   */
  async toggleRecording() {
    const isRecording = this.audioService?.getIsRecording();
    if (isRecording) {
      await this.stopRecording();
    } else {
      await this.startRecording();
    }
  }

  /**
   * 处理用户点击 Live2D 模型
   */
  onLive2DTap() {
    console.log('👆 用户点击了 Live2D 模型');

    // 播放一个随机动作
    const motions = ['happy', 'surprised', 'neutral'];
    const randomMotion = motions[Math.floor(Math.random() * motions.length)];
    this.live2dService?.playMotion(randomMotion);
  }

  /**
   * 获取当前情感
   */
  getCurrentEmotion(): EmotionType {
    return this.currentEmotion;
  }

  /**
   * 获取 Audio 服务
   */
  getAudioService(): AudioService | null {
    return this.audioService;
  }

  /**
   * 获取 Live2D 服务
   */
  getLive2DService(): Live2DService | null {
    return this.live2dService;
  }

  /**
   * 是否已初始化
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * 销毁管理器
   */
  destroy() {
    console.log('🧹 MainManager 销毁中...');
    this.audioService = null;
    this.live2dService = null;
    this.isInitialized = false;
    this.currentEmotion = EmotionType.NEUTRAL;
    console.log('✅ MainManager 已销毁');
  }
}

/**
 * 全局单例实例
 */
export const mainManager = new MainManager();
