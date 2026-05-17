import { useMemo } from 'react';
import { Modal, View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { useTranslation } from 'react-i18next';

interface DebugPanelProps {
  visible: boolean;
  onClose: () => void;
  host: string;
  port: number;
  characterName: string;
  udpStatus: string;
  udpLayer: string | undefined;
  udpEndpoint: { ip: string; port: number } | null;
  udpLogs: string[];
  onClearCache: () => void;
  onOpen: () => void;
}

export function DebugPanel({
  visible,
  onClose,
  host,
  port,
  characterName,
  udpStatus,
  udpLayer,
  udpEndpoint,
  udpLogs,
  onClearCache,
  onOpen,
}: DebugPanelProps) {
  const theme = useTheme();
  const cc = theme.colors;
  const { t } = useTranslation();

  const s = useMemo(() => StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: cc.overlay,
    },
    panel: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1a1a1a',
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      maxHeight: '70%',
      padding: theme.spacing.xl,
    },
    title: {
      color: cc.accent,
      fontSize: theme.fontSize.headline,
      fontWeight: 'bold',
      marginBottom: theme.spacing.lg,
    },
    info: {
      color: cc.textPrimary,
      fontSize: theme.fontSize.caption,
      fontFamily: 'monospace',
      marginBottom: theme.spacing.md,
    },
    sectionLabel: {
      color: cc.accent,
      fontSize: theme.fontSize.caption,
      fontWeight: 'bold',
      marginBottom: theme.spacing.xs,
    },
    logText: {
      color: cc.textSecondary,
      fontSize: 11,
      fontFamily: 'monospace',
    },
    clearBtn: {
      backgroundColor: cc.error,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.lg,
    },
    closeBtn: {
      backgroundColor: cc.accent,
      borderRadius: theme.radius.sm,
      paddingVertical: theme.spacing.md,
      alignItems: 'center',
      marginTop: theme.spacing.sm,
    },
    btnText: {
      color: cc.textOnAccent,
      fontWeight: 'bold',
    },
    fab: {
      position: 'absolute',
      bottom: 100,
      right: theme.spacing.xl,
      backgroundColor: cc.accent,
      borderRadius: 25,
      width: 50,
      height: 50,
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      ...theme.shadowFloating,
    },
  }), [theme, cc]);

  if (!__DEV__) return null;

  return (
    <>
      <TouchableOpacity style={s.fab} onPress={onOpen}>
        <Ionicons name="construct" size={20} color="#fff" />
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose}>
          <View style={s.panel} onStartShouldSetResponder={() => true}>
            <Text style={s.title}>{t('main.debug.title')}</Text>
            <ScrollView>
              <Text style={s.info}>
                {`${t('connection.status.connected')}: ${udpStatus}\n${t('main.debug.p2pLayer')}: ${udpLayer || t('main.debug.notConnected')}\n${t('settings.serverInfo.host')}: ${udpEndpoint ? `${udpEndpoint.ip}:${udpEndpoint.port}` : t('main.debug.unavailable')}\n\n${t('settings.serverInfo.host')}:\n${t('serverConfig.host')}: ${host}:${port}\n${t('settings.serverInfo.character')}: ${characterName || t('main.character.noCharacter')}`}
              </Text>
              <Text style={s.sectionLabel}>{t('main.debug.connectionLogs')}</Text>
              <Text style={s.logText}>
                {udpLogs.length > 0 ? udpLogs.join('\n') : t('main.debug.noLogs')}
              </Text>
            </ScrollView>
            <TouchableOpacity style={s.clearBtn} onPress={onClearCache}>
              <Text style={s.btnText}>{t('main.debug.clearCache')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.closeBtn} onPress={onClose}>
              <Text style={s.btnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}
