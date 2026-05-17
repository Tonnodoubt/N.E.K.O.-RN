import React from 'react';
import { View, Text, TouchableOpacity, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import SmartTextBlock from './SmartTextBlock.native';
import { useTheme } from '@/constants/ThemeContext';
import type { ChatMessage, MessageBlock, TextBlock, ImageBlock, LinkBlock, StatusBlock, ButtonBlock } from './types';

function ensureDataURI(url: string): string {
  if (url.startsWith('data:') || url.startsWith('http') || url.startsWith('file://')) return url;
  return `data:image/jpeg;base64,${url}`;
}

interface MessageBubbleProps {
  message: ChatMessage;
  isGrouped?: boolean;
}

const STATUS_ICONS: Record<StatusBlock['level'], keyof typeof Ionicons.glyphMap> = {
  info: 'information-circle',
  warn: 'warning',
  error: 'close-circle',
};

function renderBlock(block: MessageBlock, isUser: boolean, isStreaming: boolean, key: string, t: ReturnType<typeof useTheme>, textColor?: string) {
  switch (block.type) {
    case 'text':
      return (
        <SmartTextBlock
          key={key}
          text={block.text}
          isStreaming={isStreaming}
          textColor={textColor}
        />
      );

    case 'image':
      return (
        <Image
          key={key}
          source={{ uri: ensureDataURI(block.url) }}
          style={{
            width: 200,
            height: 150,
            borderRadius: t.radius.sm,
            marginTop: t.spacing.xs,
          }}
          resizeMode="cover"
          onError={(e) => console.warn('Image render error:', e.nativeEvent?.error)}
        />
      );

    case 'link':
      return (
        <TouchableOpacity
          key={key}
          onPress={() => {
            if (block.url.startsWith('http://') || block.url.startsWith('https://')) {
              Linking.openURL(block.url).catch(() => {});
            }
          }}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            paddingVertical: 4,
          }}
        >
          <Ionicons name="link-outline" size={14} color={t.colors.accent} />
          <Text style={{ color: t.colors.accent, fontSize: t.fontSize.footnote, textDecorationLine: 'underline' }}>
            {block.title || block.url}
          </Text>
        </TouchableOpacity>
      );

    case 'status':
      return (
        <View
          key={key}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
            marginTop: 4,
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: t.radius.xs,
            backgroundColor: t.colors[block.level === 'info' ? 'accent' : block.level === 'warn' ? 'warning' : 'error'] + '15',
          }}
        >
          <Ionicons
            name={STATUS_ICONS[block.level]}
            size={14}
            color={t.colors[block.level === 'info' ? 'accent' : block.level === 'warn' ? 'warning' : 'error']}
          />
          <Text style={{ fontSize: t.fontSize.footnote, color: t.colors[block.level === 'info' ? 'accent' : block.level === 'warn' ? 'warning' : 'error'] }}>
            {block.text}
          </Text>
        </View>
      );

    case 'button':
      return (
        <TouchableOpacity
          key={key}
          onPress={() => {}}
          style={{
            marginTop: t.spacing.xs,
            paddingHorizontal: t.spacing.lg,
            paddingVertical: t.spacing.sm,
            borderRadius: t.radius.sm,
            backgroundColor: isUser ? t.colors.border : t.colors.accent,
          }}
        >
          <Text style={{
            fontSize: t.fontSize.footnote,
            fontWeight: t.fontWeight.semibold,
            color: t.colors.textOnAccent,
            textAlign: 'center',
          }}>
            {block.label}
          </Text>
        </TouchableOpacity>
      );

    default:
      return null;
  }
}

export default function MessageBubble({ message, isGrouped }: MessageBubbleProps) {
  const t = useTheme();
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isStreaming = (message as ChatMessage & { isStreaming?: boolean }).isStreaming === true;

  if (isSystem) {
    return (
      <Animated.View entering={FadeIn.duration(t.duration.instant)} style={{ paddingHorizontal: t.spacing.md, paddingVertical: 4 }}>
        <Text style={{ fontSize: t.fontSize.footnote, color: t.colors.textMuted, textAlign: 'center' }}>
          {message.content || ''}
        </Text>
      </Animated.View>
    );
  }

  const blocks = message.blocks && message.blocks.length > 0
    ? message.blocks
    : [
        ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
        ...(message.image ? [{ type: 'image' as const, url: message.image }] : []),
      ];

  const textColor = isUser ? t.colors.userBubbleText : t.colors.aiBubbleText;

  return (
    <Animated.View
      entering={FadeIn.duration(t.duration.instant)}
      style={{
        maxWidth: '80%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        marginTop: isGrouped ? 2 : t.spacing.sm,
        paddingHorizontal: t.spacing.md,
        paddingVertical: t.spacing.sm,
        borderRadius: t.radius.lg,
        borderBottomRightRadius: isUser ? t.radius.xs : t.radius.lg,
        borderBottomLeftRadius: isUser ? t.radius.lg : t.radius.xs,
        backgroundColor: isUser ? t.colors.userBubbleBg : t.colors.aiBubbleBg,
        borderWidth: isUser ? 0 : 0.5,
        borderColor: isUser ? 'transparent' : t.colors.aiBubbleBorder,
      }}
    >
      {blocks.map((block, i) =>
        renderBlock(block, isUser, isStreaming, `${message.id}-block-${i}`, t, textColor)
      )}

      {isStreaming && !isUser && blocks.length === 0 && (
        <View style={{ flexDirection: 'row', gap: 2, paddingVertical: 4 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colors.accent }} />
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colors.accent, opacity: 0.6 }} />
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colors.accent, opacity: 0.3 }} />
        </View>
      )}
    </Animated.View>
  );
}
