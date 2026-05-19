import { useMemo } from 'react';
import { ActivityIndicator, Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback, ScrollView, Image, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { useTranslation } from 'react-i18next';

interface CharacterSelectionModalProps {
  visible: boolean;
  characterList: string[];
  currentCatgirl: string | null;
  loading: boolean;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export function CharacterSelectionModal({
  visible,
  characterList,
  currentCatgirl,
  loading,
  onSelect,
  onClose,
}: CharacterSelectionModalProps) {
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
      borderRadius: theme.radius.xl,
      overflow: 'hidden',
      width: '82%',
      maxHeight: '65%',
      ...theme.shadowModal,
    },
    header: {
      backgroundColor: cc.accent,
      paddingVertical: theme.spacing.xl,
      paddingHorizontal: theme.spacing.xxxl,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
    },
    closeBtn: {
      position: 'absolute',
      right: theme.spacing.xl,
      top: '50%',
      marginTop: -10,
    },
    closeBtnText: {
      color: cc.textOnAccent,
      fontSize: theme.fontSize.headline,
      fontWeight: '400',
      lineHeight: 20,
    },
    title: {
      color: cc.textOnAccent,
      fontSize: theme.fontSize.headline,
      fontWeight: '600',
      letterSpacing: 1,
    },
    subtitle: {
      color: cc.textSecondary,
      fontSize: theme.fontSize.footnote,
      textAlign: 'center',
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.xl,
    },
    subtitleLabel: {
      color: cc.accent,
      fontWeight: '600',
    },
    subtitleHighlight: {
      color: cc.accent,
      fontWeight: '600',
    },
    loadingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    loadingText: {
      color: cc.accent,
      fontSize: theme.fontSize.footnote,
      fontWeight: '600',
    },
    list: {
      maxHeight: 300,
      paddingHorizontal: theme.spacing.xl,
      paddingBottom: theme.spacing.xs,
    },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.xl,
      marginBottom: theme.spacing.sm,
      backgroundColor: cc.elevated,
      borderWidth: 2,
      borderColor: cc.border,
      borderLeftWidth: 4,
      borderLeftColor: cc.accent,
    },
    itemCurrent: {
      backgroundColor: cc.elevated,
      borderColor: cc.accent,
      borderLeftColor: cc.accent,
    },
    itemIcon: {
      width: 18,
      height: 18,
      marginRight: 10,
      transform: [{ rotate: '-90deg' }],
      tintColor: cc.accent,
    },
    itemText: {
      flex: 1,
      color: cc.accent,
      fontSize: theme.fontSize.body,
      fontWeight: '600',
      textAlign: 'center',
    },
    itemTextCurrent: {
      color: cc.accent,
      fontWeight: '700',
    },
    badgeWrap: {
      backgroundColor: cc.accent,
      borderRadius: theme.radius.full,
      paddingVertical: 2,
      paddingHorizontal: 10,
    },
    badgePlaceholder: {
      width: 38,
    },
    badge: {
      color: cc.textOnAccent,
      fontSize: theme.fontSize.caption,
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
                <Text style={s.title}>{t('main.character.manage')}</Text>
                <TouchableOpacity style={s.closeBtn} onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={s.closeBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
              <Text style={s.subtitle}>
                <Text style={s.subtitleLabel}>{t('main.character.currentLabel')}</Text>
                <Text style={s.subtitleHighlight}>{currentCatgirl || t('main.character.noCharacter')}</Text>
              </Text>
              {loading && (
                <View style={s.loadingRow}>
                  <ActivityIndicator size="small" color={cc.accent} />
                  <Text style={s.loadingText}>{t('main.character.switching')}</Text>
                </View>
              )}
              <ScrollView style={s.list} showsVerticalScrollIndicator={false}>
                {characterList.map((name) => {
                  const isCurrent = name === currentCatgirl;
                  return (
                    <TouchableOpacity
                      key={name}
                      style={[s.item, isCurrent && s.itemCurrent]}
                      disabled={isCurrent || loading}
                      activeOpacity={0.7}
                      onPress={() => onSelect(name)}
                    >
                      <Image source={require('@/assets/icons/dropdown_arrow.png')} style={s.itemIcon} />
                      <Text style={[s.itemText, isCurrent && s.itemTextCurrent]}>{name}</Text>
                      {isCurrent ? (
                        <View style={s.badgeWrap}><Text style={s.badge}>{t('main.character.current')}</Text></View>
                      ) : (
                        <View style={s.badgePlaceholder} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}
