import { createCharactersApiClient } from '@/services/api/characters';
import type { CharactersData } from '@/services/api/characters';
import { createPageConfigApiClient, type PageConfigResponse } from '@/services/api/pageConfig';
import { buildHttpBaseURL, appendP2PToken } from '@/utils/devConnectionConfig';
import { useAudio } from '@/hooks/useAudio';
import { useChatMessages } from '@/hooks/useChatMessages';
import * as ImageManipulator from 'expo-image-manipulator';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { useUdpP2PConnection, type UdpConnectionStatus } from '@/hooks/useUdpP2PConnection';
import { useLipSync } from '@/hooks/useLipSync';
import { useLive2D } from '@/hooks/useLive2D';
import { useLive2DAgentBackend } from '@/hooks/useLive2DAgentBackend';
import { useLive2DPreferences } from '@/hooks/useLive2DPreferences';
import { useVrmBehavior } from '@/hooks/useVrmBehavior';
import { useVrmMotionCalibration } from '@/hooks/useVrmMotionCalibration';
import { useImagePicker } from '@/hooks/useImagePicker';
import { useCamera } from '@/hooks/useCamera';
import { useCameraStream } from '@/hooks/useCameraStream';
import { CameraView } from 'expo-camera';
import { ImageMessageService } from '@/services/imageMessage';
import { mainManager } from '@/utils/MainManager';
import { sessionStore } from '@/utils/sessionStore';
import { VoicePrepareOverlay } from '@/components/VoicePrepareOverlay';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/ThemeContext';
import { useChatFont, FONT_OPTIONS } from '@/constants/FontContext';
import { Live2DStage } from '@/components/Live2DStage';
import { CharacterSelectionModal } from '@/components/CharacterSelectionModal';
import { VoiceBlockModal } from '@/components/VoiceBlockModal';
import { CharacterSwitchOverlay } from '@/components/CharacterSwitchOverlay';
import type { VRMLightingConfig, VRMRenderPhase } from '@/components/vrm/VRMAvatarView';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, AppState, Appearance, Dimensions, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View,
} from 'react-native';
import {
  Live2DRightToolbar,
  ChatContainer,
  StatusToast,
  type Live2DRightToolbarPanel,
  type Live2DSettingsToggleId,
  type Live2DSettingsState,
  type Live2DAgentToggleId,
  type ConnectionStatus,
  type StatusToastHandle,
} from '@project_neko/components';

type MainUIScreenProps = {}

type MobileRuntimePhase = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'disconnected' | 'failed';
type AvatarModelType = 'live2d' | 'vrm';

const MAX_IMAGE_BASE64_LENGTH = 1_500_000;

