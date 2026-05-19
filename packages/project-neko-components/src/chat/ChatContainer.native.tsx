import React, { useEffect } from 'react';
import {
  View, Text, TextInput, Modal, ScrollView, TouchableOpacity, Image, Alert,
  TouchableWithoutFeedback, PermissionsAndroid, Platform, Keyboard, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useT, tOrDefault } from '../i18n';
import { useChatState, useSendMessage } from './hooks';
import MessageList from './MessageList.native';
import { useTheme } from '@/constants/ThemeContext';
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

function getStatusColor(status: ConnectionStatus, theme: ReturnType<typeof useTheme>): string {
  switch (status) {
    case 'open': return theme.colors.success;
    case 'connecting': case 'reconnecting': case 'closing': return theme.colors.warning;
    case 'closed': return theme.colors.error;
    default: return theme.colors.textMuted;
  }
}

function getStatusText(status: ConnectionStatus, t: any, customText?: string): string {
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

export default function ChatContainer({
  externalMessages, onSendMessage, onSendText,
  connectionStatus = 'idle', disabled = false, statusText,
  cameraEnabled = false, onPickImage, onTakePhoto: onTakePhotoProp,
  renderFloatingOverlay, forceCollapsed,
  externalPendingImages, onClearExternalPendingImages,
  onAvatarTool,
  chatExpanded, onToggleChat, onToggleMic, micEnabled,
}: ChatContainerProps = {}) {
  const t = useT();
  const theme = useTheme();
  const cc = theme.colors;
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

  useEffect(() => {
    const sub = Keyboard.addListener('keyboardDidShow', () => {});
    return () => sub.remove();
  }, []);

  // ─── Inline mode (Doubao-style) ───

  if (chatExpanded !== undefined) {
    return (
      <>
        {/* Chat sheet */}
        {chatExpanded && (
          <View style={{ height: Dimensions.get('window').height * 0.4, overflow: 'hidden' }}>
            {BlurView ? (
              <BlurView intensity={theme.isDark ? 40 : 60} tint={theme.isDark ? 'dark' : 'light'} style={{
                flex: 1, backgroundColor: cc.chatSheetBg,
                borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
              }}>
                <ChatSheetContent
                  t={t} theme={theme} cc={cc}
                  messages={displayMessages}
                  connectionStatus={connectionStatus}
                  statusText={statusText}
                  pendingScreenshots={pendingScreenshots}
                  setPendingScreenshots={setPendingScreenshots}
                  onAvatarTool={onAvatarTool ? handleAvatarTool : undefined}
                  onCollapse={onToggleChat}
                />
              </BlurView>
            ) : (
              <View style={{
                flex: 1, backgroundColor: cc.chatSheetBg,
                borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
              }}>
                <ChatSheetContent
                  t={t} theme={theme} cc={cc}
                  messages={displayMessages}
                  connectionStatus={connectionStatus}
                  statusText={statusText}
                  pendingScreenshots={pendingScreenshots}
                  setPendingScreenshots={setPendingScreenshots}
                  onAvatarTool={onAvatarTool ? handleAvatarTool : undefined}
                  onCollapse={onToggleChat}
                />
              </View>
            )}
          </View>
        )}

        {/* Always-visible input bar */}
        <BottomInputBar
          theme={theme} cc={cc}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onSend={handleSend}
          onImageAction={handleImageAction}
          hasImagePicker={!!(onPickImage || onTakePhotoProp)}
          disabled={disabled}
          canSendImages={pendingScreenshots.length > 0}
          onFocus={chatExpanded ? undefined : onToggleChat}
        />
      </>
    );
  }

  // ─── Legacy mode (Modal + FAB) ───

  if (collapsed) {
    return (
      <TouchableOpacity onPress={() => setCollapsed(false)} activeOpacity={0.8} style={{
        position: 'absolute', right: theme.spacing.lg, bottom: theme.spacing.lg,
        width: 58, height: 58, borderRadius: 29, backgroundColor: cc.accent,
        justifyContent: 'center', alignItems: 'center',
        ...theme.shadowFloating,
      }}>
        <Ionicons name="chatbubble-ellipses" size={26} color={cc.textOnAccent} />
      </TouchableOpacity>
    );
  }

  const panelContent = (
    <>
      <View style={{
        height: 56, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: theme.spacing.xl,
        borderBottomColor: cc.separator, borderBottomWidth: 1,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
          <Text style={{ fontSize: theme.fontSize.callout, fontWeight: theme.fontWeight.bold, color: cc.textPrimary }}>
            {tOrDefault(t, 'chat.title', 'N.E.K.O. Chat')}
          </Text>
          {sendHandler && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
              <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: getStatusColor(connectionStatus, theme) }} />
              <Text style={{ fontSize: theme.fontSize.footnote, color: cc.textMuted }}>
                {getStatusText(connectionStatus, t, statusText)}
              </Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={() => setCollapsed(true)} activeOpacity={0.7} style={{
          width: 36, height: 36, borderRadius: theme.radius.full,
          backgroundColor: cc.separator, justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name="chevron-down" size={22} color={cc.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <MessageList messages={displayMessages} />
      </View>

      {onAvatarTool && (
        <View style={{
          flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
          borderTopColor: cc.separator, borderTopWidth: 1,
        }}>
          {AVATAR_TOOLS.map((tool) => (
            <TouchableOpacity key={tool.action} onPress={() => handleAvatarTool(tool.action)} activeOpacity={0.6} style={{
              width: 48, height: 48, borderRadius: theme.radius.xxl,
              backgroundColor: cc.accentSoft,
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 1, borderColor: cc.borderStrong,
            }}>
              <Ionicons name={tool.icon} size={22} color={cc.accent} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {pendingScreenshots.length > 0 && (
        <View style={{
          paddingHorizontal: theme.spacing.md, paddingVertical: 10,
          borderTopColor: cc.separator, borderTopWidth: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: theme.spacing.sm }}>
            <Text style={{ fontSize: theme.fontSize.footnote, color: cc.textMuted }}>
              {tOrDefault(t, 'chat.screenshot.pending', `待发送照片 (${pendingScreenshots.length})`)}
            </Text>
            <TouchableOpacity onPress={() => setPendingScreenshots([])} activeOpacity={0.7}>
              <Text style={{ fontSize: theme.fontSize.footnote, color: cc.error }}>
                {tOrDefault(t, 'chat.screenshot.clearAll', '清除全部')}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal>
            {pendingScreenshots.map((p) => (
              <View key={p.id} style={{ marginRight: theme.spacing.sm, position: 'relative' }}>
                <Image source={{ uri: ensureDataURI(p.base64) }} style={{ width: 64, height: 64, borderRadius: 10 }} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => setPendingScreenshots((prev) => prev.filter((x) => x.id !== p.id))}
                  activeOpacity={0.7} style={{
                    position: 'absolute', top: -5, right: -5,
                    width: 20, height: 20, borderRadius: theme.radius.full,
                    backgroundColor: cc.error + 'E6', justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  <Text style={{ color: cc.textOnAccent, fontSize: 10 }}>x</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      <View style={{
        paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: theme.spacing.xxl,
        borderTopColor: cc.separator, borderTopWidth: 1,
        backgroundColor: cc.chatSheetBg,
      }}>
        <View style={{
          flexDirection: 'row', alignItems: 'flex-end', gap: 10,
          backgroundColor: cc.separator, borderRadius: theme.radius.xl,
          paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs,
        }}>
          {(onPickImage || onTakePhotoProp) && (
            <TouchableOpacity onPress={handleImageAction} activeOpacity={0.7} disabled={disabled} style={{ paddingVertical: 6 }}>
              <Ionicons name="image-outline" size={22} color={disabled ? cc.textMuted : cc.accent} />
            </TouchableOpacity>
          )}
          <TextInput
            value={inputValue} onChangeText={setInputValue}
            placeholder={tOrDefault(t, 'chat.input.placeholder', 'Text chat mode...')}
            placeholderTextColor={cc.textMuted}
            multiline blurOnSubmit={false} editable={!disabled}
            style={{ flex: 1, fontSize: theme.fontSize.body, maxHeight: 90, paddingVertical: theme.spacing.sm, color: cc.textPrimary }}
          />
          <TouchableOpacity onPress={handleSend} activeOpacity={0.7} disabled={disabled}
            style={{
              width: 36, height: 36, borderRadius: theme.radius.full,
              backgroundColor: disabled ? cc.textMuted : cc.accent,
              justifyContent: 'center', alignItems: 'center',
            }}
          >
            <Ionicons name="send" size={16} color={cc.textOnAccent} />
          </TouchableOpacity>
        </View>
      </View>
    </>
  );

  return (
    <Modal visible={!collapsed} transparent animationType="slide" onRequestClose={() => setCollapsed(true)}>
      <View style={{ flex: 1, justifyContent: 'flex-end' }} pointerEvents="box-none">
        <TouchableWithoutFeedback>
          {BlurView ? (
            <BlurView intensity={theme.isDark ? 40 : 60} tint={theme.isDark ? 'dark' : 'light'} style={{
              height: '65%', borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
              overflow: 'hidden', backgroundColor: cc.chatSheetBg,
              borderColor: cc.border, borderWidth: 1, borderBottomWidth: 0,
            }}>
              {panelContent}
            </BlurView>
          ) : (
            <View style={{
              height: '65%', borderTopLeftRadius: theme.radius.xl, borderTopRightRadius: theme.radius.xl,
              overflow: 'hidden', backgroundColor: cc.chatSheetBg,
              borderColor: cc.border, borderWidth: 1, borderBottomWidth: 0,
            }}>
              {panelContent}
            </View>
          )}
        </TouchableWithoutFeedback>

        {renderFloatingOverlay && (
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} pointerEvents="box-none">
            {renderFloatingOverlay()}
          </View>
        )}
      </View>
    </Modal>
  );
}

// ─── Sub-components for inline mode ───

function ChatSheetContent({
  t, theme, cc,
  messages, connectionStatus, statusText,
  pendingScreenshots, setPendingScreenshots,
  onAvatarTool, onCollapse,
}: {
  t: any; theme: ReturnType<typeof useTheme>; cc: Record<string, string>;
  messages: ChatMessage[]; connectionStatus: ConnectionStatus; statusText?: string;
  pendingScreenshots: import('./types').PendingScreenshot[];
  setPendingScreenshots: React.Dispatch<React.SetStateAction<import('./types').PendingScreenshot[]>>;
  onAvatarTool?: (action: string) => void;
  onCollapse?: () => void;
}) {
  return (
    <>
      <View style={{
        height: 48, flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', paddingHorizontal: theme.spacing.lg,
        borderBottomColor: cc.separator, borderBottomWidth: 1,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text style={{ fontSize: theme.fontSize.callout, fontWeight: theme.fontWeight.bold, color: cc.textPrimary }}>
            {tOrDefault(t, 'chat.title', 'Chat')}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: getStatusColor(connectionStatus, theme) }} />
            <Text style={{ fontSize: theme.fontSize.caption, color: cc.textMuted }}>
              {getStatusText(connectionStatus, t, statusText)}
            </Text>
          </View>
        </View>
        <TouchableOpacity onPress={onCollapse} activeOpacity={0.7} style={{
          width: 32, height: 32, borderRadius: theme.radius.full,
          backgroundColor: cc.separator, justifyContent: 'center', alignItems: 'center',
        }}>
          <Ionicons name="chevron-down" size={18} color={cc.textMuted} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        <MessageList messages={messages} />
      </View>

      {onAvatarTool && (
        <View style={{
          flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.lg,
          paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.sm,
          borderTopColor: cc.separator, borderTopWidth: 1,
        }}>
          {AVATAR_TOOLS.map((tool) => (
            <TouchableOpacity key={tool.action} onPress={() => onAvatarTool(tool.action)} activeOpacity={0.6} style={{
              width: 44, height: 44, borderRadius: theme.radius.xxl,
              backgroundColor: cc.accentSoft,
              justifyContent: 'center', alignItems: 'center',
              borderWidth: 1, borderColor: cc.borderStrong,
            }}>
              <Ionicons name={tool.icon} size={20} color={cc.accent} />
            </TouchableOpacity>
          ))}
        </View>
      )}

      {pendingScreenshots.length > 0 && (
        <View style={{
          paddingHorizontal: theme.spacing.md, paddingVertical: 8,
          borderTopColor: cc.separator, borderTopWidth: 1,
        }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <Text style={{ fontSize: theme.fontSize.caption, color: cc.textMuted }}>
              {tOrDefault(t, 'chat.screenshot.pending', `待发送 (${pendingScreenshots.length})`)}
            </Text>
            <TouchableOpacity onPress={() => setPendingScreenshots([])} activeOpacity={0.7}>
              <Text style={{ fontSize: theme.fontSize.caption, color: cc.error }}>
                {tOrDefault(t, 'chat.screenshot.clearAll', '清除')}
              </Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal>
            {pendingScreenshots.map((p) => (
              <View key={p.id} style={{ marginRight: theme.spacing.sm, position: 'relative' }}>
                <Image source={{ uri: ensureDataURI(p.base64) }} style={{ width: 56, height: 56, borderRadius: 8 }} resizeMode="cover" />
                <TouchableOpacity
                  onPress={() => setPendingScreenshots((prev) => prev.filter((x) => x.id !== p.id))}
                  activeOpacity={0.7} style={{
                    position: 'absolute', top: -4, right: -4,
                    width: 18, height: 18, borderRadius: theme.radius.full,
                    backgroundColor: cc.error + 'E6', justifyContent: 'center', alignItems: 'center',
                  }}
                >
                  <Text style={{ color: cc.textOnAccent, fontSize: 9 }}>x</Text>
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );
}

function BottomInputBar({
  theme, cc,
  inputValue, onInputChange, onSend, onImageAction,
  hasImagePicker, disabled, onFocus, canSendImages = false,
}: {
  theme: ReturnType<typeof useTheme>; cc: Record<string, string>;
  inputValue: string; onInputChange: (t: string) => void;
  onSend: () => void; onImageAction: () => void;
  hasImagePicker: boolean; disabled: boolean;
  onFocus?: () => void;
  canSendImages?: boolean;
}) {
  return (
    <View style={{
      paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      backgroundColor: cc.inputBarBg,
    }}>
      <View style={{
        flexDirection: 'row', alignItems: 'flex-end', gap: 10,
        backgroundColor: cc.separator, borderRadius: theme.radius.xl,
        paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs,
      }}>
        {hasImagePicker && (
          <TouchableOpacity onPress={onImageAction} activeOpacity={0.7} disabled={disabled} style={{ paddingVertical: 6 }}>
            <Ionicons name="add-circle-outline" size={22} color={disabled ? cc.textMuted : cc.accent} />
          </TouchableOpacity>
        )}
        <TextInput
          value={inputValue} onChangeText={onInputChange}
          onFocus={onFocus}
          placeholder="输入消息..."
          placeholderTextColor={cc.textMuted}
          multiline blurOnSubmit={false} editable={!disabled}
          style={{ flex: 1, fontSize: theme.fontSize.body, maxHeight: 80, paddingVertical: theme.spacing.sm, color: cc.textPrimary }}
        />
        {(inputValue.trim().length > 0 || canSendImages) && (
          <TouchableOpacity onPress={onSend} activeOpacity={0.7} disabled={disabled} style={{ paddingVertical: 6 }}>
            <View style={{
              width: 32, height: 32, borderRadius: theme.radius.full,
              backgroundColor: disabled ? cc.textMuted : cc.accent,
              justifyContent: 'center', alignItems: 'center',
            }}>
              <Ionicons name="arrow-up" size={18} color={cc.textOnAccent} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
