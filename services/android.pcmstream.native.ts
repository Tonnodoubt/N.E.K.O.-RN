import { requestMicrophonePermission } from '@/utils/audioPermissionManager';
import { Alert, Platform } from 'react-native';
import PCMStream from 'react-native-pcm-stream';
import { WSService } from './wsService';

// 音频配置常量 - 参考原有的32ms机制
export const AUDIO_CONFIG = {
    RECORD_SAMPLE_RATE: 16000,
    PLAYBACK_SAMPLE_RATE: 48000,
    BYTES_PER_SAMPLE: 2,
    CHUNK_SAMPLES: 512,
    // 关键：512样本在16kHz下约等于32ms
    BUFFER_SIZE_SAMPLES: 512, // 32ms @ 16kHz
    // 新增：流式处理阈值
    STREAM_THRESHOLD_SAMPLES: 512, // 达到此数量立即发送
};


export class AndroidPCMStreamService {

    private wsServiceRef: WSService;
    private isRecording: boolean = false;
    private isStreaming: boolean = false;

    private audioChunksCount: number = 0;

    private tempBuffer: number[] = [];
    private sendCount: number = 0;

    private feedbackControlStatus: string = '正常';
    private subscription: any;
    private errorSubscription: any;
    private playbackStartSubscription: any;
    private playbackStopSubscription: any;
    private playbackPausedSubscription: any;
    private playbackResumedSubscription: any;
    private playbackProgressSubscription: any;

    // 播放统计信息
    private playbackTotalDuration: number = 0;
    private playbackPlayedDuration: number = 0;
    private playbackProgress: number = 0;

    private bufferIndex: number = 0;
    private audioBuffer: Int16Array = new Int16Array(AUDIO_CONFIG.BUFFER_SIZE_SAMPLES);
    private lastSendTime: number = 0;

    private lastUserActivityTime: number = 0;
    private isSpeechDetected: boolean = false;
    private isPlayerInited: boolean = false;
    private isPlaying: boolean = false;
    // 注意：麦克风暂停/恢复现在由 PCMStreamPlayer 自动管理

    public getIsRecording() {
        return this.isRecording;
    }


    constructor(wsServiceRef: WSService) {
        this.wsServiceRef = wsServiceRef;
    }

    public init() {
        if (Platform.OS === 'android') {
            console.log('🔧 设置PCMStream onAudioFrame事件监听器');

            this.setupEventListeners();
        }
    }

