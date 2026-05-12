import React from 'react';
import { View, Text, TouchableOpacity, Linking, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeIn } from 'react-native-reanimated';
import SmartTextBlock from './SmartTextBlock.native';
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

const STATUS_COLORS: Record<StatusBlock['level'], string> = {
  info: '#44b7fe',
  warn: '#faad14',
  error: '#ff4d4f',
};

function renderBlock(block: MessageBlock, isUser: boolean, isStreaming: boolean, key: string) {
  switch (block.type) {
    case 'text':
      return (
        <SmartTextBlock
          key={key}
          text={block.text}
          isStreaming={isStreaming}
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
            borderRadius: 8,
            marginTop: 6,
          }}
          resizeMode="cover"
          onError={(e) => console.warn('❌ Image render error:', e.nativeEvent?.error)}
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
          <Ionicons name="link-outline" size={14} color="#44b7fe" />
          <Text style={{ color: '#44b7fe', fontSize: 13, textDecorationLine: 'underline' }}>
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
            borderRadius: 6,
            backgroundColor: `${STATUS_COLORS[block.level]}15`,
          }}
        >
          <Ionicons
            name={STATUS_ICONS[block.level]}
            size={14}
            color={STATUS_COLORS[block.level]}
          />
          <Text style={{ fontSize: 12, color: STATUS_COLORS[block.level] }}>
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
            marginTop: 6,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 8,
            backgroundColor: isUser ? 'rgba(255,255,255,0.25)' : '#44b7fe',
          }}
        >
          <Text style={{
            fontSize: 13,
            fontWeight: '600',
            color: '#fff',
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
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isStreaming = (message as ChatMessage & { isStreaming?: boolean }).isStreaming === true;

  if (isSystem) {
    return (
      <Animated.View entering={FadeIn.duration(150)} style={{ paddingHorizontal: 12, paddingVertical: 4 }}>
        <Text style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
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

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      style={{
        maxWidth: '85%',
        alignSelf: isUser ? 'flex-end' : 'flex-start',
        marginTop: isGrouped ? 2 : 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        borderBottomRightRadius: isUser ? 4 : 16,
        borderBottomLeftRadius: isUser ? 16 : 4,
        backgroundColor: isUser
          ? '#44b7fe'
          : 'rgba(255, 255, 255, 0.85)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 1,
      }}
    >
      {!isGrouped && (
        <Text style={{
          fontSize: 10,
          fontWeight: '600',
          color: isUser ? 'rgba(255,255,255,0.7)' : '#999',
          marginBottom: 4,
        }}>
          {isUser ? 'You' : 'N.E.K.O.'}
        </Text>
      )}

      {blocks.map((block, i) =>
        renderBlock(block, isUser, isStreaming, `${message.id}-block-${i}`)
      )}

      {isStreaming && !isUser && blocks.length === 0 && (
        <View style={{ flexDirection: 'row', gap: 2, paddingVertical: 4 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#44b7fe' }} />
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#44b7fe', opacity: 0.6 }} />
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#44b7fe', opacity: 0.3 }} />
        </View>
      )}
    </Animated.View>
  );
}
