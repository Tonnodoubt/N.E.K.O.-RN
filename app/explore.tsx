import { ThemedView } from '@/components/themed-view';
import { AudioService } from '@/services/AudioService';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { parseDevConnectionConfig, type DevConnectionConfig } from '@/utils/devConnectionConfig';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '@/constants/ThemeContext';

export default function ExploreScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ qr?: string }>();
  const theme = useTheme();
  const cc = theme.colors;

  const s = useMemo(() => StyleSheet.create({
    statusContainer: {
      padding: theme.spacing.lg,
      margin: theme.spacing.lg,
      borderRadius: theme.radius.sm,
      backgroundColor: cc.separator,
    },
    statusText: {
      fontSize: theme.fontSize.body,
      color: cc.textPrimary,
      marginBottom: theme.spacing.xs,
    },
    callControls: {
      margin: theme.spacing.lg,
      padding: theme.spacing.lg,
      borderRadius: theme.radius.sm,
      borderWidth: 2,
      backgroundColor: cc.separator,
      borderColor: cc.success,
    },
    messagesContainer: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xxl,
      padding: theme.spacing.md,
      borderRadius: theme.radius.sm,
      borderWidth: 1,
      backgroundColor: cc.elevated,
      borderColor: cc.border,
    },
    messagesTitle: {
      fontSize: theme.fontSize.callout,
      fontWeight: theme.fontWeight.bold,
      color: cc.textPrimary,
      marginBottom: theme.spacing.sm,
    },
    messagesScrollView: {
      maxHeight: 180,
    },
    noMessagesText: {
      textAlign: 'center',
      fontStyle: 'italic',
      paddingVertical: theme.spacing.lg,
      color: cc.textMuted,
    },
    messageItem: {
      marginBottom: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md - 2,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.spacing.xs + 2,
      backgroundColor: cc.separator,
    },
    messageText: {
      fontSize: theme.fontSize.body,
      lineHeight: theme.lineHeight.footnote,
      color: cc.textSecondary,
    },
  }), [theme, cc]);

  const audioServiceRef = useRef<AudioService | null>(null);
  const lastQueueClearAtMsRef = useRef<number>(0);
  const lastAppliedQrRef = useRef<string | null>(null);
  const isRecordingRef = useRef(false);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const restartInFlightRef = useRef(false);

  const { config: connectionConfig, setConfig: setConnectionConfig } = useDevConnectionConfig();

  const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [messages, setMessages] = useState<Array<{ id: string; text: string; sender: string; timestamp: string }>>([]);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [focusModeState, setFocusModeState] = useState<boolean>(false);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return String(error);
  };

  useEffect(() => {
    const qrParam = typeof params.qr === 'string' ? params.qr : undefined;
    if (!qrParam) return;
    if (lastAppliedQrRef.current === qrParam) return;
    lastAppliedQrRef.current = qrParam;

    let decoded = qrParam;
    try {
      decoded = decodeURIComponent(qrParam);
    } catch { }

    const parsed = parseDevConnectionConfig(decoded);
    if (!parsed) {
      Alert.alert('二维码内容不可用', decoded.slice(0, 256));
      return;
    }

    setConnectionConfig(prev => ({
      host: parsed.host ?? prev.host,
      port: parsed.port ?? prev.port,
      characterName: parsed.characterName ?? prev.characterName,
    }));
  }, [params.qr]);

  useEffect(() => {
    console.log('ExploreScreen 组件初始化');

    audioServiceRef.current?.destroy();
    audioServiceRef.current = new AudioService({
      host: connectionConfig.host,
      port: connectionConfig.port,
      characterName: connectionConfig.characterName,
      onError: (error) => {
        console.error('AudioService错误:', error);
        Alert.alert('音频服务错误', getErrorMessage(error));
      },
      onConnectionChange: (connected) => {
        setIsConnected(connected);
      },
      onMessage: (event) => {
        handleWsMessage(event);
      },
      onRecordingStateChange: (recording) => {
        setIsRecording(recording);
      },
      onAudioStatsUpdate: (stats) => {
        setIsPlaying(stats.isPlaying);
      }
    });

    audioServiceRef.current.init().catch((error) => {
      console.error('AudioService 初始化失败:', error);
      Alert.alert('初始化失败', getErrorMessage(error));
    });

    return () => {
      if (restartTimerRef.current) {
        clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      restartInFlightRef.current = false;
      audioServiceRef.current?.destroy();
    };
  }, [connectionConfig.characterName, connectionConfig.host, connectionConfig.port]);

  const handleWsMessage = (event: MessageEvent) => {
    if (event.data instanceof Blob) {
      console.log("收到新的音频块 (Blob)");
      audioServiceRef.current?.handleAudioBlob(event.data);
      return;
    }

    if (event.data instanceof ArrayBuffer) {
      console.log("收到ArrayBuffer音频数据，长度:", event.data.byteLength);
      audioServiceRef.current?.handleAudioArrayBuffer(event.data);
      return;
    }

    if (Array.isArray(event.data) && event.data.length === 0) {
      console.log("收到空数组消息");
      return;
    }

    try {
      const data = JSON.parse(event.data);
      handleWsJsonMessage(data);
    } catch (error) {
      console.error('处理WebSocket消息失败:', error);
    }
  };

  const handleWsJsonMessage = (data: any) => {
    if (!data || typeof data !== 'object') return;
    const safeClearQueue = (reason: string) => {
      const now = Date.now();
      if (Platform.OS === 'android' && now - lastQueueClearAtMsRef.current < 400) {
        console.log(`跳过清空音频队列（防抖）：${reason}`);
        return;
      }
      lastQueueClearAtMsRef.current = now;
      console.log(`清空音频播放队列（原因：${reason}）`);
      audioServiceRef.current?.clearAudioQueue();
    };
    if (data.type === 'gemini_response') {
      const isNewMessage = !!data.isNewMessage;
      const text: string = typeof data.text === 'string' ? data.text : '';
      if (isNewMessage) {
        console.log('收到新消息');
        safeClearQueue('gemini_response.isNewMessage');
        appendMessage(text, 'gemini', true);
      } else if (text) {
        appendMessage(text, 'gemini', false);
      }
    } else if (data.type === 'cozy_audio') {
      const isNewMessage = data.isNewMessage || false;
      if (isNewMessage) {
        safeClearQueue('cozy_audio.isNewMessage');
      }
      if (data.format === 'base64') {
        audioServiceRef.current?.handleBase64Audio(data.audioData, isNewMessage);
      }
    } else if (data.type === 'user_activity') {
      console.log('🎤 检测到用户语音活动，让路给麦克风');
      safeClearQueue('user_activity');
    } else if (data.type === 'status') {
      audioServiceRef.current?.handleStatusUpdate(data);
      try {
        const msg: string = data?.message ?? '';
        if (typeof msg === 'string' && msg.includes('失联了，即将重启')) {
          const shouldRestart = audioServiceRef.current?.getIsSessionActive() || isRecordingRef.current;
          if (shouldRestart) {
            if (restartInFlightRef.current || restartTimerRef.current) {
              console.log('自动重启已排队，跳过重复失联状态');
              return;
            }
            restartInFlightRef.current = true;
            console.log('检测到失联状态，执行自动重启会话');
            (async () => {
              try {
                await audioServiceRef.current?.endAICall();
              } catch (e) {
                console.warn('自动重启：结束会话失败（可忽略）', e);
              }
              restartTimerRef.current = setTimeout(async () => {
                try {
                  await audioServiceRef.current?.startAICall();
                } catch (e) {
                  console.warn('自动重启：重启会话失败', e);
                } finally {
                  restartTimerRef.current = null;
                  restartInFlightRef.current = false;
                }
              }, 7500);
            })();
          }
        }
      } catch (e) {
        console.warn('处理 status 消息时异常:', e);
      }
    } else if (data.type === 'system') {
      if (data.data === 'turn end') {
        console.log('收到turn end事件 - 后端处理结束，前端继续播放队列中的音频');
      }
    }
  };

  const appendMessage = (text: string, sender: string, isNewMessage: boolean) => {
    const getCurrentTimeString = () => {
      return new Date().toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    };

    if (sender === 'gemini' && !isNewMessage) {
      setMessages(prevMessages => {
        const lastGeminiIndex = prevMessages.map(m => m.sender).lastIndexOf('gemini');
        if (lastGeminiIndex !== -1) {
          return prevMessages.map((m, idx) => idx === lastGeminiIndex ? { ...m, text: m.text + text } : m);
        }
        const newMessage = {
          id: Date.now().toString(),
          text: `[${getCurrentTimeString()}] 🎀 ${text}`,
          sender,
          timestamp: getCurrentTimeString()
        };
        return [...prevMessages, newMessage];
      });
    } else {
      const newMessage = {
        id: Date.now().toString(),
        text: `[${getCurrentTimeString()}] ${sender === 'gemini' ? '🎀' : '👤'} ${text}`,
        sender,
        timestamp: getCurrentTimeString()
      };
      setMessages(prev => [...prev, newMessage]);
    }
  };

  const startAICall = async () => {
    if (audioServiceRef.current) {
      try {
        await audioServiceRef.current.startAICall();
        setIsSessionActive(audioServiceRef.current.getIsSessionActive());
        setIsRecording(audioServiceRef.current.getIsRecording());
      } catch (error) {
        console.error('开始通话失败:', error);
        Alert.alert('错误', '开始通话失败');
      }
    }
  };

  const endAICall = async () => {
    if (audioServiceRef.current) {
      try {
        await audioServiceRef.current.endAICall();
        setIsSessionActive(audioServiceRef.current.getIsSessionActive());
        setIsRecording(audioServiceRef.current.getIsRecording());
      } catch (error) {
        console.error('结束通话失败:', error);
        Alert.alert('错误', '结束通话失败');
      }
    }
  };

  return (
    <ThemedView>
      <View style={{ paddingTop: 100 }} />

      <View style={s.statusContainer}>
        <Text style={s.statusText}>
          连接配置: {connectionConfig.host}:{connectionConfig.port} / {connectionConfig.characterName}
        </Text>
        <Text style={s.statusText}>
          AI通话状态: {isSessionActive ? '通话中' : '未通话'}
        </Text>
        <Text style={s.statusText}>
          WebSocket: {isConnected ? '已连接' : '未连接'}
        </Text>
        {isRecording && (
          <Text style={s.statusText}>录音状态: 录音中</Text>
        )}
        {isPlaying && (
          <Text style={s.statusText}>播放状态: 播放中</Text>
        )}
      </View>

      <View style={s.callControls}>
        <Button
          title={isSessionActive ? "结束通话" : "开始通话"}
          onPress={isSessionActive ? endAICall : startAICall}
          color={isSessionActive ? cc.error : cc.success}
        />
        {__DEV__ && (
          <View style={{ height: theme.spacing.md }} />
        )}
        {__DEV__ && (
          <Button
            title="扫码配置（Dev）"
            onPress={() => router.push({ pathname: '/qr-scanner', params: { returnTo: '/explore' } })}
            color={cc.accent}
          />
        )}
      </View>

      <View style={s.messagesContainer}>
        <Text style={s.messagesTitle}>消息记录:</Text>
        <ScrollView style={s.messagesScrollView} showsVerticalScrollIndicator={false}>
          {messages.length === 0 ? (
            <Text style={s.noMessagesText}>暂无消息</Text>
          ) : (
            messages.map((m) => (
              <View key={m.id} style={s.messageItem}>
                <Text style={s.messageText}>{m.text}</Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>

    </ThemedView>
  );
}