    private setupEventListeners() {
        this.subscription = PCMStream.addListener('onAudioFrame', (event) => {
            if (!this.isRecording || !event.pcm) return;

            // delta_ts.current = event.ts - last_ts.current;
            // last_ts.current = event.ts;
            // console.log(`🎤 录音数据已添加: ${event.pcm.length} 字节, 间隔: ${delta_ts.current}ms`);

            const pcmData = new Int16Array(event.pcm.buffer);
            if (pcmData.length === 0) return;
            this.isStreaming = true;
            this.addToAudioBuffer(pcmData);
            this.audioChunksCount++;
        });

        // 添加错误监听
        this.errorSubscription = PCMStream.addListener('onError', (event) => {
            console.error('❌ PCMStream错误:', event);
        });

        // 添加播放开始监听
        this.playbackStartSubscription = PCMStream.addListener('onPlaybackStart', (event: any) => {
            console.log('▶️ PCMStream播放开始（麦克风自动暂停）', event);
            this.feedbackControlStatus = '播放中-麦克风已暂停';
            this.isPlaying = true;
        });

        // 添加播放停止/完成监听
        this.playbackStopSubscription = PCMStream.addListener('onPlaybackStop', (event: any) => {
            console.log('⏹️ PCMStream播放完成（麦克风自动恢复）', event);
            console.log(`📊 播放统计 - 总时长: ${event.totalDuration?.toFixed(2)}秒, 已播放: ${event.playedDuration?.toFixed(2)}秒`);
            this.feedbackControlStatus = '正常';
            this.isPlaying = false;
            this.playbackTotalDuration = event.totalDuration || 0;
            this.playbackPlayedDuration = event.playedDuration || 0;
            // 注意：麦克风恢复现在由 PCMStreamPlayer 自动处理，无需手动调用
        });

        // 添加播放暂停监听
        this.playbackPausedSubscription = PCMStream.addListener('onPlaybackPaused', (event: any) => {
            console.log('⏸️ PCMStream播放暂停', event);
            this.feedbackControlStatus = '暂停';
        });

        // 添加播放恢复监听
        this.playbackResumedSubscription = PCMStream.addListener('onPlaybackResumed', (event: any) => {
            console.log('▶️ PCMStream播放恢复', event);
            this.feedbackControlStatus = '播放中-麦克风已暂停';
        });

        // 添加播放进度监听（每秒触发）
        this.playbackProgressSubscription = PCMStream.addListener('onPlaybackProgress', (event: any) => {
            this.playbackTotalDuration = event.totalDuration || 0;
            this.playbackPlayedDuration = event.playedDuration || 0;
            this.playbackProgress = event.progress || 0;
            
            // 降低日志频率
            if (Math.random() < 0.1) {
                console.log(`⏱️ 播放进度: ${event.playedDuration?.toFixed(2)}/${event.totalDuration?.toFixed(2)}秒 (${(event.progress * 100)?.toFixed(1)}%)`);
            }
        });
    }

    private cleanupEventListeners() {
        console.log('🧹 清理PCMStream事件监听器');
        this.subscription?.remove();
        this.errorSubscription?.remove();
        this.playbackStartSubscription?.remove();
        this.playbackStopSubscription?.remove();
        this.playbackPausedSubscription?.remove();
        this.playbackResumedSubscription?.remove();
        this.playbackProgressSubscription?.remove();
    }

    public async initializeAudio() {
        try {
            // 初始化为录音模式
            await this.configureRecordingAudioSession();
            console.log('音频初始化完成');
        } catch (error) {
            console.error('音频初始化失败:', error);
            Alert.alert('错误', '音频初始化失败');
        }
    }

    public initPlayer(sampleRate: number = AUDIO_CONFIG.PLAYBACK_SAMPLE_RATE) {
        PCMStream.initPlayer(sampleRate);
        this.isPlayerInited = true;
    }

    public async startRecording() {
        try {
            // 检查麦克风权限
            const hasPermission = await requestMicrophonePermission();
            if (!hasPermission) {
                Alert.alert('权限错误', '需要麦克风权限');
                return;
            }

            if (Platform.OS !== 'android') {
                Alert.alert('提示', '当前录音功能仅在 Android 上可用');
                return;
            }

            console.log('🎤 准备开始录音...');

            console.log('📋 调用PCMStream.startRecording(48000, 1536, 16000)');
            // 开始录音：48kHz采样，1536帧，重采样到16kHz
            PCMStream.startRecording(48000, 1536, 16000);

            this.isRecording = true;
            console.log('✅ 录音已启动，等待onAudioFrame事件...');

        } catch (error) {
            console.error('开始录音失败:', error);
            Alert.alert('错误', '录音启动失败');
        }
    }

    public async stopRecording() {
        try {
            if (Platform.OS !== 'android') return;

            console.log('🛑 停止录音...');
            PCMStream.stopRecording();

            this.isRecording = false;

            // 发送剩余的缓冲区数据（如果有的话）
            if (this.tempBuffer.length > 0) {
                console.log(`📤 发送剩余缓冲区数据: ${this.tempBuffer.length} 样本`);
                const remainingData = new Int16Array(this.tempBuffer);
                this.sendPCMDataDirect(remainingData);
            }

            // 清空所有音频缓冲区
            this.bufferIndex = 0;
            this.audioBuffer.fill(0);
            this.tempBuffer = []; // 清空临时缓冲区
            this.isStreaming = false;

            // 重置发送控制
            this.lastSendTime = 0;
            this.sendCount = 0;

            console.log('录音已停止，所有缓冲区和发送队列已清空');

        } catch (error) {
            console.error('停止录音失败:', error);
        }
    }

