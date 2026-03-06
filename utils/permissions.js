import { PermissionsAndroid, Platform, Alert, Linking } from 'react-native';
import { PERMISSIONS, request, RESULTS } from 'react-native-permissions';

/**
 * 请求麦克风权限（旧版本，保持向后兼容）
 * @deprecated 使用 audioPermissionManager 中的函数代替
 */
export const requestMicrophonePermission = async () => {
  if (Platform.OS === 'ios') {
    const result = await request(PERMISSIONS.IOS.MICROPHONE);
    return result === RESULTS.GRANTED;
  } else {
    // Android: 增强权限请求
    try {
      // 先检查权限状态
      const checkResult = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
      );

      if (checkResult) {
        console.log('✅ 麦克风权限已授予');
        return true;
      }

      // 请求权限（带友好提示）
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        {
          title: '🎤 需要麦克风权限',
          message: 'N.E.K.O. 需要访问您的麦克风来实现语音对话功能。',
          buttonNeutral: '稍后询问',
          buttonNegative: '取消',
          buttonPositive: '确定',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('✅ 用户授予了麦克风权限');
        return true;
      } else if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
        console.log('❌ 用户选择"不再询问"');
        // 🔥 修复：延迟显示对话框，避免自动跳转
        setTimeout(() => {
          Alert.alert(
            '需要麦克风权限',
            '您之前拒绝了麦克风权限并选择了"不再询问"。\n\n语音功能需要麦克风权限才能工作。是否前往设置开启权限？',
            [
              {
                text: '暂不开启',
                style: 'cancel',
                onPress: () => console.log('用户选择不去设置'),
              },
              {
                text: '去设置',
                style: 'default',
                onPress: () => {
                  try {
                    Linking.openSettings();
                  } catch (error) {
                    console.error('无法打开设置:', error);
                    Alert.alert('错误', '无法打开系统设置，请手动前往设置授予权限。');
                  }
                },
              },
            ],
            { cancelable: true }
          );
        }, 500); // 延迟 500ms
        return false;
      } else {
        console.log('❌ 用户拒绝了麦克风权限');
        // 🔥 修复：拒绝时也显示提示，但不要跳转
        setTimeout(() => {
          Alert.alert(
            '权限被拒绝',
            '您拒绝了麦克风权限，语音功能将无法使用。\n\n您可以稍后在设置中手动授予权限。',
            [{ text: '知道了', style: 'default' }],
            { cancelable: true }
          );
        }, 300);
        return false;
      }
    } catch (error) {
      console.error('请求麦克风权限失败:', error);
      setTimeout(() => {
        Alert.alert('错误', '请求权限时发生错误，请稍后重试。');
      }, 300);
      return false;
    }
  }
};