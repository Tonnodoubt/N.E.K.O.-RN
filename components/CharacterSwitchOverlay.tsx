import { useMemo } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { useTranslation } from 'react-i18next';

interface CharacterSwitchOverlayProps {
  loading: boolean;
  error: string | null;
}

export function CharacterSwitchOverlay({ loading, error }: CharacterSwitchOverlayProps) {
  const theme = useTheme();
  const cc = theme.colors;
  const { t } = useTranslation();

  const s = useMemo(() => StyleSheet.create({
    overlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: cc.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 9998,
    },
    text: {
      color: cc.textPrimary,
      fontSize: theme.fontSize.body,
      marginTop: theme.spacing.md,
    },
    banner: {
      position: 'absolute',
      bottom: 80,
      alignSelf: 'center',
      backgroundColor: cc.elevated,
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: theme.radius.xl,
      zIndex: 10000,
    },
    successText: {
      color: cc.accent,
      fontSize: theme.fontSize.body,
    },
    errorText: {
      color: cc.error,
      fontSize: theme.fontSize.body,
    },
  }), [theme, cc]);

  return (
    <>
      {loading && (
        <View style={s.overlay}>
          <ActivityIndicator size="large" color={cc.accent} />
          <Text style={s.text}>{t('main.character.switching')}</Text>
        </View>
      )}
      {error !== null && (
        <View style={s.banner} pointerEvents="none">
          <Text style={s.errorText}>{error}</Text>
        </View>
      )}
    </>
  );
}
