import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
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
import QRCode from 'react-native-qrcode-svg';
import { Ionicons } from '@expo/vector-icons';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { createConfigApiClient, type CoreConfig, type ApiProvider } from '@/services/api/config';
import { useTheme } from '@/constants/ThemeContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { config, isLoaded } = useDevConnectionConfig();
  const apiBase = `http://${config.host}:${config.port}`;
  const p2pToken = config.p2p?.token;
  const { t } = useTranslation();
  const theme = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [coreConfig, setCoreConfig] = useState<CoreConfig>({});
  const [coreProviders, setCoreProviders] = useState<ApiProvider[]>([]);
  const [assistProviders, setAssistProviders] = useState<ApiProvider[]>([]);
  const [p2pConfig, setP2pConfig] = useState<any>(null);

  const s = useMemo(() => StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.page },
    keyboardView: { flex: 1 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    loadingText: { fontSize: theme.fontSize.callout, color: theme.colors.textPrimary },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      backgroundColor: theme.colors.page,
      borderBottomColor: theme.colors.border,
    },
    backButton: { padding: theme.spacing.sm },
    headerTitle: {
      flex: 1,
      fontSize: theme.fontSize.headline,
      fontWeight: theme.fontWeight.bold,
      textAlign: 'center',
      color: theme.colors.textPrimary,
    },
    refreshButton: { padding: theme.spacing.sm },
    messageBox: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
    messageRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: theme.spacing.sm,
      flex: 1,
    },
    messageText: { color: '#fff' },
    messageErrorBg: { backgroundColor: theme.colors.error },
    messageSuccessBg: { backgroundColor: theme.colors.success },
    content: { flex: 1, paddingHorizontal: theme.spacing.lg },
    section: { marginTop: theme.spacing.xl },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: theme.spacing.md,
    },
    sectionIcon: { marginRight: theme.spacing.sm },
    sectionTitle: {
      flex: 1,
      fontSize: theme.fontSize.callout,
      fontWeight: theme.fontWeight.semibold,
      color: theme.colors.textPrimary,
    },
    card: {
      borderRadius: theme.radius.md,
      padding: theme.spacing.lg,
      backgroundColor: theme.colors.elevated,
    },
    field: { marginBottom: theme.spacing.lg },
    label: {
      fontSize: theme.fontSize.caption,
      marginBottom: theme.spacing.xs,
      color: theme.colors.textSecondary,
    },
    input: {
      borderRadius: theme.radius.sm,
      padding: theme.spacing.md,
      fontSize: theme.fontSize.callout,
      borderWidth: 1,
      backgroundColor: theme.colors.page,
      borderColor: theme.colors.border,
      color: theme.colors.textPrimary,
    },
    pickerContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm },
    pickerOption: {
      borderRadius: theme.radius.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
      borderWidth: 1,
      backgroundColor: theme.colors.elevated,
      borderColor: theme.colors.border,
    },
    pickerOptionSelected: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accent,
    },
    pickerOptionText: {
      fontSize: theme.fontSize.body,
      color: theme.colors.textPrimary,
    },
    pickerOptionTextSelected: {
      color: theme.colors.textOnAccent,
      fontWeight: theme.fontWeight.bold,
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    infoLabel: { fontSize: theme.fontSize.body, color: theme.colors.textMuted },
    infoValue: { fontSize: theme.fontSize.body, color: theme.colors.textPrimary },
    saveContainer: { paddingVertical: theme.spacing.xl, paddingBottom: theme.spacing.xxxxl },
    saveButton: {
      borderRadius: theme.radius.sm,
      padding: theme.spacing.lg,
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
    },
    saveButtonDisabled: { opacity: 0.5 },
    saveButtonText: {
      fontSize: theme.fontSize.callout,
      fontWeight: theme.fontWeight.bold,
      color: theme.colors.textOnAccent,
    },
    qrContainer: {
      padding: theme.spacing.lg,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.elevated,
      marginBottom: theme.spacing.md,
    },
    qrDesc: {
      fontSize: theme.fontSize.body,
      lineHeight: theme.lineHeight.body,
      marginBottom: theme.spacing.md,
      color: theme.colors.textSecondary,
    },
    qrSteps: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      gap: theme.spacing.md,
      borderColor: theme.colors.border,
    },
    qrStepRow: { flexDirection: 'row', alignItems: 'flex-start' },
    qrStepNum: {
      width: theme.spacing.xl + 2,
      height: theme.spacing.xl + 2,
      borderRadius: theme.radius.full,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: theme.spacing.md,
      marginTop: 1,
      backgroundColor: theme.colors.accent,
    },
    qrStepNumText: {
      fontSize: theme.fontSize.caption,
      fontWeight: theme.fontWeight.bold,
      color: '#fff',
    },
    qrStepText: {
      flex: 1,
      fontSize: theme.fontSize.body,
      lineHeight: 20,
      color: theme.colors.textSecondary,
    },
    qrInfoBlock: {
      borderWidth: 1,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      borderColor: theme.colors.border,
    },
    qrInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    qrInfoLabel: { fontSize: theme.fontSize.footnote, color: theme.colors.textMuted },
    qrInfoValue: {
      flex: 1,
      fontSize: theme.fontSize.footnote,
      textAlign: 'right',
      marginLeft: theme.spacing.md,
      color: theme.colors.textSecondary,
    },
  }), [theme]);

  const loadP2PConfig = useCallback(async () => {
    try {
      const response = await fetch(`${apiBase}/p2p-info`);
      if (response.ok) {
        const data = await response.json();
        setP2pConfig(data);
      }
    } catch (err) {
      console.log('P2P info not available:', err);
    }
  }, [apiBase]);

  const loadConfig = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const client = createConfigApiClient(apiBase, p2pToken);
      const [configData, providersData] = await Promise.all([
        client.getCoreConfig(),
        client.getApiProviders(),
      ]);

      setCoreConfig(configData);
      setCoreProviders(providersData.core_api_providers || []);
      setAssistProviders(providersData.assist_api_providers || []);
    } catch (err: any) {
      console.error('Failed to load config:', err);
      setError(err.message || 'Failed to load configuration');
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (!isLoaded) return;
    loadConfig();
    loadP2PConfig();
  }, [isLoaded, loadConfig, loadP2PConfig]);

  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const client = createConfigApiClient(apiBase, p2pToken);
      const result = await client.updateCoreConfig(coreConfig);

      if (result.success) {
        setSuccess('Settings saved successfully!');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || 'Failed to save');
      }
    } catch (err: any) {
      console.error('Failed to save config:', err);
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [apiBase, coreConfig]);

  const updateField = (field: keyof CoreConfig, value: string | boolean) => {
    setCoreConfig(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <SafeAreaView style={s.container}>
        <View style={s.loadingContainer}>
          <Text style={s.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.keyboardView}
      >
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.backButton}>
            <Ionicons name="chevron-back" size={24} color={theme.colors.accent} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>{t('settings.title')}</Text>
          <TouchableOpacity onPress={loadConfig} style={s.refreshButton}>
            <Ionicons name="refresh" size={22} color={theme.colors.accent} />
          </TouchableOpacity>
        </View>

        {error && (
          <View style={[s.messageBox, s.messageErrorBg]}>
            <View style={s.messageRow}>
              <Ionicons name="close-circle" size={16} color="#fff" />
              <Text style={s.messageText}>{error}</Text>
            </View>
            <TouchableOpacity onPress={() => setError(null)}>
              <Ionicons name="close" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
        {success && (
          <View style={[s.messageBox, s.messageSuccessBg]}>
            <View style={s.messageRow}>
              <Ionicons name="checkmark-circle" size={16} color="#fff" />
              <Text style={s.messageText}>{success}</Text>
            </View>
          </View>
        )}

        <ScrollView
          style={s.content}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadConfig} />}
        >
          {/* Core API Section */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="key" size={20} color={theme.colors.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('settings.sections.api')}</Text>
            </View>
            <View style={s.card}>
              <View style={s.field}>
                <Text style={s.label}>{t('settings.api.coreProvider')}</Text>
                <View style={s.pickerContainer}>
                  {coreProviders.map((provider, index) => (
                    <TouchableOpacity
                      key={provider.id || `core-${index}`}
                      style={[
                        s.pickerOption,
                        coreConfig.coreApi === provider.id && s.pickerOptionSelected,
                      ]}
                      onPress={() => updateField('coreApi', provider.id)}
                    >
                      <Text style={[
                        s.pickerOptionText,
                        coreConfig.coreApi === provider.id && s.pickerOptionTextSelected,
                      ]}>
                        {provider.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={s.field}>
                <Text style={s.label}>{t('settings.api.apiKey')}</Text>
                <TextInput
                  style={s.input}
                  value={coreConfig.api_key || ''}
                  onChangeText={(text) => updateField('api_key', text)}
                  placeholder={t('settings.api.enterKey')}
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          {/* Assist API Section */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="settings" size={20} color={theme.colors.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('settings.sections.provider')}</Text>
            </View>
            <View style={s.card}>
              <View style={s.field}>
                <Text style={s.label}>{t('settings.api.assistProvider')}</Text>
                <View style={s.pickerContainer}>
                  {assistProviders.map((provider, index) => (
                    <TouchableOpacity
                      key={provider.id || `assist-${index}`}
                      style={[
                        s.pickerOption,
                        coreConfig.assistApi === provider.id && s.pickerOptionSelected,
                      ]}
                      onPress={() => updateField('assistApi', provider.id)}
                    >
                      <Text style={[
                        s.pickerOptionText,
                        coreConfig.assistApi === provider.id && s.pickerOptionTextSelected,
                      ]}>
                        {provider.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>
          </View>

          {/* Provider-specific API Keys */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="key" size={20} color={theme.colors.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('settings.title')}</Text>
            </View>
            <View style={s.card}>
              {[
                { label: 'Qwen (Alibaba Cloud)', field: 'assistApiKeyQwen' as keyof CoreConfig },
                { label: 'OpenAI',               field: 'assistApiKeyOpenai' as keyof CoreConfig },
                { label: 'Gemini (Google)',       field: 'assistApiKeyGemini' as keyof CoreConfig },
                { label: 'GLM (Zhipu)',           field: 'assistApiKeyGlm' as keyof CoreConfig },
                { label: 'Step (阶跃星辰)',        field: 'assistApiKeyStep' as keyof CoreConfig },
                { label: 'Silicon Flow (硅基流动)', field: 'assistApiKeySilicon' as keyof CoreConfig },
              ].map(({ label, field }) => (
                <View key={field} style={s.field}>
                  <Text style={s.label}>{label}</Text>
                  <TextInput
                    style={s.input}
                    value={(coreConfig[field] as string) || ''}
                    onChangeText={(text) => updateField(field, text)}
                    placeholder={t('settings.api.enterKey')}
                    placeholderTextColor={theme.colors.textMuted}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* MCP Section */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="cog" size={20} color={theme.colors.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>MCP Token</Text>
            </View>
            <View style={s.card}>
              <View style={s.field}>
                <Text style={s.label}>MCP Router Token</Text>
                <TextInput
                  style={s.input}
                  value={coreConfig.mcpToken || ''}
                  onChangeText={(text) => updateField('mcpToken', text)}
                  placeholder={t('settings.api.enterKey')}
                  placeholderTextColor={theme.colors.textMuted}
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>
          </View>

          {/* Server Info */}
          <View style={s.section}>
            <View style={s.sectionHeader}>
              <Ionicons name="information-circle" size={20} color={theme.colors.accent} style={s.sectionIcon} />
              <Text style={s.sectionTitle}>{t('settings.sections.serverInfo')}</Text>
            </View>
            <View style={s.card}>
              {[
                { label: 'Host',      value: config.host },
                { label: 'Port',      value: String(config.port) },
                { label: 'Character', value: config.characterName },
              ].map(({ label, value }) => (
                <View key={label} style={s.infoRow}>
                  <Text style={s.infoLabel}>{label}</Text>
                  <Text style={s.infoValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* P2P Connection QR Code */}
          {p2pConfig && (
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <Ionicons name="phone-portrait" size={20} color={theme.colors.accent} style={s.sectionIcon} />
                <Text style={s.sectionTitle}>{t('settings.sections.p2p')}</Text>
              </View>
              <View style={s.card}>
                <Text style={s.qrDesc}>
                  {t('settings.p2p.desc')}
                </Text>

                <View style={s.qrSteps}>
                  {(['step1', 'step2', 'step3'] as const).map((key, i) => (
                    <View key={key} style={s.qrStepRow}>
                      <View style={s.qrStepNum}>
                        <Text style={s.qrStepNumText}>{i + 1}</Text>
                      </View>
                      <Text style={s.qrStepText}>
                        {t(`settings.p2p.${key}`)}
                      </Text>
                    </View>
                  ))}
                </View>

                <View style={s.qrContainer}>
                  <QRCode
                    value={JSON.stringify(p2pConfig)}
                    size={200}
                    color={theme.isDark ? '#fff' : '#000'}
                    backgroundColor={theme.isDark ? theme.colors.page : theme.colors.elevated}
                  />
                </View>

                <View style={s.qrInfoBlock}>
                  {[
                    { label: t('settings.p2p.lanIp'), value: p2pConfig.lan_ip || '--' },
                    { label: t('settings.p2p.port'),  value: String(p2pConfig.port || '--') },
                    { label: t('settings.p2p.token'), value: t('settings.p2p.tokenHidden') },
                  ].map(({ label, value }) => (
                    <View key={label} style={s.qrInfoRow}>
                      <Text style={s.qrInfoLabel}>{label}</Text>
                      <Text style={s.qrInfoValue}>{value}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </View>
          )}

          {/* Save Button */}
          <View style={s.saveContainer}>
            <TouchableOpacity
              style={[s.saveButton, saving && s.saveButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={s.saveButtonText}>
                {saving ? t('settings.api.saving') : t('settings.api.save')}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