async function compressImageIfNeeded(dataURI: string): Promise<string> {
  if (dataURI.length <= MAX_IMAGE_BASE64_LENGTH) return dataURI;
  try {
    const result = await ImageManipulator.manipulateAsync(
      dataURI,
      [{ resize: { width: 1280 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true },
    );
    if (result.base64) return `data:image/jpeg;base64,${result.base64}`;
  } catch (e) {
    console.warn('[compressImage] failed, sending original:', e);
  }
  return dataURI;
}

function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function resolveBackendModelUrl(modelPath: string, apiBase: string, p2pToken?: string): string {
  const raw = modelPath.trim();
  if (!raw) return '';
  if (raw.startsWith('file://') || raw.startsWith('content://')) return raw;
  if (/^https?:\/\//i.test(raw)) return appendP2PToken(raw, p2pToken);

  const base = apiBase.endsWith('/') ? apiBase : `${apiBase}/`;
  return appendP2PToken(new URL(raw, base).toString(), p2pToken);
}

function isErrorStatusMessage(message: string): boolean {
  const parts = [message];

  try {
    const parsed: unknown = JSON.parse(message);
    if (parsed && typeof parsed === 'object') {
      const payload = parsed as Record<string, unknown>;
      if (typeof payload.code === 'string') parts.push(payload.code);
      if (payload.details) parts.push(JSON.stringify(payload.details));
    }
  } catch {
    // Plain text status.
  }

  return /(error|fail|failed|failure|arrears|quota|rejected|unauthorized|timeout|crashed|not_running|closed_abnormal|欠费|失败|错误|异常|超时|崩溃|未启动|断开)/i.test(parts.join(' '));
}

function normalizeVrmLighting(lighting: PageConfigResponse['lighting']): VRMLightingConfig | undefined {
  if (!lighting || typeof lighting !== 'object') return undefined;

  const next: VRMLightingConfig = {};
  const keys: (keyof VRMLightingConfig)[] = [
    'ambient',
    'main',
    'fill',
    'rim',
    'top',
    'bottom',
    'exposure',
    'toneMapping',
    'outlineWidthScale',
  ];

  for (const key of keys) {
    const value = lighting[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      next[key] = value;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
}

const MainUIScreen: React.FC<MainUIScreenProps> = () => {
  const { t, i18n: i18nInstance } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const cc = theme.colors;
  const insets = useSafeAreaInsets();
  const { fontId: chatFontId, setFontId: setChatFontId } = useChatFont();

  const [isPageFocused, setIsPageFocused] = useState(true);

  // 角色选择 Modal 状态
  const [characterModalVisible, setCharacterModalVisible] = useState(false);
  const [voiceBlockModalVisible, setVoiceBlockModalVisible] = useState(false);
  const [characterList, setCharacterList] = useState<string[]>([]);
  const [currentCatgirl, setCurrentCatgirl] = useState<string | null>(null);
  const [characterLoading, setCharacterLoading] = useState(false);
  const [switchedCharacterName, setSwitchedCharacterName] = useState<string | null>(null);
  const [switchError, setSwitchError] = useState<string | null>(null);
  const switchedNameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const switchErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const characterLoadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isChatForceCollapsed, setIsChatForceCollapsed] = useState(false);
  const [chatExpanded, setChatExpanded] = useState(false);
  useEffect(() => { if (isChatForceCollapsed) setChatExpanded(false); }, [isChatForceCollapsed]);
  const [voicePrepareStatus, setVoicePrepareStatus] = useState<'preparing' | 'ready' | null>(null);
  const isSwitchingCharacterRef = useRef(false);
  // 🔥 新增：应用是否在后台的标志 ref，用于在拍照等场景忽略 WebSocket 错误
  const isInBackgroundRef = useRef(false);
  // 🔥 新增：记录是否是从后台恢复，用于显示"已恢复连接"提示
  const wasInBackgroundRef = useRef(false);
  // AppState 后台延迟重置 timer ref（确保组件卸载时清理）
  const appStateTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // StatusToast ref，用于显示连接状态提示
  const statusToastRef = useRef<StatusToastHandle>(null);
  // 合并为单一对象，确保 modelName 和 modelUrl 同步更新，避免两次 setState 触发两次 useLive2D effect
  const [live2dModel, setLive2dModel] = useState<{ name: string; url: string | undefined; itemId?: string }>({
    name: 'mao_pro',
    url: undefined,
  });
  const [avatarModelType, setAvatarModelType] = useState<AvatarModelType>('live2d');
  const [vrmModelUrl, setVrmModelUrl] = useState<string | undefined>(undefined);
  const [vrmLighting, setVrmLighting] = useState<VRMLightingConfig | undefined>(undefined);
  // ref 持有最新 currentCatgirl，供 onConnectionChange 闭包安全读取（避免 stale closure）
  const currentCatgirlRef = useRef<string | null>(null);
  currentCatgirlRef.current = currentCatgirl;
  const avatarModelTypeRef = useRef<AvatarModelType>(avatarModelType);
  avatarModelTypeRef.current = avatarModelType;
  // ref 持有最新值，供 useFocusEffect 闭包读取（避免 stale closure）
  const live2dModelRef = useRef(live2dModel);
  live2dModelRef.current = live2dModel;
  // ref 持有 audio.reconnect 和连接状态，供 AppState 前台恢复时调用
  const audioReconnectRef = useRef<() => void>(() => {});
  const audioConnectedRef = useRef(false);
  const { config, isLoaded: isConfigLoaded, setConfig, applyQrRaw, refreshFromCloud, refreshPairing } = useDevConnectionConfig();

  // UDP P2P 连接（自动尝试三层回退）
  const udpConnection = useUdpP2PConnection(
    config,
    isConfigLoaded,
    setConfig,
    refreshFromCloud
  );
  const udpRetryRef = useRef<() => void>(() => {});
  const udpStatusRef = useRef<UdpConnectionStatus>('idle');
  udpRetryRef.current = udpConnection.retry;
  udpStatusRef.current = udpConnection.status;

  const params = useLocalSearchParams<{
    qr?: string;
    host?: string;
    port?: string;
    name?: string;
    characterName?: string;
  }>();
  const lastAppliedQrRef = useRef<string | null>(null);

  // 🔥 监听应用状态变化，在应用进入后台时标记状态（如拍照场景）
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        console.log('📱 应用进入后台，标记后台状态');
        if (appStateTimerRef.current) clearTimeout(appStateTimerRef.current);
        isInBackgroundRef.current = true;
      } else if (nextAppState === 'active') {
        console.log('📱 应用回到前台，延迟重置后台状态');
        wasInBackgroundRef.current = true;
        if (appStateTimerRef.current) clearTimeout(appStateTimerRef.current);
        // 延迟 1.5s 后检查连接状态，如果仍断连则触发重连
        appStateTimerRef.current = setTimeout(() => {
          appStateTimerRef.current = null;
          isInBackgroundRef.current = false;
          wasInBackgroundRef.current = false;
          console.log('📱 后台状态标志已重置');
        }, 2000);
        // 独立定时器：1.5s 后检查连接，给 realtime client 内部重连一点时间
        setTimeout(() => {
          if (udpStatusRef.current === 'failed') {
            console.log('📱 前台恢复后 P2P 仍失败，重试局域网/P2P 探测');
            udpRetryRef.current();
            return;
          }
          if (!audioConnectedRef.current) {
            console.log('📱 前台恢复但连接断开，触发重连');
            audioReconnectRef.current();
          }
        }, 1500);
      }
    });

    return () => {
      subscription.remove();
      if (appStateTimerRef.current) {
        clearTimeout(appStateTimerRef.current);
        appStateTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const qrParam = typeof params.qr === 'string' ? params.qr : undefined;
    let raw: string | null = null;

    if (qrParam) {
      try {
        raw = decodeURIComponent(qrParam);
      } catch {
        raw = qrParam;
      }
    } else {
      const host = typeof params.host === 'string' ? params.host.trim() : '';
      const portStr = typeof params.port === 'string' ? params.port.trim() : '';
      const name =
        typeof params.characterName === 'string'
          ? params.characterName.trim()
          : typeof params.name === 'string'
            ? params.name.trim()
            : '';

      if (host || portStr || name) {
        const payload: { host?: string; port?: number; characterName?: string } = {};
        if (host) payload.host = host;
        if (portStr && /^\d+$/.test(portStr)) payload.port = Number(portStr);
        if (name) payload.characterName = name;
        raw = JSON.stringify(payload);
      }
    }

    if (!raw) return;
    if (lastAppliedQrRef.current === raw) return;
    lastAppliedQrRef.current = raw;

    applyQrRaw(raw).then((res) => {
      if (!res.ok) {
        Alert.alert(t('qrScanner.invalidCode'), res.error);
      }
    });
  }, [applyQrRaw, params.characterName, params.host, params.name, params.port, params.qr]);

  // 从后端获取角色对应的模型信息并更新渲染状态
  const syncCharacterModel = useCallback(async (catgirlName: string) => {
    console.log('🎨 [syncCharacterModel] called, catgirlName =', catgirlName, 'isConfigLoaded =', isConfigLoaded);
    // 等待配置加载完成
    if (!isConfigLoaded) return;

    try {
      const apiBase = buildHttpBaseURL(config);
      try {
        const pageConfigClient = createPageConfigApiClient(apiBase, config.p2p?.token);
        const pageConfig = await pageConfigClient.getPageConfig(catgirlName);
        const isVrm =
          pageConfig.success &&
          !!pageConfig.model_path &&
          (pageConfig.model_type === 'vrm' ||
            (pageConfig.model_type === 'live3d' && pageConfig.live3d_sub_type === 'vrm'));

        if (isVrm) {
          const modelUrl = resolveBackendModelUrl(pageConfig.model_path, apiBase, config.p2p?.token);
          if (__DEV__) console.log('🎨 [syncCharacterModel] 设置 VRM URL:', modelUrl);
          setAvatarModelType('vrm');
          setVrmModelUrl(modelUrl);
          setVrmLighting(normalizeVrmLighting(pageConfig.lighting));
          setLive2dModel((prev) => ({ ...prev, url: undefined, itemId: undefined }));
          return;
        }
      } catch (pageConfigError) {
        console.warn('[syncCharacterModel] page_config 获取失败，回退 Live2D 模型接口:', pageConfigError);
      }

      const client = createCharactersApiClient(apiBase, config.p2p?.token);
      const modelRes = await client.getCurrentLive2dModel(catgirlName);
      if (__DEV__) console.log('🎨 [syncCharacterModel] Live2D API 返回:', JSON.stringify(modelRes));
      if (modelRes.success && modelRes.model_info) {
        const modelUrl = appendP2PToken(`${apiBase}${modelRes.model_info.path}`, config.p2p?.token);
        if (__DEV__) console.log('🎨 [syncCharacterModel] 设置 Live2D URL:', modelUrl);
        setAvatarModelType('live2d');
        setVrmModelUrl(undefined);
        setVrmLighting(undefined);
        setLive2dModel({
          name: modelRes.model_info.name,
          url: modelUrl,
          itemId: modelRes.model_info.item_id,
        });
      } else {
        console.warn('🎨 [syncCharacterModel] Live2D API 返回但无 model_info:', modelRes);
      }
    } catch (e) {
      console.warn('[syncCharacterModel] 获取模型信息失败:', e);
    }
  }, [config, isConfigLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 启动时从服务端获取当前角色，以服务端为准
  useEffect(() => {
    if (__DEV__) console.log('🔍 [syncCurrentCatgirl] isConfigLoaded =', isConfigLoaded, 'config =', JSON.stringify({ host: config.host, port: config.port, char: config.characterName, hasP2P: !!config.p2p }));
    // 等待配置加载完成
    if (!isConfigLoaded) return;
    console.log('✅ [syncCurrentCatgirl] 配置已加载，开始同步角色');

    const syncCurrentCatgirl = async () => {
      try {
        const apiBase = buildHttpBaseURL(config);
        if (__DEV__) console.log('🌐 [syncCurrentCatgirl] apiBase =', apiBase);
        const client = createCharactersApiClient(apiBase, config.p2p?.token);
        const res = await client.getCurrentCatgirl();
        if (__DEV__) console.log('📦 [syncCurrentCatgirl] getCurrentCatgirl 返回:', JSON.stringify(res));
        if (res.current_catgirl) {
          setCurrentCatgirl(res.current_catgirl);
          if (config.characterName !== res.current_catgirl) {
            await setConfig({ ...config, characterName: res.current_catgirl });
          }
          console.log('🎭 [syncCurrentCatgirl] 准备 syncCharacterModel:', res.current_catgirl);
          await syncCharacterModel(res.current_catgirl);
          console.log('✅ [syncCurrentCatgirl] syncCharacterModel 完成');

          // 发送 start_session 以同步角色音色
          // 使用 audio.isReadyRef（ref，始终最新）避免闭包捕获 isConnected 旧值
          setTimeout(() => {
            if (audio.isReadyRef.current) {
              console.log('📤 发送 start_session 以同步角色音色');
              audio.sendMessage({
                action: 'start_session',
                input_type: 'text',
                audio_format: 'PCM_48000HZ_MONO_16BIT',
                new_session: false,
              });
            }
          }, 500);
        }
      } catch (e) {
        console.warn('❌ [syncCurrentCatgirl] 失败:', e);
        // 网络不通时降级：用本地缓存初始化 UI
        if (config.characterName) setCurrentCatgirl(config.characterName);
      }
    };
    syncCurrentCatgirl();
  }, [isConfigLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // 工具栏状态管理（与 Web 版本一致）
  const [isMobile, setIsMobile] = useState(true); // RN 默认为移动端
  const [screenHeight, setScreenHeight] = useState(() => Dimensions.get('window').height);
  const [toolbarGoodbyeMode, setToolbarGoodbyeMode] = useState(false);
  const [toolbarMicEnabled, setToolbarMicEnabled] = useState(false);
  const [isVrmVisionMode, setIsVrmVisionMode] = useState(false);
  const [toolbarOpenPanel, setToolbarOpenPanel] = useState<Live2DRightToolbarPanel>(null);
  const [toolbarSettings, setToolbarSettings] = useState<Live2DSettingsState>({
    mergeMessages: true,
    allowInterrupt: true,
    proactiveChat: false,
    proactiveVision: false,
    darkMode: false,
  });
  const {
    emotion: vrmEmotion,
    gesture: vrmGesture,
    gestureRevision: vrmGestureRevision,
    dispatch: dispatchVrmBehavior,
  } = useVrmBehavior({
    enabled: avatarModelType === 'vrm',
    isVoiceMode: toolbarMicEnabled,
    isVisionMode: isVrmVisionMode,
  });

  useEffect(() => {
    dispatchVrmBehavior({ type: 'model_changed' });
  }, [avatarModelType, dispatchVrmBehavior, vrmModelUrl]);

  // 消息去重：跟踪已发送消息的 clientMessageId（使用 Map 存储时间戳，支持 TTL 清理）
  // 配置：TTL 5分钟，最大条目数 1000，清理间隔 1分钟
  const DEDUPE_TTL_MS = 5 * 60 * 1000;
  const DEDUPE_MAX_SIZE = 1000;
  const DEDUPE_CLEANUP_INTERVAL_MS = 60 * 1000;
  const sentClientMessageIds = useRef<Map<string, number>>(new Map());
  const messageCounterRef = useRef(0);

  // 定期清理过期的去重条目，防止内存无限增长
  useEffect(() => {
    const cleanup = () => {
      const now = Date.now();
      const map = sentClientMessageIds.current;

      // 删除超过 TTL 的条目
      for (const [id, timestamp] of map) {
        if (now - timestamp > DEDUPE_TTL_MS) {
          map.delete(id);
        }
      }

      // 如果仍超过最大数量，按时间戳淘汰最旧的条目
      if (map.size > DEDUPE_MAX_SIZE) {
        const entries = Array.from(map.entries()).sort((a, b) => a[1] - b[1]);
        const toRemove = entries.slice(0, map.size - DEDUPE_MAX_SIZE);
        for (const [id] of toRemove) {
          map.delete(id);
        }
      }
    };

    const interval = setInterval(cleanup, DEDUPE_CLEANUP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Text session 管理（与 Web 端一致）
  const [isTextSessionActive, setIsTextSessionActive] = useState(false);
  const sessionStartedResolverRef = useRef<((value: boolean) => void) | null>(null);
  const sessionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSessionPromiseRef = useRef<Promise<boolean> | null>(null);
  const activeSessionModeRef = useRef<'text' | 'audio' | null>(null);

  // Agent Backend 管理（传入 openPanel 以支持动态刷新）
  const { agent, onAgentChange, refreshAgentState } = useLive2DAgentBackend({
    apiBase: `http://${config.host}:${config.port}`,
    showToast: (message, duration) => {
      Alert.alert(t('common.alert'), message);
    },
    openPanel: toolbarOpenPanel === 'agent' ? 'agent' : null,
  });

  // Live2D Preferences 持久化
  const { repository: preferencesRepository } = useLive2DPreferences();
  const { calibration: vrmMotionCalibration } = useVrmMotionCalibration();

  const chat = useChatMessages({
    maxMessages: 100,
  });

  // 图片选择器 hook
  const imagePicker = useImagePicker({
    maxSelectionCount: 5,
    allowsMultipleSelection: true,
  });

  // 相机 hook
  const camera = useCamera();

  // 相机拍照结果状态（传递给 ChatContainer 的 externalPendingImages）
  const [cameraPendingImages, setCameraPendingImages] = useState<{ id: string; base64: string }[]>([]);

  // 处理相机拍照结果
  useEffect(() => {
    if (camera.photo) {
      dispatchVrmBehavior({ type: 'vision_image_captured' });
      // 将拍照结果添加到待发送列表
      const newImage = {
        id: `camera-${Date.now()}`,
        base64: camera.photo.base64, // 纯 base64，不添加前缀
      };
      setCameraPendingImages(prev => [...prev, newImage].slice(0, 5));
      camera.clearPhoto();
    }
  }, [camera.photo, camera.clearPhoto, dispatchVrmBehavior]);

  // 稳定 P2P 配置引用，避免不必要的重连（依赖整个 p2p 对象，而非只追踪 token）
  const p2pConfig = useMemo(() => config.p2p, [config.p2p]);
  const isAudioConnectionEnabled = isConfigLoaded && (!p2pConfig || udpConnection.status === 'connected');

  const audio = useAudio({
    host: config.host,
    port: config.port,
    characterName: config.characterName,
    p2p: p2pConfig,  // P2P 配置（如果存在则使用 P2P 模式连接）
    enabled: isAudioConnectionEnabled,  // 等待配置和 LAN/P2P 连接确认后再连接
    isSwitchingRef: isSwitchingCharacterRef,  // 传入角色切换标志，用于在切换期间忽略错误
    isInBackgroundRef: isInBackgroundRef,  // 传入后台标志，用于在拍照等场景忽略错误
    onMessage: async (event) => {
      // 二进制音频数据已由 @project_neko/audio-service 自动播放（通过 Realtime binary 事件接管）
      // 这里仅保留文本消息处理逻辑
      if (typeof event.data !== 'string') return;

      // 检查 clientMessageId 用于去重
      let parsedMsg: Record<string, unknown> | null = null;
      try {
        parsedMsg = JSON.parse(event.data);
        const clientMessageId = parsedMsg?.clientMessageId as string | undefined;
        if (clientMessageId && sentClientMessageIds.current.has(clientMessageId)) {
          // 服务器回显，跳过处理
          sentClientMessageIds.current.delete(clientMessageId);
          return;
        }
      } catch {
        // 非 JSON 消息，继续处理
      }

      // 处理 session_started 事件（text session 管理）
      if (parsedMsg?.type === 'session_started') {
        const inputMode = parsedMsg.input_mode as string | undefined;
        console.log('✅ 收到 session_started，input_mode:', inputMode);
        if (inputMode === 'text') {
          setIsTextSessionActive(true);
          activeSessionModeRef.current = 'text';
        } else if (inputMode === 'audio') {
          // audio session 启动意味着 text session 已被替换，重置状态
          setIsTextSessionActive(false);
          activeSessionModeRef.current = 'audio';
        } else {
          activeSessionModeRef.current = null;
        }
        dispatchVrmBehavior({ type: 'session_started', inputMode });
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
          sessionTimeoutRef.current = null;
        }
        if (sessionStartedResolverRef.current) {
          sessionStartedResolverRef.current(true);
          sessionStartedResolverRef.current = null;
        }
        pendingSessionPromiseRef.current = null;
        return;
      }

      // 处理 session_failed 事件
      if (parsedMsg?.type === 'session_failed') {
        console.log('❌ 收到 session_failed，input_mode:', parsedMsg.input_mode);
        setIsTextSessionActive(false);
        dispatchVrmBehavior({ type: 'session_failed' });
        activeSessionModeRef.current = null;
        if (sessionTimeoutRef.current) {
          clearTimeout(sessionTimeoutRef.current);
          sessionTimeoutRef.current = null;
        }
        if (sessionStartedResolverRef.current) {
          sessionStartedResolverRef.current(false);
          sessionStartedResolverRef.current = null;
        }
        pendingSessionPromiseRef.current = null;
        return;
      }

      // 处理 session_ended_by_server 事件（服务端主动终止 session，如 API 断连）
      if (parsedMsg?.type === 'session_ended_by_server') {
        console.log('⚠️ 收到 session_ended_by_server，input_mode:', parsedMsg.input_mode);
        setIsTextSessionActive(false);
        dispatchVrmBehavior({ type: 'session_ended' });
        activeSessionModeRef.current = null;
        return;
      }

      // 处理 session_preparing 事件（服务端正在准备 session，如模型加载）
      if (parsedMsg?.type === 'session_preparing') {
        console.log('⏳ 收到 session_preparing，input_mode:', parsedMsg.input_mode);
        dispatchVrmBehavior({ type: 'session_preparing' });
        return;
      }

      // 处理文本消息并通过 MainManager 协调
      const result = await chat.handleWebSocketMessage(event);

      // 根据消息类型，通过 MainManager 触发相应的行为
      if (result?.type === 'gemini_response') {
        mainManager.onGeminiResponse(!!result.isNewMessage);
        dispatchVrmBehavior({ type: 'assistant_response', isNewMessage: !!result.isNewMessage });
      } else if (result?.type === 'user_activity') {
        mainManager.onUserSpeechDetected();
        dispatchVrmBehavior({ type: 'user_activity' });
      } else if (result?.type === 'turn_end') {
        mainManager.onTurnEnd(result.fullText);
        dispatchVrmBehavior({ type: 'turn_end' });
      } else if (result?.type === 'response_discarded') {
        // 后端丢弃了当前响应（如用户打断或新轮覆盖），清理流式 UI 状态
        console.log('🗑️ 收到 response_discarded');
        dispatchVrmBehavior({ type: 'response_discarded' });
      } else if ((result?.type === 'status' || result?.type === 'system_notice') && result.message) {
        // 系统状态消息通过 Toast 显示，不加入聊天列表
        if (isErrorStatusMessage(result.message)) {
          dispatchVrmBehavior({ type: 'status_error' });
        }
        statusToastRef.current?.show(result.message, 3000);
      } else if (result?.type === 'catgirl_switched' && result.characterName) {
        // 幂等保护：如果已在切换中且目标角色相同，跳过重复处理
        if (isSwitchingCharacterRef.current && currentCatgirlRef.current === result.characterName) {
          console.log('🔄 [catgirl_switched] 已在切换中，跳过重复处理');
          return;
        }

        // 检查是否需要触发 WebSocket 重连
        const needsReconnect = config.characterName !== result.characterName;

        // 本地和远端切换统一由此处驱动
        // 立即停止旧角色的音频播放，防止切换后还听到旧角色的声音
        audio.clearAudioQueue();
        dispatchVrmBehavior({ type: 'character_switch_start' });
        setIsChatForceCollapsed(true);
        setCharacterLoading(true);
        isSwitchingCharacterRef.current = true;
        setCurrentCatgirl(result.characterName);
        // 角色切换时重置 text session 状态，确保下次发送消息时重新初始化 session
        setIsTextSessionActive(false);
        await setConfig({ ...config, characterName: result.characterName });
        await syncCharacterModel(result.characterName);

        // 如果 config.characterName 已经等于新角色名，useAudio effect 不会重新运行
        // 需要手动发送 start_session 并完成切换
        if (!needsReconnect) {
          console.log('📤 [catgirl_switched] config 未变化，手动完成切换');
          // 清除 handleSwitchCharacter 设置的超时 timer
          if (characterLoadingTimerRef.current) {
            clearTimeout(characterLoadingTimerRef.current);
            characterLoadingTimerRef.current = null;
          }
          // 直接发送 start_session
          audio.sendMessage({
            action: 'start_session',
            input_type: 'text',
            audio_format: 'PCM_48000HZ_MONO_16BIT',
            new_session: false,
          });
          // 立即完成切换
          isSwitchingCharacterRef.current = false;
          setCharacterLoading(false);
          setIsChatForceCollapsed(false);
          // 清除之前的错误提示（如果有）
          setSwitchError(null);
          if (switchErrorTimerRef.current) {
            clearTimeout(switchErrorTimerRef.current);
            switchErrorTimerRef.current = null;
          }
          setSwitchedCharacterName(result.characterName);
          if (switchedNameTimerRef.current) clearTimeout(switchedNameTimerRef.current);
          switchedNameTimerRef.current = setTimeout(() => setSwitchedCharacterName(null), 2500);
          dispatchVrmBehavior({ type: 'character_switch_done' });
          return;
        }

        // 竞态保护：syncCharacterModel 期间 onConnectionChange(true) 可能已经完成切换
        // 此时 isSwitchingCharacterRef 已被重置为 false，无需再设超时
        if (!isSwitchingCharacterRef.current) {
          console.log('✅ [catgirl_switched] 切换已在 syncCharacterModel 期间完成，跳过超时设置');
          return;
        }

        // 超时保护：15 秒内若未收到 onConnectionChange(true)，自动解除所有切换状态
        // 仅在 timer 未设置时才设置，避免覆盖 handleSwitchCharacter 设置的 timer
        if (!characterLoadingTimerRef.current) {
          characterLoadingTimerRef.current = setTimeout(() => {
            setCharacterLoading(false);
            setIsChatForceCollapsed(false);
            isSwitchingCharacterRef.current = false;
            characterLoadingTimerRef.current = null;
            setSwitchError('连接超时，角色切换失败');
            dispatchVrmBehavior({ type: 'status_error' });
            if (switchErrorTimerRef.current) clearTimeout(switchErrorTimerRef.current);
            switchErrorTimerRef.current = setTimeout(() => setSwitchError(null), 3000);
          }, 15000);
        }
      }
    },
    onConnectionChange: (connected) => {
      sessionStore.set(connected);
      if (connected) {
        dispatchVrmBehavior({ type: 'connection_ready' });
        // 连接成功，显示 Toast 提示
        if (wasInBackgroundRef.current) {
          // 从后台恢复后的重连
          statusToastRef.current?.show('已恢复连接', 2000);
        } else if (!isSwitchingCharacterRef.current) {
          // 普通连接成功（非角色切换）
          statusToastRef.current?.show('已连接到服务器', 2000);
        }
        if (isSwitchingCharacterRef.current) {
          // 发送 start_session 以重新加载角色音色
          console.log('📤 发送 start_session 以重新加载角色音色');
          audio.sendMessage({
            action: 'start_session',
            input_type: 'text',
            audio_format: 'PCM_48000HZ_MONO_16BIT',
            new_session: false,
            language: i18nInstance?.language?.substring(0, 5) || 'zh-CN',
          });
          console.log('✅ start_session 已调用');

          // 立即重置角色切换标志，避免后续消息重复触发超时
          isSwitchingCharacterRef.current = false;
          console.log('🔄 角色切换标志已重置');
          setCharacterLoading(false);
          setIsChatForceCollapsed(false);
          // 清除超时保护 timer
          if (characterLoadingTimerRef.current) {
            clearTimeout(characterLoadingTimerRef.current);
            characterLoadingTimerRef.current = null;
          }
          // 清除之前的错误提示（如果有）
          setSwitchError(null);
          if (switchErrorTimerRef.current) {
            clearTimeout(switchErrorTimerRef.current);
            switchErrorTimerRef.current = null;
          }
          const name = currentCatgirlRef.current;
          setSwitchedCharacterName(name);
          if (switchedNameTimerRef.current) clearTimeout(switchedNameTimerRef.current);
          switchedNameTimerRef.current = setTimeout(() => setSwitchedCharacterName(null), 2500);
          dispatchVrmBehavior({ type: 'character_switch_done' });
        }
      } else {
        dispatchVrmBehavior({ type: 'connection_lost' });
        // 连接断开，显示 Toast 提示（仅在非后台状态下显示）
        if (!isInBackgroundRef.current) {
          statusToastRef.current?.show('连接已断开，正在尝试重连...', 3000);
        }
        // 连接断开时重置 text session 状态
        setIsTextSessionActive(false);
        activeSessionModeRef.current = null;
      }
    }
  });

  // 同步 reconnect 和连接状态到 ref，供 AppState 前台恢复时使用
  audioReconnectRef.current = audio.reconnect;
  audioConnectedRef.current = audio.isConnectedRef.current;

  // 摄像头流式 hook
  const cameraStream = useCameraStream({
    sendMessage: audio.sendMessage,
    isConnected: audio.isConnected,
    isInBackgroundRef,
    onFrameSent: () => {
      dispatchVrmBehavior({ type: 'vision_stream_frame' });
    },
  });

  const previousCameraStreamStatusRef = useRef(cameraStream.status);
  useEffect(() => {
    const previousStatus = previousCameraStreamStatusRef.current;
    const nextStatus = cameraStream.status;
    if (previousStatus === nextStatus) return;
    previousCameraStreamStatusRef.current = nextStatus;

    setIsVrmVisionMode(nextStatus === 'streaming' || nextStatus === 'paused');

    if (nextStatus === 'streaming') {
      dispatchVrmBehavior({ type: 'vision_stream_started' });
    } else if (nextStatus === 'paused') {
      dispatchVrmBehavior({ type: 'vision_stream_paused' });
    } else if (nextStatus === 'idle' && (previousStatus === 'streaming' || previousStatus === 'paused')) {
      dispatchVrmBehavior({ type: 'vision_stream_stopped' });
    } else if (nextStatus === 'error') {
      dispatchVrmBehavior({ type: 'vision_failed' });
    }
  }, [cameraStream.status, dispatchVrmBehavior]);

  // 拍照和实时视觉共用相机资源；如果实时摄像头正在运行，先释放它再拉起系统相机。
  const handleTakePhoto = useCallback(async () => {
    dispatchVrmBehavior({ type: 'vision_capture_requested' });
    if (cameraStream.isStreaming) {
      console.log('📸 拍照前先暂停实时摄像头，避免相机资源冲突');
      cameraStream.stopStreaming();
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    await camera.takePhoto();
  }, [camera, cameraStream.isStreaming, cameraStream.stopStreaming, dispatchVrmBehavior]);

  // 监听摄像头流错误
  useEffect(() => {
    if (cameraStream.error) {
      dispatchVrmBehavior({ type: 'vision_failed' });
      statusToastRef.current?.show(`摄像头错误: ${cameraStream.error}`, 3000);
    }
  }, [cameraStream.error, dispatchVrmBehavior]);

  const mobileRuntime = useMemo<{
    phase: MobileRuntimePhase;
    chatStatus: ConnectionStatus;
    label: string;
    detail: string;
    canRetry: boolean;
    canRescan: boolean;
  }>(() => {
    if (!isConfigLoaded) {
      return {
        phase: 'idle',
        chatStatus: 'idle',
        label: '正在读取连接配置',
        detail: '',
        canRetry: false,
        canRescan: false,
      };
    }

    if (p2pConfig?.token) {
      if (udpConnection.status === 'idle' || udpConnection.status === 'connecting') {
        return {
          phase: 'connecting',
          chatStatus: 'connecting',
          label: '正在连接电脑端',
          detail: '正在确认二维码里的局域网地址。',
          canRetry: false,
          canRescan: false,
        };
      }

      if (udpConnection.status === 'failed') {
        return {
          phase: 'failed',
          chatStatus: 'closed',
          label: '无法连接电脑端',
          detail: '请确认电脑端在线、手机和电脑在同一网络，或重新扫码。',
          canRetry: true,
          canRescan: true,
        };
      }
    }

    if (audio.connectionPhase === 'connected') {
      return {
        phase: 'connected',
        chatStatus: 'open',
        label: '已连接',
        detail: '',
        canRetry: false,
        canRescan: false,
      };
    }

    if (audio.connectionPhase === 'connecting') {
      return {
        phase: 'connecting',
        chatStatus: 'connecting',
        label: '连接中',
        detail: '',
        canRetry: false,
        canRescan: false,
      };
    }

    if (audio.connectionPhase === 'reconnecting') {
      return {
        phase: 'reconnecting',
        chatStatus: 'reconnecting',
        label: '正在重连',
        detail: audio.connectionError || '网络切换或电脑端短暂不可用，正在尝试恢复。',
        canRetry: true,
        canRescan: !!p2pConfig?.token,
      };
    }

    if (audio.connectionPhase === 'failed') {
      return {
        phase: 'failed',
        chatStatus: 'closed',
        label: '连接失败',
        detail: audio.connectionError || '请确认后端已启动，或重新扫码。',
        canRetry: true,
        canRescan: !!p2pConfig?.token,
      };
    }

    return {
      phase: 'disconnected',
      chatStatus: 'closed',
      label: '未连接',
      detail: '请扫码或检查服务器配置。',
      canRetry: true,
      canRescan: true,
    };
  }, [
    audio.connectionError,
    audio.connectionPhase,
    isConfigLoaded,
    p2pConfig?.token,
    udpConnection.status,
  ]);

  const handleRetryConnection = useCallback(async () => {
    const pairingRefreshed = p2pConfig?.pairing ? await refreshPairing() : false;
    if (pairingRefreshed) {
      if (udpConnection.status === 'failed') {
        udpConnection.retry();
      }
      statusToastRef.current?.show('已刷新配对，正在重新连接...', 2000);
      return;
    }
    if (p2pConfig?.token && udpConnection.status === 'failed') {
      udpConnection.retry();
    } else {
      audio.reconnect();
    }
    statusToastRef.current?.show('正在重新连接...', 2000);
  }, [audio.reconnect, p2pConfig?.pairing, p2pConfig?.token, refreshPairing, udpConnection.retry, udpConnection.status]);

  const handleRescanConnection = useCallback(() => {
    router.push({ pathname: '/qr-scanner', params: { returnTo: '/(tabs)/main' } });
  }, [router]);

  const connectionStatus: ConnectionStatus = isSwitchingCharacterRef.current
    ? 'open'
    : mobileRuntime.chatStatus;

  const live2d = useLive2D({
    modelName: live2dModel.name,
    modelUrl: live2dModel.url,
    modelItemId: live2dModel.itemId,
    backendHost: config.host,
    backendPort: config.port,
    // 由页面 focus 生命周期触发加载；避免 autoLoad + focus 双重触发导致重复加载
    autoLoad: false,
    // TODO: 集成 preferences repository 到 useLive2D hook
    // 这需要修改 useLive2D 以支持持久化
  });

  // 口型同步（attack/release 平滑 + 非线性响应曲线）
  const lipSync = useLipSync({
    minAmplitude: 0.008,    // 噪声门限
    amplitudeScale: 1.0,    // 整体灵敏度
    attackMs: 25,           // 张嘴速度（快）
    releaseMs: 90,          // 闭嘴速度（慢，更自然）
    curvePower: 0.55,       // 非线性曲线（<1 放大轻声）
    autoStart: false,
  });

  useFocusEffect(
    useCallback(() => {
      setIsPageFocused(true);

      if (avatarModelTypeRef.current === 'live2d' && live2dModelRef.current.url) {
        live2d.loadModel();
      }

      return () => {
        lipSync.stop();
        setIsPageFocused(false);
      };
    }, [live2d.loadModel, lipSync.stop])
  );

  // 角色切换后 modelUrl 变化时，页面已聚焦无法靠 useFocusEffect 触发，需单独监听
  // 注意：live2dModel 变化时 useLive2D 已因 modelUrl 变化重建 service（新 service 天然干净）
  // 不需要 unloadModel，直接 loadModel 即可；用 ref 确保拿到新 service 的最新引用
  const loadModelRef = useRef(live2d.loadModel);
  loadModelRef.current = live2d.loadModel;
  useEffect(() => {
    if (avatarModelType !== 'live2d' || !isPageFocused || !live2dModel.url) return;
    const timer = setTimeout(() => {
      loadModelRef.current();
    }, 0);
    return () => clearTimeout(timer);
  }, [avatarModelType, isPageFocused, live2dModel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (avatarModelType !== 'vrm') return;
    live2d.unloadModel();
    lipSync.stop();
  }, [avatarModelType, live2d.unloadModel, lipSync.stop]);

  // ===== 初始化 MainManager =====
  useEffect(() => {
    console.log('🚀 主界面初始化');

    mainManager.init();

    if (audio.audioService) {
      mainManager.registerAudioService(audio.audioService);
    }

    if (avatarModelType === 'live2d' && live2d.live2dService) {
      mainManager.registerLive2DService(live2d.live2dService);
    } else if (avatarModelType === 'vrm') {
      mainManager.clearLive2DService();
    }

    return () => {
      console.log('🧹 主界面清理');
    };
  }, [audio.audioService, avatarModelType, live2d.live2dService]);

  useEffect(() => {
    console.log('live2d.live2dProps', live2d.live2dProps);
  }, [live2d.live2dProps]);

  useEffect(() => {
    console.log('live2d.modelState', live2d.modelState);
  }, [live2d.modelState]);

  // 监听模型状态，自动启动/停止口型同步
  useEffect(() => {
    const jsReady = live2d.modelState.isReady && !!live2d.modelState.path;
    const nativeReady = live2d.isNativeModelLoaded;
    const shouldRun = avatarModelType === 'live2d' && isPageFocused && jsReady && nativeReady;

    if (shouldRun) {
      if (!lipSync.isActive) {
        console.log('✅ Live2D JS/Native 已就绪，启动口型同步');
        lipSync.start();
        console.log('👄 口型同步已启动');
      }
      return;
    }

    if (lipSync.isActive) {
      console.log('⏹️ Live2D 未就绪或页面失焦，停止口型同步');
      lipSync.stop();
      console.log('👄 口型同步已停止');
    }
  }, [
    isPageFocused,
    avatarModelType,
    live2d.modelState.isReady,
    live2d.modelState.path,
    live2d.isNativeModelLoaded,
    lipSync.isActive,
    lipSync.start,
    lipSync.stop,
  ]);

  const handleLoadModel = useCallback(() => {
    live2d.loadModel();
  }, [live2d.loadModel]);

  const handleRecordingToggle = useCallback(() => {
    mainManager.toggleRecording();
  }, []);

  const handleLive2DTap = useCallback(() => {
    if (avatarModelTypeRef.current === 'vrm') {
      dispatchVrmBehavior({ type: 'tap' });
      return;
    }

    mainManager.onLive2DTap();
  }, [dispatchVrmBehavior]);

  const handleVrmPhase = useCallback((_phase: VRMRenderPhase) => {}, []);

  const handleVrmError = useCallback((message: string | null) => {
    if (!message) return;
    console.warn('🎨 [VRM] render error:', message);
    dispatchVrmBehavior({ type: 'status_error' });
    statusToastRef.current?.show(t('main.vrm.failed'), 3000);
  }, [dispatchVrmBehavior, t]);

  // Live2D 模型位置/缩放 ref（传给 Live2DStage）
  const currentModelPositionRef = useRef({ x: 0, y: 0 });
  const currentScaleRef = useRef<number>(0.8);
  const [isAdjustingModel, setIsAdjustingModel] = useState(false);
  const [avatarTransformRevision, setAvatarTransformRevision] = useState(0);

  useEffect(() => {
    if (avatarModelType !== 'vrm' || !vrmModelUrl) return;
    let cancelled = false;

    preferencesRepository.load(vrmModelUrl)
      .then((snapshot) => {
        if (cancelled) return;

        const position = snapshot?.position;
        const scale = snapshot?.scale;
        currentModelPositionRef.current = (
          position &&
          Number.isFinite(position.x) &&
          Number.isFinite(position.y)
        )
          ? { x: position.x, y: position.y }
          : { x: 0, y: 0 };
        currentScaleRef.current = (
          scale &&
          Number.isFinite(scale.x) &&
          scale.x > 0
        )
          ? scale.x
          : 0.8;
        setAvatarTransformRevision((revision) => revision + 1);
      })
      .catch((e) => {
        console.warn('[VRM] 加载模型位置偏好失败:', e);
      });

    return () => {
      cancelled = true;
    };
  }, [avatarModelType, preferencesRepository, vrmModelUrl]);

  const handleModelAdjustEnd = useCallback(() => {
    setIsAdjustingModel(false);

    if (avatarModelTypeRef.current !== 'vrm' || !vrmModelUrl) return;

    void preferencesRepository.save({
      modelUri: vrmModelUrl,
      position: { ...currentModelPositionRef.current },
      scale: { x: currentScaleRef.current, y: currentScaleRef.current },
    }).catch((e) => {
      console.warn('[VRM] 保存模型位置偏好失败:', e);
    });
  }, [preferencesRepository, vrmModelUrl]);

  // 工具栏事件处理（与 Web 版本一致）
  const handleToolbarSettingsChange = useCallback((id: Live2DSettingsToggleId, next: boolean) => {
    setToolbarSettings((prev) => ({ ...prev, [id]: next }));
    if (id === 'darkMode') {
      Appearance.setColorScheme(next ? 'dark' : 'light');
    }
  }, []);

  const handleToolbarAgentChange = useCallback((id: Live2DAgentToggleId, next: boolean) => {
    onAgentChange(id, next);
  }, [onAgentChange]);

  const handleToggleMic = useCallback(async (next: boolean) => {
    setToolbarMicEnabled(next);
    if (next) {
      setVoicePrepareStatus('preparing');
      try {
        await mainManager.startRecording();
        // 清除之前的错误提示（如果有）
        setSwitchError(null);
        if (switchErrorTimerRef.current) {
          clearTimeout(switchErrorTimerRef.current);
          switchErrorTimerRef.current = null;
        }
        setVoicePrepareStatus('ready');
        dispatchVrmBehavior({ type: 'voice_ready' });
        setTimeout(() => setVoicePrepareStatus(null), 800);
      } catch {
        setVoicePrepareStatus(null);
        setToolbarMicEnabled(false);
        dispatchVrmBehavior({ type: 'voice_failed' });
        // 显示与角色切换失败一致的底部错误横幅
        setSwitchError('语音系统准备失败');
        if (switchErrorTimerRef.current) clearTimeout(switchErrorTimerRef.current);
        switchErrorTimerRef.current = setTimeout(() => setSwitchError(null), 3000);
      }
    } else {
      mainManager.stopRecording();
      // 语音会话停止后，重置 text session 状态
      // 这样下次发送文本消息时会重新发送 start_session
      setIsTextSessionActive(false);
      dispatchVrmBehavior({ type: 'voice_stop' });
    }
  }, [dispatchVrmBehavior, mainManager]);

  const ensureRealtimeVisionSession = useCallback(async (): Promise<boolean> => {
    const getActiveSessionMode = (): 'text' | 'audio' | null => activeSessionModeRef.current;

    if (!audio.isConnected) {
      return false;
    }

    if (getActiveSessionMode() === 'audio' || audio.isRecording) {
      return true;
    }

    console.log('📤 为实时摄像头准备 audio session');
    dispatchVrmBehavior({ type: 'vision_preparing' });
    audio.sendMessage({
      action: 'start_session',
      input_type: 'audio',
      audio_format: 'PCM_48000HZ_MONO_16BIT',
      new_session: false,
    });

    const start = Date.now();
    const timeoutMs = 5000;
    while (Date.now() - start < timeoutMs) {
      if (getActiveSessionMode() === 'audio') {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.warn('⚠️ 实时摄像头切换 audio session 超时');
    return false;
  }, [audio.isConnected, audio.isRecording, audio.sendMessage, dispatchVrmBehavior]);

  const handleToggleCamera = useCallback(async (next: boolean) => {
    if (!next) {
      // 停止摄像头
      cameraStream.stopStreaming();
      dispatchVrmBehavior({ type: 'vision_stream_stopped' });
      setIsVrmVisionMode(false);
      statusToastRef.current?.show('已停止摄像头', 2000);
      return;
    }

    dispatchVrmBehavior({ type: 'vision_preparing' });
    // 先检查权限
    const hasPermission = await cameraStream.checkAndRequestPermission();
    if (!hasPermission) {
      dispatchVrmBehavior({ type: 'vision_failed' });
      return;
    }

    // 显示选择对话框
    const startCameraStream = async (selectedFacing: 'front' | 'back') => {
      statusToastRef.current?.show('正在准备实时视觉...', 2000);
      const sessionReady = await ensureRealtimeVisionSession();
      if (!sessionReady) {
        dispatchVrmBehavior({ type: 'vision_failed' });
        statusToastRef.current?.show('实时视觉会话准备失败', 3000);
        return;
      }

      cameraStream.startStreaming(selectedFacing);
      statusToastRef.current?.show(
        selectedFacing === 'front' ? '前置摄像头已开启' : '后置摄像头已开启',
        2000
      );
    };

    Alert.alert(
      '选择摄像头',
      '请选择要使用的摄像头',
      [
        {
          text: '前置摄像头',
          onPress: () => {
            void startCameraStream('front');
          },
        },
        {
          text: '后置摄像头',
          onPress: () => {
            void startCameraStream('back');
          },
        },
        {
          text: '取消',
          style: 'cancel',
        },
      ]
    );
  }, [cameraStream.startStreaming, cameraStream.stopStreaming, cameraStream.checkAndRequestPermission, dispatchVrmBehavior, ensureRealtimeVisionSession]);

  const handleGoodbye = useCallback(() => {
    // 如果麦克风正在录音，先停止
    if (toolbarMicEnabled) {
      mainManager.stopRecording();
      setToolbarMicEnabled(false);
      // 语音会话停止后，重置 text session 状态
      setIsTextSessionActive(false);
    }
    // 如果摄像头流正在运行，停止
    if (cameraStream.isStreaming) {
      cameraStream.stopStreaming();
      dispatchVrmBehavior({ type: 'vision_stream_stopped' });
      setIsVrmVisionMode(false);
    }
    setToolbarGoodbyeMode(true);
    setToolbarOpenPanel(null);
  }, [dispatchVrmBehavior, mainManager, toolbarMicEnabled, cameraStream.isStreaming, cameraStream.stopStreaming]);

  const handleReturn = useCallback(() => {
    setToolbarGoodbyeMode(false);
  }, []);

  const handleSettingsMenuClick = useCallback((id: string) => {
    if (id === 'characterManage') {
      const loadCharacters = async () => {
        try {
          setCharacterLoading(true);
          const apiBase = buildHttpBaseURL(config);
          const client = createCharactersApiClient(apiBase, config.p2p?.token);
          const data: CharactersData = await client.getCharacters();

          const names = Object.keys(data.猫娘 || {});
          if (names.length === 0) {
            Alert.alert(t('characterManager.title'), t('characterManager.empty'));
            return;
          }

          setCharacterList(names);
          setCurrentCatgirl(data.当前猫娘 || null);
          setToolbarOpenPanel(null);
          setCharacterModalVisible(true);
        } catch (err: any) {
          Alert.alert(t('characterManager.title'), err.message || t('connection.errors.networkError'));
        } finally {
          setCharacterLoading(false);
        }
      };
      loadCharacters();
      return;
    }
    if (id === 'reload') {
      setToolbarOpenPanel(null);

      const doReload = async () => {
        try {
          // 1. 如果正在录音，先停止
          if (toolbarMicEnabled) {
            mainManager.stopRecording();
            setToolbarMicEnabled(false);
            setIsTextSessionActive(false);
          }

          // 2. 清空聊天记录
          chat.clearMessages();

          // 3. 重连 WebSocket
          audio.reconnect();

          // 4. 重新加载角色 + Live2D 模型
          const apiBase = buildHttpBaseURL(config);
          const client = createCharactersApiClient(apiBase, config.p2p?.token);
          const res = await client.getCurrentCatgirl();
          if (res.current_catgirl) {
            setCurrentCatgirl(res.current_catgirl);
            if (config.characterName !== res.current_catgirl) {
              await setConfig({ ...config, characterName: res.current_catgirl });
            }
            await syncCharacterModel(res.current_catgirl);
          }

          statusToastRef.current?.show('重新加载完成', 2000);
        } catch (e: any) {
          console.warn('❌ 重新加载失败:', e);
          statusToastRef.current?.show('重新加载失败: ' + (e.message || '未知错误'), 3000);
        }
      };
      doReload();
      return;
    }
    if (id === 'connectionHelp') {
      Alert.alert(
        '连接帮助',
        '如果手机无法连接电脑，可能是网络环境限制（Symmetric NAT）。\n\n' +
        '解决方法：在电脑端安装内网穿透工具：\n' +
        '• cpolar（推荐）: cpolar.com\n' +
        '• natapp: natapp.cn\n\n' +
        '安装后将本地端口 48920 映射到公网，用获取的公网地址重新扫码连接。'
      );
      return;
    }

    if (id === 'chatFont') {
      const currentLabel = FONT_OPTIONS.find(f => f.id === chatFontId)?.label ?? '系统默认';
      const buttons: Array<{ text: string; onPress?: () => void; style?: 'cancel' }> =
        FONT_OPTIONS.map(f => ({
          text: f.label + (f.id === chatFontId ? ' ✓' : ''),
          onPress: () => setChatFontId(f.id),
        }));
      buttons.push({ text: t('common.cancel') as string, style: 'cancel' });
      Alert.alert('聊天字体', `当前: ${currentLabel}`, buttons);
      return;
    }

    Alert.alert(t('common.alert'), `即将打开: ${id}`);
  }, [config, toolbarMicEnabled, mainManager, chat, audio, syncCharacterModel, chatFontId, setChatFontId, t]);

  const handleSwitchCharacter = useCallback(async (name: string) => {
    // 检查是否在语音模式
    if (toolbarMicEnabled) {
      setVoiceBlockModalVisible(true);
      return;
    }

    try {
      setCharacterLoading(true);
      const apiBase = buildHttpBaseURL(config);
      const client = createCharactersApiClient(apiBase, config.p2p?.token);
      const res = await client.setCurrentCatgirl(name);

      if (res.success) {
        setCharacterModalVisible(false);
        // 立即置为切换中，屏蔽切换期间的 WebSocket 错误（不等服务端广播）
        isSwitchingCharacterRef.current = true;
        // UI 更新由服务端广播的 catgirl_switched 消息统一驱动
        // 超时保护：15 秒内若未收到 onConnectionChange(true)，自动解除所有切换状态
        if (characterLoadingTimerRef.current) clearTimeout(characterLoadingTimerRef.current);
        characterLoadingTimerRef.current = setTimeout(() => {
          setCharacterLoading(false);
          setIsChatForceCollapsed(false);
          isSwitchingCharacterRef.current = false;
          characterLoadingTimerRef.current = null;
          setSwitchError('连接超时，角色切换失败');
          if (switchErrorTimerRef.current) clearTimeout(switchErrorTimerRef.current);
          switchErrorTimerRef.current = setTimeout(() => setSwitchError(null), 3000);
        }, 15000);
      } else {
        setCharacterLoading(false);
        Alert.alert(t('main.character.switchError'), res.error || t('common.error'));
      }
    } catch (err: any) {
      setCharacterLoading(false);
      Alert.alert(t('main.character.switchError'), err.message || t('connection.errors.networkError'));
    }
  }, [config, toolbarMicEnabled]);

  // 确保 text session 已启动（与 Web 端一致的 Legacy 协议）
  const ensureTextSession = useCallback(async (): Promise<boolean> => {
    // 如果已经有活跃的 text session，直接返回
    if (isTextSessionActive) {
      return true;
    }

    if (!audio.isConnected) {
      return false;
    }

    // 连续摄像头需要 realtime/audio session；切回文本前先暂停它，避免图片堆进文本会话队列。
    if (cameraStream.isStreaming) {
      console.log('📹 切换到文本会话，先暂停实时摄像头');
      cameraStream.stopStreaming();
      dispatchVrmBehavior({ type: 'vision_stream_stopped' });
      setIsVrmVisionMode(false);
      statusToastRef.current?.show('发送文本时已暂停实时摄像头', 2500);
    }

    // 如果当前正在录音（语音模式），先停止录音并等待服务端清理旧 session，
    // 避免 start_session(text) 与正在启动/活跃的 audio session 产生竞态
    if (audio.isRecording) {
      console.log('🔄 检测到正在录音，先停止录音再切换到文本模式');
      await audio.toggleRecording();
      // 给服务端一点时间完成 end_session 清理
      await new Promise(r => setTimeout(r, 500));
      // 500ms 等待后重检：若用户在此期间重新开始录音，则放弃本次文本发送
      if (audio.isRecording) {
        console.log('⚠️ 等待期间用户重新开始录音，放弃 text session');
        return false;
      }
    }

    // 如果已经有一个正在进行的 session 请求，复用该 Promise
    // 这样并发调用会共享同一个 Promise，避免 resolver 被覆盖导致早期 Promise 永不 resolve
    if (pendingSessionPromiseRef.current) {
      return pendingSessionPromiseRef.current;
    }

    const promise = new Promise<boolean>((resolve) => {
      // 清除任何现有的超时
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
        sessionTimeoutRef.current = null;
      }

      // 设置 resolver
      sessionStartedResolverRef.current = resolve;

      // 发送 start_session（Legacy 协议）
      console.log('📤 发送 start_session(input_type: text, audio_format: PCM_48000HZ_MONO_16BIT)');
      audio.sendMessage({
        action: 'start_session',
        input_type: 'text',
        audio_format: 'PCM_48000HZ_MONO_16BIT',
        new_session: false,
      });

      // 15 秒超时
      sessionTimeoutRef.current = setTimeout(() => {
        if (sessionStartedResolverRef.current === resolve) {
          sessionStartedResolverRef.current = null;
          pendingSessionPromiseRef.current = null;
          console.log('⏰ start_session 超时');
          resolve(false);
        }
        sessionTimeoutRef.current = null;
      }, 15000);
    });

    pendingSessionPromiseRef.current = promise;
    return promise;
  }, [isTextSessionActive, audio.isConnected, audio.isRecording, audio.sendMessage, audio.toggleRecording, cameraStream.isStreaming, cameraStream.stopStreaming, dispatchVrmBehavior]);

  // 图片消息服务
  const imageMessageService = useMemo(() => new ImageMessageService(), []);

  // 处理用户发送消息（文本 + 可选图片）
  // 使用 stream_data action 和 clientMessageId 与 N.E.K.O 协议一致
  const handleSendMessage = useCallback(async (text: string, images?: string[]) => {
    if (!audio.isConnected) {
      dispatchVrmBehavior({ type: 'connection_lost' });
      statusToastRef.current?.show(t('connection.status.disconnected'), 3000);
      return;
    }

    dispatchVrmBehavior({ type: 'user_message_sent' });

    // 确保 text session 已启动（与 Web 端一致）
    const sessionOk = await ensureTextSession();
    if (!sessionOk) {
      dispatchVrmBehavior({ type: 'session_failed' });
      statusToastRef.current?.show(t('connection.status.reconnecting'), 3000);
      return;
    }

    // 合并图片来源：
    // 1. imagePicker.images - 相册选择的图片（expo-image-picker 返回的 base64）
    // 2. images 参数 - ChatContainer 传入的 pendingScreenshots（相机拍照的 base64）
    const imagesToSend: string[] = [];

    // 处理相册选择的图片（直接使用 base64，不再重新压缩）
    if (imagePicker.images.length > 0) {
      console.log('🖼️ 处理相册图片...');
      for (const img of imagePicker.images) {
        // expo-image-picker 返回的 base64 是纯 base64，需要添加 data URI 前缀
        const mimeType = img.mimeType || 'image/jpeg';
        const base64WithPrefix = img.base64.startsWith('data:')
          ? img.base64
          : `data:${mimeType};base64,${img.base64}`;
        imagesToSend.push(base64WithPrefix);
      }
      console.log(`✅ 相册图片处理完成：${imagePicker.images.length} 张`);
    }

    // 处理传入的图片（相机拍照的，已经是 base64 格式）
    if (images && images.length > 0) {
      console.log('📸 处理相机图片...');
      for (const img of images) {
        // 传入的图片可能已经有前缀，也可能没有
        const base64WithPrefix = img.startsWith('data:')
          ? img
          : `data:image/jpeg;base64,${img}`;
        imagesToSend.push(base64WithPrefix);
      }
      console.log(`✅ 相机图片处理完成：${images.length} 张`);
    }

    // 发送图片
    if (imagesToSend.length > 0) {
      dispatchVrmBehavior({ type: 'vision_image_sent' });
      for (const rawBase64 of imagesToSend) {
        messageCounterRef.current += 1;
        const clientMessageId = generateMessageId();
        sentClientMessageIds.current.set(clientMessageId, Date.now());

        const imgBase64 = await compressImageIfNeeded(rawBase64);

        audio.sendMessage({
          action: 'stream_data',
          data: imgBase64,
          input_type: 'camera',
          clientMessageId,
        });
      }
      // 每张图片作为独立消息显示（保留 data: 前缀供 Image 组件使用）
      for (const imgBase64 of imagesToSend) {
        chat.addMessage(`📷 照片`, 'user', { image: imgBase64 });
      }
    }

    // 再发送文本
    if (text.trim()) {
      messageCounterRef.current += 1;
      const clientMessageId = generateMessageId();
      sentClientMessageIds.current.set(clientMessageId, Date.now());

      // 添加用户消息到 UI
      chat.addMessage(text, 'user');

      // 通过 WS 发送到后端（使用 stream_data action，与 N.E.K.O 协议一致）
      audio.sendMessage({
        action: 'stream_data',
        data: text.trim(),
        input_type: 'text',
        clientMessageId,
      });

      console.log('📤 发送文本消息:', text.substring(0, 50));
    }

    // 清除已选图片
    imagePicker.clearImages();
    setCameraPendingImages([]);
  }, [audio.isConnected, audio.sendMessage, chat.addMessage, dispatchVrmBehavior, ensureTextSession, imagePicker, imageMessageService, setCameraPendingImages, t]);

  // 检测屏幕尺寸变化
  useEffect(() => {
    const updateIsMobile = () => {
      const { width, height } = Dimensions.get('window');
      setIsMobile(width <= 768);
      setScreenHeight(height);
    };

    updateIsMobile();
    const subscription = Dimensions.addEventListener('change', updateIsMobile);
    
    return () => {
      subscription?.remove();
    };
  }, []);

  // 清理切换相关 timer，防止组件卸载后 setState
  useEffect(() => {
    return () => {
      if (switchedNameTimerRef.current) clearTimeout(switchedNameTimerRef.current);
      if (switchErrorTimerRef.current) clearTimeout(switchErrorTimerRef.current);
      if (characterLoadingTimerRef.current) clearTimeout(characterLoadingTimerRef.current);
    };
  }, []);

  // 显示 Agent 状态（调试用）
  useEffect(() => {
    console.log('🤖 Agent 状态:', agent.statusText, {
      master: agent.master,
      keyboard: agent.keyboard,
      mcp: agent.mcp,
      userPlugin: agent.userPlugin,
    });
  }, [agent]);

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: cc.page },
    live2dWrapper: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
    bottomSection: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
    topBar: {
      position: 'absolute', top: 0, left: 0, right: 72, zIndex: 200,
      alignItems: 'flex-start',
      paddingLeft: 16, paddingTop: insets.top + 8,
    },
    connectionChip: {
      maxWidth: '100%',
      minHeight: 34,
      borderRadius: 16,
      backgroundColor: 'rgba(15, 23, 42, 0.72)',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.12)',
      paddingHorizontal: 12,
      paddingVertical: 8,
    },
    connectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    connectionTitle: { fontSize: 13, fontWeight: '600', color: cc.textOnAccent, flexShrink: 1 },
    connectionDetail: { marginTop: 4, fontSize: 12, color: 'rgba(255,255,255,0.78)', lineHeight: 16 },
    connectionActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
    connectionActionButton: {
      minHeight: 28,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: 'rgba(255,255,255,0.14)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    connectionActionText: { color: cc.textOnAccent, fontSize: 12, fontWeight: '600' },
  }), [cc, insets.top]);

  // Wrap send to auto-expand chat
  const handleSendAndExpand = useCallback(async (text: string, images?: string[]) => {
    setChatExpanded(true);
    await handleSendMessage(text, images);
  }, [handleSendMessage]);

  return (
    <View style={s.container}>
      <StatusToast ref={statusToastRef} />

      {/* Live2D always full screen — never resizes */}
      <View style={s.live2dWrapper}>
        <Live2DStage
          isPageFocused={isPageFocused}
          isAdjustingModel={isAdjustingModel}
          avatarType={avatarModelType}
          vrmModelUrl={vrmModelUrl}
          vrmLighting={vrmLighting}
          vrmMotionCalibration={vrmMotionCalibration}
          vrmEmotion={vrmEmotion}
          vrmGesture={vrmGesture}
          vrmGestureRevision={vrmGestureRevision}
          transformRevision={avatarTransformRevision}
          live2dPropsForLipSync={live2d.live2dPropsForLipSync}
          live2dProps={live2d.live2dProps}
          onTap={handleLive2DTap}
          onVrmPhase={handleVrmPhase}
          onVrmError={handleVrmError}
          setModelScale={live2d.setModelScale}
          setModelPosition={live2d.setModelPosition}
          onAdjustStart={() => setIsAdjustingModel(true)}
          onAdjustEnd={handleModelAdjustEnd}
          modelPositionRef={currentModelPositionRef}
          scaleRef={currentScaleRef}
        />
      </View>

      {/* Top bar (overlays Live2D) */}
      <View style={s.topBar} pointerEvents="box-none">
        <View pointerEvents="auto" style={s.connectionChip}>
          <View style={s.connectionHeader}>
            <View style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: mobileRuntime.chatStatus === 'open'
                ? cc.success
                : mobileRuntime.chatStatus === 'connecting' || mobileRuntime.chatStatus === 'reconnecting'
                  ? cc.warning
                  : cc.error,
            }} />
            <Text numberOfLines={1} style={s.connectionTitle}>
              {config.characterName || 'N.E.K.O.'} · {mobileRuntime.label}
            </Text>
          </View>
          {!!mobileRuntime.detail && mobileRuntime.phase !== 'connected' && (
            <Text numberOfLines={2} style={s.connectionDetail}>{mobileRuntime.detail}</Text>
          )}
          {(mobileRuntime.canRetry || mobileRuntime.canRescan) && (
            <View style={s.connectionActions}>
              {mobileRuntime.canRetry && (
                <Pressable style={s.connectionActionButton} onPress={handleRetryConnection}>
                  <Text style={s.connectionActionText}>重试</Text>
                </Pressable>
              )}
              {mobileRuntime.canRescan && (
                <Pressable style={s.connectionActionButton} onPress={handleRescanConnection}>
                  <Text style={s.connectionActionText}>重新扫码</Text>
                </Pressable>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Toolbar — floating buttons on the right side */}
      <Live2DRightToolbar
        visible
        isMobile={isMobile}
        right={8}
        top={insets.top + 8}
        micEnabled={toolbarMicEnabled}
        cameraEnabled={cameraStream.isStreaming}
        goodbyeMode={toolbarGoodbyeMode}
        openPanel={toolbarOpenPanel}
        onOpenPanelChange={setToolbarOpenPanel}
        settings={toolbarSettings}
        onSettingsChange={handleToolbarSettingsChange}
        agent={agent}
        onAgentChange={handleToolbarAgentChange}
        onToggleMic={handleToggleMic}
        onToggleCamera={handleToggleCamera}
        onGoodbye={handleGoodbye}
        onReturn={handleReturn}
        onSettingsMenuClick={handleSettingsMenuClick}
      />

      {cameraStream.shouldMount && cameraStream.hasPermission && (
        <CameraView
          ref={cameraStream.cameraRef}
          style={{ position: 'absolute', left: -9999, top: -9999, width: 1, height: 1, opacity: 0 }}
          facing={cameraStream.facing}
          onCameraReady={cameraStream.onCameraReady}
          animateShutter={false}
        />
      )}

      {/* Bottom section — floats above Live2D, keyboard-aware */}
      <KeyboardAvoidingView behavior="padding" style={s.bottomSection}>
        <ChatContainer
          externalMessages={chat.messages}
          connectionStatus={connectionStatus}
          statusText={mobileRuntime.label}
          onSendMessage={handleSendAndExpand}
          disabled={!audio.isConnected}
          forceCollapsed={isChatForceCollapsed}
          onPickImage={imagePicker.pickImages}
          onTakePhoto={handleTakePhoto}
          cameraEnabled={true}
          externalPendingImages={[
            ...imagePicker.images.map((img, index) => ({
              id: `gallery-${Date.now()}-${index}`,
              base64: img.base64,
            })),
            ...cameraPendingImages,
          ]}
          onClearExternalPendingImages={() => {
            imagePicker.clearImages();
            setCameraPendingImages([]);
          }}
          chatExpanded={chatExpanded}
          onToggleChat={() => setChatExpanded(prev => !prev)}
        />
      </KeyboardAvoidingView>

      <VoicePrepareOverlay status={voicePrepareStatus} />

      <CharacterSelectionModal
        visible={characterModalVisible}
        characterList={characterList}
        currentCatgirl={currentCatgirl}
        loading={characterLoading}
        onSelect={handleSwitchCharacter}
        onClose={() => setCharacterModalVisible(false)}
      />

      <VoiceBlockModal
        visible={voiceBlockModalVisible}
        onClose={() => setVoiceBlockModalVisible(false)}
      />

      <CharacterSwitchOverlay
        loading={characterLoading}
        switchedName={switchedCharacterName}
        error={switchError}
      />
    </View>
  );
}

export default MainUIScreen;
