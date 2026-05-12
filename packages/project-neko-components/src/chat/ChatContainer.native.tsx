import React, { useEffect } from 'react';
import {
  View, Text, Modal, TouchableOpacity, ScrollView, TextInput,
  TouchableWithoutFeedback, Image, Alert, PermissionsAndroid, Platform, Keyboard, StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT, tOrDefault } from '../i18n';
import { useChatState, useSendMessage } from './hooks';
import MessageList from './MessageList.native';
import type { ChatMessage, ExternalChatMessage, ChatContainerProps, ConnectionStatus } from './types';

let HapticsImpact: ((style: number) => Promise<void>) | null = null;
try { HapticsImpact = require('expo-haptics').impactAsync; } catch { /* not linked */ }

let BlurView: React.ComponentType<{ intensity: number; tint: string; style: any; children?: React.ReactNode }> | null = null;
try { BlurView = require('expo-blur').BlurView; } catch { /* not linked */ }

function ensureDataURI(base64: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:image/jpeg;base64,${base64}`;
}

const MAX_SCREENSHOTS = 5;

const AVATAR_TOOLS = [
  { action: 'lollipop', icon: 'heart-outline' as const, label: 'Lollipop' },
  { action: 'fist', icon: 'hand-left-outline' as const, label: 'Fist' },
  { action: 'hammer', icon: 'hammer-outline' as const, label: 'Hammer' },
] as const;

function convertExternalMessage(msg: ExternalChatMessage): ChatMessage {
  const roleMap: Record<ExternalChatMessage['sender'], ChatMessage['role']> = {
    user: 'user', gemini: 'assistant', system: 'system',
  };
  const text = msg.text || '';
  const hasImage = !!msg.image;
  const blocks: import('./types').MessageBlock[] = [];
  if (text) blocks.push({ type: 'text', text });
  if (hasImage) blocks.push({ type: 'image', url: msg.image! });

  const base = {
    id: msg.id, role: roleMap[msg.sender],
    createdAt: new Date(msg.timestamp).getTime() || Date.now(),
    blocks,
    ...(msg.isStreaming ? { isStreaming: true } : {}),
  };
  if (hasImage) return { ...base, image: msg.image!, content: text || undefined };
  return { ...base, content: text };
}

function getStatusColor(status: ConnectionStatus): string {
  switch (status) {
    case 'open': return '#52c41a';
    case 'connecting': case 'reconnecting': case 'closing': return '#faad14';
    case 'closed': return '#ff4d4f';
    default: return '#d9d9d9';
  }
}

function getStatusText(status: ConnectionStatus, customText?: string, t?: any): string {
  if (customText) return customText;
  switch (status) {
    case 'open': return tOrDefault(t, 'chat.status.connected', '已连接');
    case 'connecting': return tOrDefault(t, 'chat.status.connecting', '连接中...');
    case 'reconnecting': return tOrDefault(t, 'chat.status.reconnecting', '重连中...');
    case 'closing': return tOrDefault(t, 'chat.status.closing', '断开中...');
    case 'closed': return tOrDefault(t, 'chat.status.disconnected', '已断开');
    default: return tOrDefault(t, 'chat.status.idle', '待连接');
  }
}

const s = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  panel: {
    height: '75%', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    overflow: 'hidden', backgroundColor: 'rgba(245,245,250,0.92)',
    borderColor: 'rgba(255,255,255,0.3)', borderWidth: 1, borderBottomWidth: 0,
  },
  header: {
    height: 52, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', paddingHorizontal: 16,
    borderBottomColor: 'rgba(0,0,0,0.06)', borderBottomWidth: 1,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#333' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 11, color: '#888' },
  closeButton: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.05)', justifyContent: 'center', alignItems: 'center',
  },
  toolRow: {
    flexDirection: 'row', justifyContent: 'center', gap: 16,
    paddingHorizontal: 16, paddingVertical: 8,
    borderTopColor: 'rgba(0,0,0,0.04)', borderTopWidth: 1,
  },
  toolButton: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: 'rgba(68,183,254,0.1)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(68,183,254,0.2)',
  },
  pendingSection: { paddingHorizontal: 12, paddingVertical: 8, borderTopColor: 'rgba(0,0,0,0.06)', borderTopWidth: 1 },
  pendingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  pendingText: { fontSize: 12, color: '#666' },
  clearText: { fontSize: 12, color: '#ff4d4f' },
  removeBadge: {
    position: 'absolute', top: -4, right: -4,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(255,77,79,0.9)', justifyContent: 'center', alignItems: 'center',
  },
  inputSection: {
    paddingHorizontal: 12, paddingTop: 10, paddingBottom: 20,
    borderTopColor: 'rgba(0,0,0,0.06)', borderTopWidth: 1,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.04)', borderRadius: 20,
    paddingHorizontal: 12, paddingVertical: 4,
  },
  textInput: { flex: 1, fontSize: 14, maxHeight: 80, paddingVertical: 6, color: '#333' },
  sendButton: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: '#44b7fe', justifyContent: 'center', alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#ddd' },
  floatingButton: {
    position: 'absolute', right: 16, bottom: 16,
    width: 56, height: 56, borderRadius: 28, backgroundColor: '#44b7fe',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#44b7fe', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
});

export default function ChatContainer({
  externalMessages, onSendMessage, onSendText,
  connectionStatus = 'idle', disabled = false, statusText,
  cameraEnabled = false, onPickImage, onTakePhoto: onTakePhotoProp,
  renderFloatingOverlay, forceCollapsed,
  externalPendingImages, onClearExternalPendingImages,
  onAvatarTool,
}: ChatContainerProps = {}) {
  const t = useT();
  const isControlled = externalMessages !== undefined;
  const sendHandler = onSendMessage || (onSendText ? (text: string) => onSendText(text) : undefined);

  const {
    collapsed, setCollapsed,
    messages: internalMessages, setMessages, addMessages,
    pendingScreenshots, setPendingScreenshots,
  } = useChatState();

  const [inputValue, setInputValue] = React.useState('');

  const displayMessages: ChatMessage[] = React.useMemo(() => {
    if (isControlled && externalMessages) return externalMessages.map(convertExternalMessage);
    return internalMessages;
  }, [isControlled, externalMessages, internalMessages]);

  useEffect(() => { if (forceCollapsed) setCollapsed(true); }, [forceCollapsed, setCollapsed]);

  useEffect(() => {
    if (externalPendingImages && externalPendingImages.length > 0) {
      setPendingScreenshots((prev) => [...prev, ...externalPendingImages].slice(0, MAX_SCREENSHOTS));
      onClearExternalPendingImages?.();
    }
  }, [externalPendingImages, onClearExternalPendingImages, setPendingScreenshots]);

  React.useEffect(() => {
    if (!isControlled && internalMessages.length === 0) {
      setMessages([{
        id: 'sys-1', role: 'system',
        content: tOrDefault(t, 'chat.welcome', '欢迎来到 N.E.K.O. Chat'),
        createdAt: Date.now(),
      }]);
    }
  }, [isControlled, internalMessages.length, setMessages, t]);

  const { handleSendText: internalHandleSendText } = useSendMessage(
    addMessages, pendingScreenshots, () => setPendingScreenshots([])
  );

  const handleSend = () => {
    if (disabled) return;
    const trimmed = inputValue.trim();
    const images = pendingScreenshots.map(p => p.base64);
    if (sendHandler) {
      if (trimmed.length === 0 && images.length === 0) return;
      if (onSendMessage) onSendMessage(trimmed, images.length > 0 ? images : undefined);
      else if (onSendText && trimmed.length > 0) onSendText(trimmed);
      setPendingScreenshots([]);
    } else {
      if (trimmed.length === 0 && pendingScreenshots.length === 0) return;
      internalHandleSendText(trimmed);
    }
    setInputValue('');
  };

  const handleTakePhoto = async () => {
    if (disabled) return;
    if (!cameraEnabled) {
      Alert.alert(tOrDefault(t, 'chat.camera.title', '相机功能'),
        tOrDefault(t, 'chat.camera.not_implemented', '相机功能需要 expo-image-picker。'),
        [{ text: tOrDefault(t, 'chat.camera.ok', '确定') }]);
      return;
    }
    if (pendingScreenshots.length >= MAX_SCREENSHOTS) {
      Alert.alert(tOrDefault(t, 'chat.screenshot.title', '拍照'), `最多只能添加 ${MAX_SCREENSHOTS} 张照片`);
      return;
    }
    if (onTakePhotoProp) { onTakePhotoProp(); return; }
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA, {
          title: tOrDefault(t, 'chat.camera.permission.title', '相机权限'),
          message: tOrDefault(t, 'chat.camera.permission.message', '需要相机权限来拍照'),
          buttonNeutral: tOrDefault(t, 'chat.camera.permission.later', '稍后'),
          buttonNegative: tOrDefault(t, 'chat.camera.permission.cancel', '取消'),
          buttonPositive: tOrDefault(t, 'chat.camera.permission.ok', '确定'),
        });
        if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(tOrDefault(t, 'chat.camera.permission.denied.title', '权限被拒绝'),
            tOrDefault(t, 'chat.camera.permission.denied.message', '无法访问相机，请在设置中允许相机权限'));
        }
      } catch (err) {
        console.warn('[ChatContainer] Camera permission error:', err);
      }
    }
  };

  const handleImageAction = () => {
    if (disabled) return;
    if (pendingScreenshots.length >= MAX_SCREENSHOTS) {
      Alert.alert(tOrDefault(t, 'chat.image.title', '图片'), `最多只能添加 ${MAX_SCREENSHOTS} 张图片`);
      return;
    }
    type AlertOption = { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void };
    const options: AlertOption[] = [];
    if (onPickImage) options.push({ text: tOrDefault(t, 'chat.image.gallery', '从相册选择'), onPress: () => onPickImage() });
    if (onTakePhotoProp) options.push({ text: tOrDefault(t, 'chat.image.camera', '拍照'), onPress: () => handleTakePhoto() });
    options.push({ text: tOrDefault(t, 'common.cancel', '取消'), style: 'cancel' });
    Alert.alert(tOrDefault(t, 'chat.image.title', '添加图片'), undefined, options);
  };

  const handleAvatarTool = (action: string) => {
    HapticsImpact?.(1);
    onAvatarTool?.(action);
  };

  // Keyboard: scroll to bottom when keyboard opens
  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {
      // FlatList inverted → offset 0 = visual bottom
      // onContentSizeChange in MessageList handles auto-scroll
    });
    return () => sub.remove();
  }, []);

  // ===== Collapsed =====
  if (collapsed) {
    return (
      <TouchableOpacity onPress={() => setCollapsed(false)} activeOpacity={0.8} style={s.floatingButton}>
        <Ionicons name="chatbubble-ellipses" size={24} color="#fff" />
      </TouchableOpacity>
    );
  }

  // ===== Expanded =====
  const panelContent = (
    <>
      {/* Header */}
      <View style={s.header}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={s.headerTitle}>{tOrDefault(t, 'chat.title', 'N.E.K.O. Chat')}</Text>
          {sendHandler && (
            <View style={s.statusRow}>
              <View style={[s.statusDot, { backgroundColor: getStatusColor(connectionStatus) }]} />
              <Text style={s.statusText}>{getStatusText(connectionStatus, statusText, t)}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setCollapsed(true)} activeOpacity={0.7} style={s.closeButton}>
          <Ionicons name="chevron-down" size={18} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Message list */}
      <View style={{ flex: 1 }}>
        <MessageList messages={displayMessages} />
      </View>

      {/* Avatar tools */}
      {onAvatarTool && (
        <View style={s.toolRow}>
          {AVATAR_TOOLS.map((tool) => (
            <TouchableOpacity key={tool.action} onPress={() => handleAvatarTool(tool.action)} activeOpacity={0.6} style={s.toolButton}>
              <Ionicons name={tool.icon} size={22} color="#44b7fe" />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Pending screenshots */}
      {pendingScreenshots.length > 0 && (
        <View style={s.pendingSection}>
          <View style={s.pendingRow}>
            <Text style={s.pendingText}>
              {tOrDefault(t, 'chat.screenshot.pending', `待发送照片 (${pendingScreenshots.length})`)}
            </Text>
            <TouchableOpacity onPress={() => setPendingScreenshots([])} activeOpacity={0.7}>
              <Text style={s.clearText}>{tOrDefault(t, 'chat.screenshot.clearAll', '清除全部')}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal>
            {pendingScreenshots.map((p) => (
              <View key={p.id} style={{ marginRight: 8, position: 'relative' }}>
                <Image source={{ uri: ensureDataURI(p.base64) }} style={{ width: 56, height: 56, borderRadius: 8 }} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => setPendingScreenshots((prev) => prev.filter((x) => x.id !== p.id))}
                  activeOpacity={0.7} style={s.removeBadge}
                >
                  <Text style={{ color: '#fff', fontSize: 10 }}>x</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Input area */}
      <View style={s.inputSection}>
        <View style={s.inputRow}>
          {(onPickImage || onTakePhotoProp) && (
            <TouchableOpacity onPress={handleImageAction} activeOpacity={0.7} disabled={disabled} style={{ paddingVertical: 6 }}>
              <Ionicons name="image-outline" size={20} color={disabled ? '#ccc' : '#44b7fe'} />
            </TouchableOpacity>
          )}
          <TextInput
            value={inputValue} onChangeText={setInputValue}
            placeholder={tOrDefault(t, 'chat.input.placeholder', 'Text chat mode...')}
            placeholderTextColor="rgba(0,0,0,0.3)"
            multiline blurOnSubmit={false} editable={!disabled}
            style={s.textInput}
          />
          <TouchableOpacity onPress={handleSend} activeOpacity={0.7} disabled={disabled}
            style={[s.sendButton, disabled && s.sendButtonDisabled]}
          >
            <Ionicons name="send" size={14} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <Modal visible={!collapsed} transparent animationType="slide" onRequestClose={() => setCollapsed(true)}>
      <TouchableWithoutFeedback onPress={() => setCollapsed(true)}>
        <View style={s.backdrop}>
          <TouchableWithoutFeedback>
            {BlurView ? (
              <BlurView intensity={40} tint="light" style={s.panel}>{panelContent}</BlurView>
            ) : (
              <View style={s.panel}>{panelContent}</View>
            )}
          </TouchableWithoutFeedback>

          {renderFloatingOverlay && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
              {renderFloatingOverlay()}
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
