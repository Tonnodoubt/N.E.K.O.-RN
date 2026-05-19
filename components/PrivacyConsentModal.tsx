import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  BackHandler,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/constants/ThemeContext';

export const PRIVACY_AGREED_KEY = 'has_agreed_privacy';

interface Props {
  onAgree: () => void;
}

export default function PrivacyConsentModal({ onAgree }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const cc = theme.colors;
  const [agreeing, setAgreeing] = useState(false);

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: cc.elevated },
    header: {
      paddingHorizontal: theme.spacing.xl,
      paddingTop: theme.spacing.lg,
      paddingBottom: theme.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: cc.border,
    },
    title: {
      fontSize: theme.fontSize.callout,
      fontWeight: theme.fontWeight.bold,
      textAlign: 'center',
      color: cc.textPrimary,
    },
    scrollView: { flex: 1 },
    scrollContent: {
      paddingHorizontal: theme.spacing.xl,
      paddingVertical: theme.spacing.lg,
    },
    content: {
      fontSize: theme.fontSize.body,
      lineHeight: theme.lineHeight.body,
      color: cc.textSecondary,
    },
    footer: {
      flexDirection: 'row',
      padding: theme.spacing.lg,
      gap: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: cc.border,
    },
    button: {
      flex: 1,
      paddingVertical: theme.spacing.md + 2,
      borderRadius: theme.radius.md,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonDisabled: { opacity: 0.5 },
    buttonText: {
      fontSize: theme.fontSize.callout,
      fontWeight: theme.fontWeight.semibold,
    },
  }), [theme, cc]);

  const handleAgree = async () => {
    setAgreeing(true);
    await AsyncStorage.setItem(PRIVACY_AGREED_KEY, 'true');
    onAgree();
  };

  const handleDisagree = () => {
    if (Platform.OS === 'android') {
      BackHandler.exitApp();
    } else {
      Alert.alert(
        t('privacy.disagreeTitle'),
        t('privacy.iosCannotExit'),
        [{ text: t('common.ok'), style: 'default' }]
      );
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>{t('privacy.title')}</Text>
      </View>

      <ScrollView
        style={s.scrollView}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator={true}
      >
        <Text style={s.content}>{t('privacy.content')}</Text>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={[s.button, { backgroundColor: cc.border }]}
          onPress={handleDisagree}
          activeOpacity={0.7}
        >
          <Text style={[s.buttonText, { color: cc.textSecondary }]}>{t('privacy.disagree')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[s.button, { backgroundColor: cc.accent }, agreeing && s.buttonDisabled]}
          onPress={handleAgree}
          disabled={agreeing}
          activeOpacity={0.7}
        >
          <Text style={[s.buttonText, { color: cc.textOnAccent, fontWeight: theme.fontWeight.bold }]}>
            {t('privacy.agree')}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
