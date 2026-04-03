/**
 * 音频诊断页面
 * 用于调试 Android 录音问题
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { runAudioDiagnostics, isAudioAvailable, AudioDiagnosticsResult } from '../utils/audioDiagnostics';

export default function AudioDebugScreen() {
  const [diagnostics, setDiagnostics] = useState<AudioDiagnosticsResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);

  const runDiagnostics = async () => {
    setIsRunning(true);
    try {
      const result = await runAudioDiagnostics();
      setDiagnostics(result);
    } catch (error: any) {
      console.error('诊断失败:', error);
      setDiagnostics({
        platform: 'android',
        permissionGranted: false,
        canInitializeAudioRecord: false,
        supportedSampleRates: [],
        errorMessage: error.message,
      });
    } finally {
      setIsRunning(false);
    }
  };

  const checkAvailability = async () => {
    const available = await isAudioAvailable();
    setIsAvailable(available);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <Text style={styles.title}>🎤 音频诊断</Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, isRunning && styles.buttonDisabled]}
            onPress={runDiagnostics}
            disabled={isRunning}
          >
            {isRunning ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>运行完整诊断</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.button}
            onPress={checkAvailability}
          >
            <Text style={styles.buttonText}>快速检查</Text>
          </TouchableOpacity>
        </View>

        {isAvailable !== null && (
          <View style={styles.resultBox}>
            <Text style={styles.resultLabel}>音频可用性:</Text>
            <Text style={[styles.resultValue, { color: isAvailable ? '#4caf50' : '#f44336' }]}>
              {isAvailable ? '✅ 可用' : '❌ 不可用'}
            </Text>
          </View>
        )}

        {diagnostics && (
          <View style={styles.diagnosticsContainer}>
            <Text style={styles.sectionTitle}>诊断结果</Text>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>平台:</Text>
              <Text style={styles.resultValue}>{diagnostics.platform}</Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>权限状态:</Text>
              <Text
                style={[
                  styles.resultValue,
                  { color: diagnostics.permissionGranted ? '#4caf50' : '#f44336' },
                ]}
              >
                {diagnostics.permissionGranted ? '✅ 已授予' : '❌ 未授予'}
              </Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>可初始化:</Text>
              <Text
                style={[
                  styles.resultValue,
                  { color: diagnostics.canInitializeAudioRecord ? '#4caf50' : '#f44336' },
                ]}
              >
                {diagnostics.canInitializeAudioRecord ? '✅ 是' : '❌ 否'}
              </Text>
            </View>

            <View style={styles.resultRow}>
              <Text style={styles.resultLabel}>支持的采样率:</Text>
              <Text style={styles.resultValue}>
                {diagnostics.supportedSampleRates.length > 0
                  ? diagnostics.supportedSampleRates.join(', ') + ' Hz'
                  : '无'}
              </Text>
            </View>

            {diagnostics.errorMessage && (
              <View style={styles.errorBox}>
                <Text style={styles.errorLabel}>错误信息:</Text>
                <Text style={styles.errorText}>{diagnostics.errorMessage}</Text>
              </View>
            )}

            {diagnostics.nativeError && (
              <View style={styles.errorBox}>
                <Text style={styles.errorLabel}>原生错误:</Text>
                <Text style={styles.errorText}>{diagnostics.nativeError}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.helpSection}>
          <Text style={styles.helpTitle}>常见问题解决</Text>

          <View style={styles.helpItem}>
            <Text style={styles.helpItemTitle}>1. 权限未授予</Text>
            <Text style={styles.helpItemText}>
              • 前往 设置 → 应用 → N.E.K.O. → 权限{'\n'}
              • 授予"麦克风"权限{'\n'}
              • 重新打开应用
            </Text>
          </View>

          <View style={styles.helpItem}>
            <Text style={styles.helpItemTitle}>2. 初始化失败</Text>
            <Text style={styles.helpItemText}>
              • 检查是否有其他应用占用麦克风{'\n'}
              • 尝试重启应用{'\n'}
              • 尝试重启手机
            </Text>
          </View>

          <View style={styles.helpItem}>
            <Text style={styles.helpItemTitle}>3. 采样率不支持</Text>
            <Text style={styles.helpItemText}>
              • 某些设备不支持 48kHz 录音{'\n'}
              • 应用会自动降级到支持的采样率{'\n'}
              • 查看诊断结果中的"支持的采样率"
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    flex: 1,
    backgroundColor: '#2196f3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#666',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resultBox: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  diagnosticsContainer: {
    backgroundColor: '#2a2a2a',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  resultLabel: {
    color: '#999',
    fontSize: 14,
  },
  resultValue: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#3a1a1a',
    padding: 12,
    borderRadius: 8,
    marginTop: 12,
  },
  errorLabel: {
    color: '#f44336',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  errorText: {
    color: '#ff6b6b',
    fontSize: 12,
  },
  helpSection: {
    marginTop: 20,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  helpItem: {
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  helpItemTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  helpItemText: {
    color: '#999',
    fontSize: 12,
    lineHeight: 18,
  },
});
