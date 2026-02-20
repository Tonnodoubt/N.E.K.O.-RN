/**
 * 音频权限管理器
 * 自动检测和请求麦克风权限
 */

import { Platform, PermissionsAndroid, Alert, Linking } from 'react-native';

export interface PermissionStatus {
  granted: boolean;
  canAskAgain: boolean;
  shouldShowRationale: boolean;
}

/**
 * 检查麦克风权限状态
 */
export async function checkMicrophonePermission(): Promise<PermissionStatus> {
  if (Platform.OS !== 'android') {
    return {
      granted: true, // iOS 在 Info.plist 中声明，安装时自动授予
      canAskAgain: false,
      shouldShowRationale: false,
    };
  }

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
    );

    return {
      granted,
      canAskAgain: true, // Android 总是可以再次请求
      shouldShowRationale: !granted, // 如果未授予，应该显示说明
    };
  } catch (error) {
    console.error('检查权限失败:', error);
    return {
      granted: false,
      canAskAgain: false,
      shouldShowRationale: false,
    };
  }
}

/**
 * 请求麦克风权限（带友好提示）
 */
export async function requestMicrophonePermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }

  try {
    // 先检查当前状态
    const status = await checkMicrophonePermission();

    if (status.granted) {
      console.log('✅ 麦克风权限已授予');
      return true;
    }

    // 请求权限
    console.log('🔐 请求麦克风权限...');
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      {
        title: '🎤 需要麦克风权限',
        message: 'N.E.K.O. 需要访问您的麦克风来实现语音对话功能。',
        buttonNeutral: '稍后询问',
        buttonNegative: '取消',
        buttonPositive: '确定',
      }
    );

    switch (result) {
      case PermissionsAndroid.RESULTS.GRANTED:
        console.log('✅ 用户授予了麦克风权限');
        return true;

      case PermissionsAndroid.RESULTS.DENIED:
        console.log('❌ 用户拒绝了麦克风权限');
        Alert.alert(
          '权限被拒绝',
          '您拒绝了麦克风权限，语音功能将无法使用。您可以稍后在设置中授予权限。',
          [{ text: '知道了', style: 'default' }]
        );
        return false;

      case PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN:
        console.log('❌ 用户选择"不再询问"');
        Alert.alert(
          '需要权限',
          '麦克风权限已被禁用。请在系统设置中手动授予麦克风权限。',
          [
            { text: '取消', style: 'cancel' },
            {
              text: '去设置',
              style: 'default',
              onPress: () => {
                openAppSettings();
              },
            },
          ]
        );
        return false;

      default:
        return false;
    }
  } catch (error) {
    console.error('请求权限失败:', error);
    return false;
  }
}

/**
 * 打开应用设置页面
 */
export function openAppSettings(): void {
  if (Platform.OS === 'android') {
    try {
      // Android: 打开应用详情页
      Linking.openSettings();
    } catch (error) {
      console.error('无法打开设置:', error);
      Alert.alert('错误', '无法打开系统设置，请手动前往设置授予权限。');
    }
  } else if (Platform.OS === 'ios') {
    // iOS: 打开应用设置
    Linking.openSettings();
  }
}

/**
 * 确保麦克风权限（带重试）
 */
export async function ensureMicrophonePermission(
  maxRetries: number = 2
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    console.log(`🔐 尝试获取麦克风权限 (${attempt}/${maxRetries})`);

    const granted = await requestMicrophonePermission();

    if (granted) {
      return true;
    }

    // 如果不是最后一次尝试，等待一下
    if (attempt < maxRetries) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return false;
}