    private addToAudioBuffer(pcmData: Int16Array) {
        // 将输入数据添加到临时缓冲区
        const inputArray = Array.from(pcmData);
        this.tempBuffer = this.tempBuffer.concat(inputArray);

        // 当临时缓冲区足够大时，执行流式处理
        const requiredSamples = AUDIO_CONFIG.STREAM_THRESHOLD_SAMPLES;
        if (this.tempBuffer.length >= requiredSamples) {
            // 立即处理并发送，不做频率限制
            const samplesToProcess = this.tempBuffer.slice(0, requiredSamples);
            this.tempBuffer = this.tempBuffer.slice(requiredSamples); // 移除已处理的数据

            // 转换为Int16Array并发送
            const bufferToSend = new Int16Array(samplesToProcess);
            this.sendPCMDataDirect(bufferToSend);

            // 更新计数器
            this.sendCount++;
        }

        // 降低日志频率，避免日志过多
        if (Math.random() < 0.01) {
            console.log(`📥 缓冲区状态: ${this.tempBuffer.length}/${requiredSamples} 样本`);
        }
    };

    // 直接发送PCM数据到WebSocket（内部函数）
    private sendPCMDataDirect(pcmData: Int16Array) {
        // if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        //     return;
        // }

        try {
            const message = {
                action: 'stream_data',
                data: Array.from(pcmData),
                input_type: 'audio'
            };
            this.wsServiceRef.send(JSON.stringify(message));

            // 降低日志频率
            // if (Math.random() < 0.05) {
            //     console.log(`📤 发送合并PCM数据: ${pcmData.length} 样本 (${(pcmData.length/16000*1000).toFixed(0)}ms)`);
            // }
        } catch (error) {
            console.error('发送PCM数据失败:', error);
        }
    };

    public handleUserSpeechDetection() {
        const currentTime = Date.now();
        this.lastUserActivityTime = currentTime;
        this.isSpeechDetected = true;

        console.log('=== 语音打断处理开始 ===');
        console.log('- 清空音频播放队列');
        console.log('- 停止当前音频播放');
        console.log('- 为用户语音让路');

        // 立即清空音频队列，停止播放
        this.clearAudioQueue();

        // 模拟语音检测状态，3秒后自动重置
        setTimeout(() => {
            // 检查是否有新的语音活动
            if (Date.now() - this.lastUserActivityTime >= 3000) {
                this.isSpeechDetected = false;
                console.log('语音检测状态已重置');
            }
        }, 3000);
    }

    public clearAudioQueue() {
        if (Platform.OS === 'android') {
            try {
                PCMStream.stopPlayback();
                // 停止后需允许下次重新初始化播放器
                this.isPlayerInited = false;
            } catch (e) {
                console.warn('停止原生播放失败:', e);
            }
        }
        this.isPlaying = false;
        this.feedbackControlStatus = '正常';
        // 注意：麦克风恢复现在由 PCMStreamPlayer 自动处理
        console.log('🎤 清空音频队列完成，麦克风将自动恢复');
    }

