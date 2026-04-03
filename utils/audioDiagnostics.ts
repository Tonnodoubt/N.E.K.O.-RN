/**
 * 音频诊断工具
 * 用于调试 Android 录音权限和配置问题
 */

import { Platform, PermissionsAndroid } from 'react-native';
import PCMStream from 'react-native-pcm-stream';

export interface AudioDiagnosticsResult {
  platform: string;
  permissionGranted: boolean | null;
  canInitializeAudioRecord: boolean;
  supportedSampleRates: number[];
  errorMessage?: string;
  nativeError?: string;
}

/**
 * 运行音频诊断
 */
export async function runAudioDiagnostics(): Promise<AudioDiagnosticsResult> {
  const result: AudioDiagnosticsResult = {
    platform: Platform.OS,
    permissionGranted: null,
    canInitializeAudioRecord: false,
    supportedSampleRates: [],
  };

  console.log('🔬 开始音频诊断...');

  // 1. 检查平台
  if (Platform.OS !== 'android') {
    result.errorMessage = '当前平台不是 Android';
    console.log('⚠️ 当前平台不是 Android，跳过诊断');
    return result;
  }

  // 2. 检查权限
  try {
    const permission = PermissionsAndroid.PERMISSIONS.RECORD_AUDIO;
    const checkResult = await PermissionsAndroid.check(permission);
    result.permissionGranted = checkResult;
    console.log(`📋 麦克风权限状态: ${checkResult ? '已授予 ✅' : '未授予 ❌'}`);

    if (!checkResult) {
      // 尝试请求权限
      console.log('🔐 尝试请求麦克风权限...');
      const requestResult = await PermissionsAndroid.request(permission);
      const granted = requestResult === PermissionsAndroid.RESULTS.GRANTED;
      result.permissionGranted = granted;
      console.log(`${granted ? '✅ 权限已授予' : '❌ 权限被拒绝'}`);

      if (!granted) {
        result.errorMessage = '用户拒绝了麦克风权限';
        return result;
      }
    }
  } catch (error: any) {
    result.errorMessage = `权限检查失败: ${error.message}`;
    console.error('❌ 权限检查异常:', error);
    return result;
  }

  // 3. 测试不同采样率
  const testSampleRates = [8000, 16000, 22050, 44100, 48000];
  console.log('🎼 测试支持的采样率...');

  // 监听原生错误
  let lastNativeError: string | null = null;
  const errorListener = PCMStream.addListener('onError', (event: any) => {
    lastNativeError = event?.message || 'Unknown error';
    console.error('🔴 原生错误:', lastNativeError);
  });

  for (const sampleRate of testSampleRates) {
    try {
      lastNativeError = null;
      console.log(`  测试 ${sampleRate}Hz...`);

      // 尝试初始化录音（会立即停止）
      PCMStream.startRecording(sampleRate, 1024, sampleRate);

      // 短暂等待看是否有错误
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!lastNativeError) {
        result.supportedSampleRates.push(sampleRate);
        console.log(`  ✅ ${sampleRate}Hz 支持`);
      } else {
        console.log(`  ❌ ${sampleRate}Hz 不支持: ${lastNativeError}`);
      }

      // 停止录音
      try {
        PCMStream.stopRecording();
      } catch (_e) {
        // 忽略停止错误
      }

      // 等待资源释放
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error: any) {
      console.log(`  ❌ ${sampleRate}Hz 测试失败:`, error.message);
      if (lastNativeError) {
        result.nativeError = lastNativeError;
      }
    }
  }

  errorListener.remove();

  // 4. 总结
  result.canInitializeAudioRecord = result.supportedSampleRates.length > 0;

  console.log('\n📊 诊断结果:');
  console.log(`  平台: ${result.platform}`);
  console.log(`  权限: ${result.permissionGranted ? '已授予 ✅' : '未授予 ❌'}`);
  console.log(`  可初始化: ${result.canInitializeAudioRecord ? '是 ✅' : '否 ❌'}`);
  console.log(`  支持的采样率: ${result.supportedSampleRates.join(', ')} Hz`);

  if (result.nativeError) {
    console.log(`  原生错误: ${result.nativeError}`);
  }

  return result;
}

/**
 * 快速检查音频是否可用
 */
export async function isAudioAvailable(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return false;
  }

  try {
    const hasPermission = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );

    if (!hasPermission) {
      return false;
    }

    // 快速测试默认采样率
    return new Promise((resolve) => {
      let resolved = false;
      const cleanup = () => {
        if (!resolved) {
          resolved = true;
          try {
            PCMStream.stopRecording();
          } catch (_e) {}
          errorListener.remove();
          clearTimeout(timeoutId);
        }
      };

      const errorListener = PCMStream.addListener('onError', () => {
        cleanup();
        resolve(false);
      });

      const timeoutId = setTimeout(() => {
        cleanup();
        resolve(true);
      }, 200);

      try {
        PCMStream.startRecording(48000, 1536, 16000);
      } catch (_e) {
        cleanup();
        resolve(false);
      }
    });
  } catch (_e) {
    return false;
  }
}
