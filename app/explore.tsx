import { ThemedView } from '@/components/themed-view';
import { AudioService } from '@/services/AudioService';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { parseDevConnectionConfig, type DevConnectionConfig } from '@/utils/devConnectionConfig';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Button, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

export default function ExploreScreen() {
	const router = useRouter();
	const params = useLocalSearchParams<{ qr?: string }>();

	const audioServiceRef = useRef<AudioService | null>(null);
	const lastQueueClearAtMsRef = useRef<number>(0);
	const lastAppliedQrRef = useRef<string | null>(null);

	const { config: connectionConfig, setConfig: setConnectionConfig } = useDevConnectionConfig();

	const [isSessionActive, setIsSessionActive] = useState<boolean>(false);
	const [isConnected, setIsConnected] = useState<boolean>(false);
	const [messages, setMessages] = useState<Array<{ id: string; text: string; sender: string; timestamp: string }>>([]);
	const [isRecording, setIsRecording] = useState<boolean>(false);
	const [isPlaying, setIsPlaying] = useState<boolean>(false);
	const [focusModeState, setFocusModeState] = useState<boolean>(false);

	const getErrorMessage = (error: unknown): string => {
		if (error instanceof Error && error.message) {
			return error.message;
		}
		return String(error);
	};

	// 扫码回填（只在参数变化时处理一次，避免重复应用）
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

		// 切换配置时重建连接（避免写死 IP 导致 dev 调试困难）
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

		// 初始化 AudioService
		audioServiceRef.current.init().catch((error) => {
			console.error('AudioService 初始化失败:', error);
			Alert.alert('初始化失败', getErrorMessage(error));
		});

		return () => {
			audioServiceRef.current?.destroy();
		};
	}, [connectionConfig.characterName, connectionConfig.host, connectionConfig.port]);

	// 统一处理 WebSocket 消息
	const handleWsMessage = (event: MessageEvent) => {
		// 处理二进制音频数据
		if (event.data instanceof Blob) {
			console.log("收到新的音频块 (Blob)");
			audioServiceRef.current?.handleAudioBlob(event.data);
			return;
		}

		// 处理ArrayBuffer类型的音频数据（React Native可能是这种格式）
		if (event.data instanceof ArrayBuffer) {
			console.log("收到ArrayBuffer音频数据，长度:", event.data.byteLength);
			audioServiceRef.current?.handleAudioArrayBuffer(event.data);
			return;
		}

		// 处理空数组
		if (Array.isArray(event.data) && event.data.length === 0) {
			console.log("收到空数组消息");
			return;
		}

		// 处理JSON消息
		try {
			const data = JSON.parse(event.data);
			handleWsJsonMessage(data);
		} catch (error) {
			console.error('处理WebSocket消息失败:', error);
		}
	};

	// 统一处理 WebSocket JSON 消息
	const handleWsJsonMessage = (data: any) => {
		if (!data || typeof data !== 'object') return;
		const safeClearQueue = (reason: string) => {
			// 防抖：避免同一时刻来自不同消息的重复清空导致音频被截断
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
			// 参考 audio-test.tsx：后端检测到用户说话，清空播放以让路
			console.log('🎤 检测到用户语音活动，让路给麦克风');
			safeClearQueue('user_activity');
		} else if (data.type === 'status') {
			audioServiceRef.current?.handleStatusUpdate(data);
			try {
				const msg: string = data?.message ?? '';
				if (typeof msg === 'string' && msg.includes('失联了，即将重启')) {
					// 与 Web 行为对齐：先结束当前会话，再延时重启
					const shouldRestart = audioServiceRef.current?.getIsSessionActive() || isRecording;
					if (shouldRestart) {
						console.log('检测到失联状态，执行自动重启会话');
						(async () => {
							try {
								await audioServiceRef.current?.endAICall();
							} catch (e) {
								console.warn('自动重启：结束会话失败（可忽略）', e);
							}
							setTimeout(async () => {
								try {
									await audioServiceRef.current?.startAICall();
								} catch (e) {
									console.warn('自动重启：重启会话失败', e);
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

	// 开始AI通话会话
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

	// 结束AI通话会话
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

			{/* 状态显示 */}
			<View style={styles.statusContainer}>
				<Text style={styles.statusText}>
					连接配置: {connectionConfig.host}:{connectionConfig.port} / {connectionConfig.characterName}
				</Text>
				<Text style={styles.statusText}>
					AI通话状态: {isSessionActive ? '通话中' : '未通话'}
				</Text>
				<Text style={styles.statusText}>
					WebSocket: {isConnected ? '已连接' : '未连接'}
				</Text>
				{isRecording && (
					<Text style={styles.statusText}>录音状态: 录音中</Text>
				)}
				{isPlaying && (
					<Text style={styles.statusText}>播放状态: 播放中</Text>
				)}
			</View>

			{/* 主要通话控制按钮 */}
			<View style={styles.callControls}>
				<Button
					title={isSessionActive ? "结束通话" : "开始通话"}
					onPress={isSessionActive ? endAICall : startAICall}
					color={isSessionActive ? "#ff4444" : "#4CAF50"}
				/>
				{__DEV__ && (
					<View style={{ height: 12 }} />
				)}
				{__DEV__ && (
					<Button
						title="扫码配置（Dev）"
						onPress={() => router.push({ pathname: '/qr-scanner', params: { returnTo: '/explore' } })}
						color="#2f6fed"
					/>
				)}
			</View>

			{/* 消息输出区域 */}
			<View style={styles.messagesContainer}>
				<Text style={styles.messagesTitle}>消息记录:</Text>
				<ScrollView style={styles.messagesScrollView} showsVerticalScrollIndicator={false}>
					{messages.length === 0 ? (
						<Text style={styles.noMessagesText}>暂无消息</Text>
					) : (
						messages.map((m) => (
							<View key={m.id} style={styles.messageItem}>
								<Text style={styles.messageText}>{m.text}</Text>
							</View>
						))
					)}
				</ScrollView>
			</View>

		</ThemedView>
	);
}

const styles = StyleSheet.create({
	statusContainer: {
		padding: 16,
		backgroundColor: '#f0f0f0',
		margin: 16,
		borderRadius: 8,
	},
	statusText: {
		fontSize: 14,
		marginBottom: 4,
		color: '#333',
	},
	callControls: {
		margin: 16,
		padding: 16,
		backgroundColor: '#e8f5e8',
		borderRadius: 8,
		borderWidth: 2,
		borderColor: '#4CAF50',
	},
	messagesContainer: {
		marginHorizontal: 16,
		marginTop: 8,
		marginBottom: 24,
		padding: 12,
		backgroundColor: '#ffffff',
		borderRadius: 8,
		borderWidth: 1,
		borderColor: '#eee',
	},
	messagesTitle: {
		fontSize: 16,
		fontWeight: 'bold',
		color: '#333',
		marginBottom: 8,
	},
	messagesScrollView: {
		maxHeight: 180,
	},
	noMessagesText: {
		textAlign: 'center',
		color: '#999',
		fontStyle: 'italic',
		paddingVertical: 16,
	},
	messageItem: {
		marginBottom: 8,
		paddingHorizontal: 10,
		paddingVertical: 8,
		backgroundColor: '#f6f8fa',
		borderRadius: 6,
	},
	messageText: {
		fontSize: 14,
		color: '#444',
		lineHeight: 18,
	},
});
