import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  TouchableOpacity,
  View,
  Text,
  type ViewStyle,
} from 'react-native';
import { CameraView } from 'expo-camera';
import type { CameraStreamStatus } from '@/services/CameraStreamService';

interface CameraStreamOverlayProps {
  visible: boolean;
  cameraRef: React.RefObject<CameraView | null>;
  onCameraReady: () => void;
  status: CameraStreamStatus;
  onClose: () => void;
  style?: ViewStyle;
}

/**
 * 摄像头流式预览浮层（PiP 模式）
 * - 120x120 小窗口，可拖拽位置
 * - 状态指示灯：绿色=streaming / 黄色=paused / 红色=error
 * - 右上角关闭按钮
 */
export const CameraStreamOverlay: React.FC<CameraStreamOverlayProps> = ({
  visible,
  cameraRef,
  onCameraReady,
  status,
  onClose,
  style,
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 淡入淡出动画（遵循 VoicePrepareOverlay 模式：200ms）
  useEffect(() => {
    if (visible) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, fadeAnim]);

  if (!visible) return null;

  // 状态点颜色
  const getStatusColor = () => {
    switch (status) {
      case 'streaming':
        return '#52c41a'; // 绿色
      case 'paused':
        return '#faad14'; // 黄色
      case 'error':
        return '#f5222d'; // 红色
      default:
        return '#8c8c8c'; // 灰色
    }
  };

  // 状态文本
  const getStatusText = () => {
    switch (status) {
      case 'streaming':
        return '传输中';
      case 'paused':
        return '已暂停';
      case 'error':
        return '错误';
      default:
        return '就绪';
    }
  };

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim },
        style,
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.pipWindow}>
        {/* 摄像头预览 */}
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="front"
          animateShutter={false}
          onCameraReady={onCameraReady}
        />

        {/* 状态指示点 */}
        <View
          style={[
            styles.statusDot,
            { backgroundColor: getStatusColor() },
          ]}
        >
          {status === 'streaming' && <View style={styles.pulseRing} />}
        </View>

        {/* 状态文本提示 */}
        <View style={styles.statusLabel}>
          <Text style={styles.statusLabelText}>{getStatusText()}</Text>
        </View>

        {/* 关闭按钮 */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={onClose}
          hitSlop={{ top: 10, right: 10, bottom: 10, left: 10 }}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 12,
    zIndex: 1500,
  },
  pipWindow: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(64, 197, 241, 0.8)', // 品牌色
    backgroundColor: '#000',
  },
  camera: {
    width: '100%',
    height: '100%',
  },
  statusDot: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: 10,
    height: 10,
    borderRadius: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pulseRing: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: 'rgba(82, 196, 26, 0.6)',
    backgroundColor: 'transparent',
  },
  statusLabel: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 4,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  statusLabelText: {
    color: '#fff',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '500',
  },
  closeButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 14,
  },
});
