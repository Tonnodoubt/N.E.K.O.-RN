import React, { useCallback, useRef } from 'react';
import { FlatList, View, Text, ListRenderItemInfo } from 'react-native';
import MessageBubble from './MessageBubble.native';
import { useTheme } from '@/constants/ThemeContext';
import type { ChatMessage } from './types';

interface MessageListProps {
  messages: ChatMessage[];
}

interface GroupedMessage {
  message: ChatMessage;
  isGrouped: boolean;
}

interface TimeSeparator {
  type: 'separator';
  id: string;
  text: string;
}

type FlatListItem = GroupedMessage | TimeSeparator;

const TIME_GAP_MS = 5 * 60 * 1000;

function formatRelativeTime(ts: number): string {
  const nowTs = Date.now();
  const diff = nowTs - ts;
  const date = new Date(ts);

  if (diff < 60_000) return '刚刚';
  if (diff < 60 * 60_000) return `${Math.floor(diff / 60_000)}分钟前`;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000);

  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

  if (dayDiff === 0) return `今天 ${hm}`;
  if (dayDiff === 1) return `昨天 ${hm}`;
  if (dayDiff < 7) {
    const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${days[date.getDay()]} ${hm}`;
  }
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getMonth() + 1}月${date.getDate()}日 ${hm}`;
  }
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${hm}`;
}

function buildFlatList(messages: ChatMessage[]): FlatListItem[] {
  const sorted = [...messages].sort((a, b) => a.createdAt - b.createdAt);
  const items: FlatListItem[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const msg = sorted[i];
    const prev = i > 0 ? sorted[i - 1] : null;

    if (!prev || msg.createdAt - prev.createdAt > TIME_GAP_MS) {
      items.push({ type: 'separator', id: `sep-${msg.id}`, text: formatRelativeTime(msg.createdAt) });
    }

    const isGrouped = prev !== null && prev.role === msg.role && msg.role !== 'system';
    items.push({ message: msg, isGrouped });
  }

  return items;
}

function TimeSeparatorView({ text }: { text: string }) {
  const t = useTheme();
  return (
    <View style={{
      flexDirection: 'row', alignItems: 'center',
      marginVertical: 12, paddingHorizontal: 16,
    }}>
      <View style={{ flex: 1, height: 0.5, backgroundColor: t.colors.timestampLine }} />
      <Text style={{
        marginHorizontal: 12,
        fontSize: t.fontSize.caption,
        color: t.colors.timestampText,
      }}>
        {text}
      </Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: t.colors.timestampLine }} />
    </View>
  );
}

export default function MessageList({ messages }: MessageListProps) {
  const flatListRef = useRef<FlatList<FlatListItem>>(null);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<FlatListItem>) => {
    if ('type' in item && item.type === 'separator') {
      return <TimeSeparatorView text={item.text} />;
    }
    const gm = item as GroupedMessage;
    return <MessageBubble message={gm.message} isGrouped={gm.isGrouped} />;
  }, []);

  const keyExtractor = useCallback((item: FlatListItem) => {
    if ('type' in item) return item.id;
    return item.message.id;
  }, []);

  const data = React.useMemo(() => [...buildFlatList(messages)].reverse(), [messages]);

  return (
    <FlatList
      ref={flatListRef}
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      inverted
      contentContainerStyle={{
        paddingVertical: 8,
        flexGrow: 1,
        justifyContent: data.length === 0 ? 'center' : undefined,
      }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      onContentSizeChange={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })}
      ItemSeparatorComponent={null}
    />
  );
}