    public addToAudioQueue(arrayBuffer: ArrayBuffer) {
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
            console.warn('收到空的ArrayBuffer音频数据，跳过处理');
            return;
        }
        this.processAudioQueue(arrayBuffer);
    }

    private async processAudioQueue(arrayBuffer: ArrayBuffer) {
        if (this.isSpeechDetected) {
            console.log('🎤 检测到用户语音活动，延迟音频播放');
            setTimeout(() => {
                if (!this.isSpeechDetected) {
                    this.processAudioQueue(arrayBuffer);
                }
            }, 1000);
            return;
        }

        try {
            // ✅ 移除手动设置 isPlaying，由 onPlaybackStart 事件自动处理
            // Android 直接使用原生PCM播放
            await this.playPCMData(arrayBuffer);

        } catch (error) {
            console.error('处理音频播放失败:', error);
        }
        // ✅ 不再手动设置 isPlaying = false，由 onPlaybackStop 事件自动处理
    }

    private async enqueueAndroidPCM(arrayBuffer: ArrayBuffer) {
        if (!arrayBuffer || arrayBuffer.byteLength === 0) return;
        
        // 注意：麦克风暂停现在由 PCMStreamPlayer 自动处理，无需手动调用
        
        // 确保播放器已初始化（若未初始化则初始化一次）
        if (!this.isPlayerInited) {
            try {
                PCMStream.initPlayer(AUDIO_CONFIG.PLAYBACK_SAMPLE_RATE);
                this.isPlayerInited = true;
                console.log('✅ 播放器已初始化');
            } catch (e) {
                console.warn('初始化原生PCM播放器失败:', e);
            }
        }
        
        try {
            // ✅ 移除手动设置 isPlaying，由 onPlaybackStart 事件自动处理
            const uint8 = new Uint8Array(arrayBuffer);
            
            // 直接推送完整数据到 native 播放器
            // ✅ PCMStreamPlayer 支持任意大小数据块，无需在 JS 端切片
            // native 播放器会自动开始播放并触发 onPlaybackStart 事件
            PCMStream.playPCMChunk(uint8);
        } catch (e) {
            console.warn('直接推送PCM失败:', e);
        }
    }

    // 配置录音模式的音频会话
    public configureRecordingAudioSession = async () => { return; };

    public async playPCMData(arrayBuffer: ArrayBuffer) {
        if (Platform.OS === 'android') {
            try {
                // 入队并由定时器按帧送入原生播放器
                await this.enqueueAndroidPCM(arrayBuffer);
            } catch (e) {
                console.warn('原生PCM播放失败，回退到WAV播放:', e);
                this.addToAudioQueue(arrayBuffer);
            }
            return;
        }
        // iOS/Web 仍然走现有 WAV 方案
        this.addToAudioQueue(arrayBuffer);
    }

    public async toggleRecording() {
        if (this.isRecording) {
            await this.stopRecording();
        } else {
            await this.startRecording();
        }
    }

    public PCMStreamStopPlayback() {
        PCMStream.stopPlayback();
    }

    public PCMStreamStopRecording() {
        PCMStream.stopRecording();
    }

    public uninitializeAudio() {
        if (this.isPlayerInited) {
            this.stopRecording();
        }
        this.clearAudioQueue();

        this.bufferIndex = 0;
        this.audioBuffer.fill(0);
        this.tempBuffer = [];
        this.isStreaming = false;
        this.isRecording = false;
        this.isPlaying = false;
        this.lastSendTime = 0;
        this.sendCount = 0;

        if (Platform.OS === 'android') {
            this.PCMStreamStopPlayback();
            this.PCMStreamStopRecording();
        }
    }

    public getStats() {
        return {
            audioChunksCount: this.audioChunksCount,
            tempBufferLength: this.tempBuffer.length,
            bufferIndex: this.bufferIndex,
            audioBufferLength: this.audioBuffer.length,
            isPlayerInited: this.isPlayerInited,
            isStreaming: this.isStreaming,
            isRecording: this.isRecording,
            isPlaying: this.isPlaying,
            lastSendTime: this.lastSendTime,
            sendCount: this.sendCount,
            feedbackControlStatus: this.feedbackControlStatus,
            isSpeechDetected: this.isSpeechDetected,
            // 播放统计信息
            playbackTotalDuration: this.playbackTotalDuration,
            playbackPlayedDuration: this.playbackPlayedDuration,
            playbackProgress: this.playbackProgress
        }
    }
}

export default AndroidPCMStreamService;