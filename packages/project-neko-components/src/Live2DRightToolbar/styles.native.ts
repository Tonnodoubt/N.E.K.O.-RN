import { StyleSheet } from 'react-native';
import type { Theme } from '@/constants/theme';

export function createToolbarStyles(t: Theme) {
  return StyleSheet.create({
    container: {
      position: 'absolute',
      zIndex: 99999,
      flexDirection: 'column',
    },

    button: {
      width: 48,
      height: 48,
      borderRadius: t.radius.xxl,
      backgroundColor: t.colors.surfaceGlass,
      borderWidth: 1,
      borderColor: t.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: t.spacing.md,
      ...t.shadowCard,
    },

    buttonActive: {
      backgroundColor: t.colors.accent + 'E6',
      borderColor: t.colors.accent + '80',
    },

    returnButton: {
      width: 64,
      height: 64,
      borderRadius: 32,
    },

    icon: {
      width: '76%',
      height: '76%',
      resizeMode: 'contain',
    },

    modalOverlay: {
      flex: 1,
      backgroundColor: t.colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },

    panelContainer: {
      backgroundColor: t.colors.surfaceGlass,
      borderRadius: t.radius.md,
      padding: t.spacing.xl,
      width: '85%',
      maxHeight: '70%',
      borderWidth: 1,
      borderColor: t.colors.border,
      ...t.shadowModal,
    },

    panelTitle: {
      fontSize: t.fontSize.headline,
      fontWeight: t.fontWeight.bold,
      color: t.colors.textPrimary,
      marginBottom: t.spacing.lg,
      textAlign: 'center',
    },

    statusText: {
      fontSize: t.fontSize.footnote,
      color: t.colors.accent,
      padding: t.spacing.md,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.accentSoft,
      marginBottom: t.spacing.lg,
      textAlign: 'center',
    },

    scrollView: {
      maxHeight: 400,
    },

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.accentSoft,
      marginBottom: t.spacing.sm,
    },

    rowDisabled: {
      opacity: 0.5,
    },

    label: {
      fontSize: t.fontSize.body,
      color: t.colors.textPrimary,
      marginLeft: t.spacing.md,
      flex: 1,
    },

    labelDisabled: {
      color: t.colors.textMuted,
    },

    separator: {
      height: 1,
      backgroundColor: t.colors.separator,
      marginVertical: t.spacing.md,
    },

    menuItem: {
      paddingVertical: 14,
      paddingHorizontal: t.spacing.lg,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.accentSoft,
      marginBottom: t.spacing.sm,
    },

    menuItemContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },

    menuIcon: {
      width: 24,
      height: 24,
      resizeMode: 'contain',
    },

    menuItemText: {
      fontSize: t.fontSize.body,
      color: t.colors.textPrimary,
      marginLeft: 10,
      flex: 1,
    },

    closeButton: {
      marginTop: t.spacing.lg,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.xxl,
      backgroundColor: t.colors.accent,
      borderRadius: t.radius.sm,
      alignItems: 'center',
    },

    closeButtonText: {
      fontSize: t.fontSize.callout,
      fontWeight: t.fontWeight.semibold,
      color: t.colors.textOnAccent,
    },
  });
}
