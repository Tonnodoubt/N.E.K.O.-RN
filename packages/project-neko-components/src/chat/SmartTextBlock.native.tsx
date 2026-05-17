import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import Markdown from 'react-native-markdown-display';
import { useTheme } from '@/constants/ThemeContext';
import { useChatFont } from '@/constants/FontContext';

interface SmartTextBlockProps {
  text: string;
  isStreaming?: boolean;
  textColor?: string;
}

export default function SmartTextBlock({ text, isStreaming, textColor }: SmartTextBlockProps) {
  const t = useTheme();
  const { fontFamily } = useChatFont();

  const markdownStyles = {
    body: {
      fontSize: t.fontSize.body, lineHeight: t.lineHeight.body, fontWeight: '500' as const,
      color: textColor ?? t.colors.textPrimary,
      ...(fontFamily ? { fontFamily } : {}),
    },
    heading1: { fontSize: t.fontSize.title, fontWeight: t.fontWeight.bold, marginTop: t.spacing.lg, marginBottom: t.spacing.xs },
    heading2: { fontSize: t.fontSize.callout, fontWeight: t.fontWeight.bold, marginTop: t.spacing.md, marginBottom: t.spacing.xs },
    heading3: { fontSize: t.fontSize.callout, fontWeight: t.fontWeight.semibold, marginTop: t.spacing.md, marginBottom: t.spacing.xs },
    bold: { fontWeight: t.fontWeight.bold },
    italic: { fontStyle: 'italic' as const },
    code_inline: {
      fontFamily: 'Courier', fontSize: t.fontSize.footnote,
      backgroundColor: t.colors.separator, paddingHorizontal: t.spacing.xs, paddingVertical: 1, borderRadius: t.radius.xs,
    },
    code_block: {
      fontFamily: 'Courier', fontSize: t.fontSize.caption,
      backgroundColor: t.colors.separator, padding: t.spacing.sm, borderRadius: t.radius.xs, marginVertical: t.spacing.xs,
    },
    bullet_list: { marginLeft: t.spacing.md },
    ordered_list: { marginLeft: t.spacing.md },
    blockquote: { borderLeftWidth: 3, borderLeftColor: t.colors.border, paddingLeft: t.spacing.sm, opacity: 0.85 },
    link: { color: t.colors.accent, textDecorationLine: 'underline' as const },
  };

  return (
    <View>
      <Markdown style={markdownStyles}>{text}</Markdown>
      {isStreaming && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2, gap: t.spacing.xs }}>
          <View style={{ width: 6, height: 14, backgroundColor: t.colors.accent, borderRadius: 1, opacity: 0.7 }} />
          <ActivityIndicator size="small" color={t.colors.accent} />
        </View>
      )}
    </View>
  );
}
