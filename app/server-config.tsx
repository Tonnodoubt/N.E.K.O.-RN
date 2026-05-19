import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { DEFAULT_DEV_CONNECTION_CONFIG } from '@/utils/devConnectionConfig';

export default function ServerConfigScreen() {
  const router = useRouter();
  const { config, isLoaded, setConfig, clear } = useDevConnectionConfig();
  const { t } = useTranslation();
  const theme = useTheme();
  const cc = theme.colors;

  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isLoaded) {
      setHost(config.host);
      setPort(String(config.port));
      setCharacterName(config.characterName);
    }
  }, [isLoaded, config]);

  const handleSave = useCallback(async () => {
    const trimmedHost = host.trim();
    const portNum = parseInt(port, 10);
    if (!trimmedHost) { Alert.alert(t('common.error'), t('serverConfig.enterHost')); return; }
    if (!portNum || portNum < 1 || portNum > 65535) { Alert.alert(t('common.error'), t('serverConfig.enterValidPort')); return; }
    if (!characterName.trim()) { Alert.alert(t('common.error'), t('serverConfig.enterCharacter')); return; }
    try {
      setSaving(true);
      await setConfig({ host: trimmedHost, port: portNum, characterName: characterName.trim(), p2p: undefined });
      Alert.alert(t('serverConfig.saved'), t('serverConfig.savedMessage', { host: trimmedHost, port: portNum, character: characterName.trim() }), [{ text: t('common.ok'), onPress: () => router.back() }]);
    } catch (error) { Alert.alert(t('serverConfig.saveFailed'), String(error)); }
    finally { setSaving(false); }
  }, [host, port, characterName, setConfig, router, t]);

  const handleReset = useCallback(() => {
    Alert.alert(t('serverConfig.resetDefault'), t('serverConfig.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.confirm'), style: 'destructive', onPress: async () => {
        await clear();
        setHost(DEFAULT_DEV_CONNECTION_CONFIG.host);
        setPort(String(DEFAULT_DEV_CONNECTION_CONFIG.port));
        setCharacterName(DEFAULT_DEV_CONNECTION_CONFIG.characterName);
      }},
    ]);
  }, [clear, t]);

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: cc.page },
    keyboardView: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { fontSize: theme.fontSize.callout, color: cc.textPrimary },
    header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: theme.spacing.lg, paddingVertical: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: cc.border },
    backButton: { padding: theme.spacing.sm },
    headerTitle: { flex: 1, fontSize: theme.fontSize.headline, fontWeight: theme.fontWeight.bold, textAlign: 'center', color: cc.textPrimary },
    saveButton: { padding: theme.spacing.sm },
    content: { flex: 1, paddingHorizontal: theme.spacing.lg },
    instructionCard: { borderRadius: theme.radius.md, padding: theme.spacing.lg, marginTop: theme.spacing.lg, borderLeftWidth: 4, backgroundColor: cc.accentMuted + '22', borderLeftColor: cc.accent },
    instructionTitle: { fontSize: theme.fontSize.body, fontWeight: theme.fontWeight.semibold, marginBottom: theme.spacing.sm, color: cc.accent },
    instructionText: { fontSize: theme.fontSize.footnote, lineHeight: 20, color: cc.textSecondary },
    quickFillContainer: { marginTop: theme.spacing.lg, flexDirection: 'row', alignItems: 'center', gap: theme.spacing.md },
    quickFillLabel: { fontSize: theme.fontSize.footnote, color: cc.textMuted },
    quickFillButtons: { flexDirection: 'row', gap: theme.spacing.sm },
    quickFillBtn: { borderRadius: theme.radius.xs, paddingHorizontal: theme.spacing.md, paddingVertical: theme.spacing.xs, borderWidth: 1, backgroundColor: cc.elevated, borderColor: cc.border },
    quickFillBtnText: { fontSize: theme.fontSize.caption, color: cc.accent },
    section: { marginTop: theme.spacing.xl },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
    sectionIcon: { marginRight: theme.spacing.sm },
    sectionTitle: { flex: 1, fontSize: theme.fontSize.callout, fontWeight: theme.fontWeight.semibold, color: cc.textPrimary },
    card: { borderRadius: theme.radius.md, padding: theme.spacing.lg, backgroundColor: cc.elevated },
    field: { marginBottom: theme.spacing.lg },
    label: { fontSize: theme.fontSize.caption, marginBottom: theme.spacing.xs, color: cc.textSecondary },
    input: { borderRadius: theme.radius.sm, padding: theme.spacing.md, fontSize: theme.fontSize.callout, borderWidth: 1, backgroundColor: cc.page, borderColor: cc.border, color: cc.textPrimary },
    hint: { fontSize: theme.fontSize.caption, marginTop: theme.spacing.xs, color: cc.textMuted },
    infoLabel: { fontSize: theme.fontSize.body, paddingVertical: theme.spacing.sm, color: cc.textMuted },
    wsUrl: { fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', fontSize: theme.fontSize.footnote, marginTop: theme.spacing.xs, color: cc.success },
    actionContainer: { marginTop: theme.spacing.xxl, marginBottom: theme.spacing.lg, gap: theme.spacing.md },
    primaryBtn: { borderRadius: theme.radius.sm, padding: theme.spacing.lg, alignItems: 'center', backgroundColor: cc.accent },
    btnDisabled: { opacity: 0.5 },
    primaryBtnText: { fontSize: theme.fontSize.callout, fontWeight: theme.fontWeight.bold, color: cc.textOnAccent },
    secondaryBtn: { backgroundColor: 'transparent', borderRadius: theme.radius.sm, padding: theme.spacing.md, alignItems: 'center', borderWidth: 1, borderColor: cc.border },
    secondaryBtnText: { fontSize: theme.fontSize.body, color: cc.textMuted },
    tipsContainer: { backgroundColor: 'transparent', borderRadius: theme.radius.md, padding: theme.spacing.lg, marginBottom: theme.spacing.xxxl, borderWidth: 1, borderColor: cc.border },
    tipsTitle: { flexDirection: 'row', alignItems: 'center', marginRight: theme.spacing.xs },
    tipsTitleText: { fontSize: theme.fontSize.body, fontWeight: theme.fontWeight.semibold, color: cc.warning },
    tipsText: { fontSize: theme.fontSize.caption, lineHeight: 18, color: cc.textMuted },
  }), [theme, cc]);

  const inputStyle = s.input;

  if (!isLoaded) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingContainer}><Text style={s.loadingText}>{t('common.loading')}</Text></View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.keyboardView}>
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="chevron-back" size={24} color={cc.accent} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('serverConfig.title')}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={s.saveButton}>
            <Ionicons name="save" size={20} color={cc.accent} />
          </TouchableOpacity>
        </View>

        <ScrollView style={s.content} keyboardShouldPersistTaps="handled">
          <View style={s.instructionCard}>
            <Text style={s.instructionTitle}>{t('serverConfig.instructions')}</Text>
            <Text style={s.instructionText}>{t('serverConfig.instruction1')}{'\n'}{t('serverConfig.instruction2')}{'\n'}{t('serverConfig.instruction3')}</Text>
          </View>

          <View style={s.quickFillContainer}>
            <Text style={s.quickFillLabel}>{t('serverConfig.quickFill')}</Text>
            <View style={s.quickFillButtons}>
              <TouchableOpacity style={s.quickFillBtn} onPress={() => { setHost('localhost'); setPort('48911'); }}>
                <Text style={s.quickFillBtnText}>localhost</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.quickFillBtn} onPress={() => { setHost('192.168.1.100'); setPort('48911'); }}>
                <Text style={s.quickFillBtnText}>192.168.1.x</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="server" size={20} color={cc.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('serverConfig.serverAddress')}</Text>
            </View>
            <View style={s.card}>
              <View style={s.field}>
                <Text style={s.label}>{t('serverConfig.ipHostname')}</Text>
                <TextInput style={inputStyle} value={host} onChangeText={setHost} placeholder={t('serverConfig.hostPlaceholder')} placeholderTextColor={cc.textMuted} autoCapitalize="none" autoCorrect={false} keyboardType="default" />
                <Text style={s.hint}>{t('serverConfig.ipHint')}</Text>
              </View>
              <View style={s.field}>
                <Text style={s.label}>{t('serverConfig.portNumber')}</Text>
                <TextInput style={inputStyle} value={port} onChangeText={setPort} placeholder={t('serverConfig.portPlaceholder')} placeholderTextColor={cc.textMuted} keyboardType="number-pad" maxLength={5} />
              </View>
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="person" size={20} color={cc.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('serverConfig.characterSettings')}</Text>
            </View>
            <View style={s.card}>
              <View style={s.field}>
                <Text style={s.label}>{t('serverConfig.character')}</Text>
                <TextInput style={inputStyle} value={characterName} onChangeText={setCharacterName} placeholder={t('serverConfig.characterPlaceholder')} placeholderTextColor={cc.textMuted} autoCapitalize="none" autoCorrect={false} />
                <Text style={s.hint}>{t('serverConfig.characterHint')}</Text>
              </View>
            </View>
          </View>

          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="refresh" size={20} color={cc.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('serverConfig.currentConfig')}</Text>
            </View>
            <View style={s.card}>
              {config.p2p ? (
                <>
                  <Text style={s.infoLabel}>{t('serverConfig.p2pMode')}</Text>
                  <Text style={s.wsUrl}>{config.host}:{config.port}</Text>
                  <Text style={[s.hint, { marginTop: theme.spacing.sm }]}>Token: {config.p2p.token ? `${config.p2p.token.slice(0, 8)}...${config.p2p.token.slice(-8)}` : t('serverConfig.p2pTokenNotStored')}</Text>
                </>
              ) : (
                <>
                  <Text style={s.infoLabel}>{t('serverConfig.websocketUrl')}</Text>
                  <Text style={s.wsUrl}>ws://{config.host}:{config.port}/ws/{config.characterName}</Text>
                </>
              )}
            </View>
          </View>

          <View style={s.actionContainer}>
            <TouchableOpacity style={[s.primaryBtn, saving && s.btnDisabled]} onPress={handleSave} disabled={saving}>
              <Text style={s.primaryBtnText}>{saving ? t('serverConfig.saving') : t('serverConfig.save')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.secondaryBtn} onPress={handleReset}>
              <Text style={s.secondaryBtnText}>{t('serverConfig.resetDefault')}</Text>
            </TouchableOpacity>
          </View>

          <View style={s.tipsContainer}>
            <View style={s.tipsTitle}>
              <Ionicons name="bulb" size={20} color={cc.warning} />
              <Text style={s.tipsTitleText}>{t('serverConfig.tips')}</Text>
            </View>
            <Text style={s.tipsText}>• {t('serverConfig.tip1')}{'\n'}• {t('serverConfig.tip2')}{'\n'}• {t('serverConfig.tip3')}</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
