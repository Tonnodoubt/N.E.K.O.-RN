import React, { useCallback, useRef } from 'react';
import { FlatList, View, ListRenderItemInfo } from 'react-native';
import MessageBubble from './MessageBubble.native';
import type { ChatMessage } from './types';

interface MessageListProps {
  messages: ChatMessage[];
}

interface GroupedMessage {
  message: ChatMessage;
  isGrouped: boolean;
}

function groupMessages(messages: ChatMessage[]): GroupedMessage[] {
  return messages.map((msg, i) => ({
    message: msg,
    isGrouped: i > 0 && messages[i - 1].role === msg.role && msg.role !== 'system',
  }));
}

export default function MessageList({ messages }: MessageListProps) {
  const flatListRef = useRef<FlatList<GroupedMessage>>(null);

  const renderItem = useCallback(({ item }: ListRenderItemInfo<GroupedMessage>) => (
    <MessageBubble message={item.message} isGrouped={item.isGrouped} />
  ), []);

  const keyExtractor = useCallback((item: GroupedMessage) => item.message.id, []);

  // Reverse for inverted FlatList: newest at index 0 → rendered at visual bottom
  const data = React.useMemo(() => groupMessages([...messages].reverse()), [messages]);

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
