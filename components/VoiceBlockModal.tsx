import { useMemo } from 'react';
import { Modal, Text, TouchableOpacity, TouchableWithoutFeedback, View, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { useTranslation } from 'react-i18next';

interface VoiceBlockModalProps {
  visible: boolean;
  onClose: () => void;
}

export function VoiceBlockModal({ visible, onClose }: VoiceBlockModalProps) {
  const theme = useTheme();
  const cc = theme.colors;
  const { t } = useTranslation();

  const s = useMemo(() => StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: cc.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      backgroundColor: theme.isDark ? cc.elevated : '#ffffff',
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      width: '72%',
    },
    header: {
      backgroundColor: cc.accent,
      paddingVertical: theme.spacing.xl,
      alignItems: 'center',
    },
    title: {
      color: cc.textOnAccent,
      fontSize: theme.fontSize.headline,
      fontWeight: '600',
    },
    body: {
      color: cc.accent,
      fontSize: theme.fontSize.callout,
      fontWeight: '600',
      textAlign: 'center',
      marginVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xl,
      lineHeight: 22,
    },
    btn: {
      marginHorizontal: theme.spacing.xl,
      marginBottom: theme.spacing.xl,
      paddingVertical: theme.spacing.sm + 3,
      borderRadius: theme.radius.full,
      backgroundColor: cc.accent,
      alignItems: 'center',
    },
    btnText: {
      color: cc.textOnAccent,
      fontSize: theme.fontSize.callout,
      fontWeight: '600',
    },
  }), [theme, cc]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={s.overlay}>
          <TouchableWithoutFeedback>
            <View style={s.content}>
              <View style={s.header}>
                <Text style={s.title}>{t('main.voice.voiceBlockTitle')}</Text>
              </View>
              <Text style={s.body}>
                {t('main.voice.voiceBlockBody')}
              </Text>
              <TouchableOpacity style={s.btn} onPress={onClose}>
                <Text style={s.btnText}>{t('main.voice.voiceBlockOk')}</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
