import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import Markdown from 'react-native-markdown-display';

interface SmartTextBlockProps {
  text: string;
  isStreaming?: boolean;
}

const markdownStyles = {
  body: { fontSize: 15, lineHeight: 22, color: '#333' },
  heading1: { fontSize: 24, fontWeight: '700' as const, marginTop: 14, marginBottom: 6 },
  heading2: { fontSize: 20, fontWeight: '700' as const, marginTop: 12, marginBottom: 4 },
  heading3: { fontSize: 17, fontWeight: '600' as const, marginTop: 10, marginBottom: 4 },
  bold: { fontWeight: '700' as const },
  italic: { fontStyle: 'italic' as const },
  code_inline: {
    fontFamily: 'Courier', fontSize: 13,
    backgroundColor: 'rgba(0,0,0,0.06)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 3,
  },
  code_block: {
    fontFamily: 'Courier', fontSize: 12,
    backgroundColor: 'rgba(0,0,0,0.04)', padding: 8, borderRadius: 6, marginVertical: 4,
  },
  bullet_list: { marginLeft: 12 },
  ordered_list: { marginLeft: 12 },
  blockquote: { borderLeftWidth: 3, borderLeftColor: '#ccc', paddingLeft: 8, opacity: 0.85 },
  link: { color: '#44b7fe', textDecorationLine: 'underline' as const },
};

export default function SmartTextBlock({ text, isStreaming }: SmartTextBlockProps) {
  return (
    <View>
      <Markdown style={markdownStyles}>{text}</Markdown>
      {isStreaming && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: 4 }}>
          <View style={{ width: 6, height: 14, backgroundColor: '#44b7fe', borderRadius: 1, opacity: 0.7 }} />
          <ActivityIndicator size="small" color="#44b7fe" />
        </View>
      )}
    </View>
  );
}
