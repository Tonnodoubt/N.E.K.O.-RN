/**
 * Server Configuration Screen
 *
 * Manually configure the Nekotong server connection address.
 * Alternative to QR code scanning for Release APK users.
 */

import { useCallback, useEffect, useState } from 'react';
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
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'NEKO_DEV_CONNECTION_CONFIG_V1';

// Icons as text
const Icons = {
  back: '←',
  check: '✓',
  save: '💾',
  server: '🖥️',
  port: '🔌',
  user: '👤',
  refresh: '🔄',
};

export default function ServerConfigScreen() {
  const router = useRouter();
  const { config, isLoaded, setConfig } = useDevConnectionConfig();
  const { t } = useTranslation();

  // Form state
  const [host, setHost] = useState('');
  const [port, setPort] = useState('');
  const [characterName, setCharacterName] = useState('');
  const [saving, setSaving] = useState(false);

  // Load current config when available
  useEffect(() => {
    if (isLoaded) {
      setHost(config.host);
      setPort(String(config.port));
      setCharacterName(config.characterName);
    }
  }, [isLoaded, config]);

  // Save configuration
  const handleSave = useCallback(async () => {
    const trimmedHost = host.trim();
    const portNum = parseInt(port, 10);

    // Validation
    if (!trimmedHost) {
      Alert.alert(t('common.error'), t('serverConfig.enterHost'));
      return;
    }
    if (!portNum || portNum < 1 || portNum > 65535) {
      Alert.alert(t('common.error'), t('serverConfig.enterValidPort'));
      return;
    }
    if (!characterName.trim()) {
      Alert.alert(t('common.error'), t('serverConfig.enterCharacter'));
      return;
    }

    try {
      setSaving(true);

      const newConfig = {
        host: trimmedHost,
        port: portNum,
        characterName: characterName.trim(),
      };

      await setConfig(newConfig);

      Alert.alert(
        t('serverConfig.saved'),
        t('serverConfig.savedMessage', {
          host: trimmedHost,
          port: portNum,
          character: characterName.trim(),
        }),
        [{ text: t('common.ok'), onPress: () => router.back() }]
      );
    } catch (error) {
      Alert.alert(t('serverConfig.saveFailed'), String(error));
    } finally {
      setSaving(false);
    }
  }, [host, port, characterName, setConfig, router, t]);

  // Reset to default
  const handleReset = useCallback(() => {
    Alert.alert(
      t('serverConfig.resetDefault'),
      t('serverConfig.resetConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.confirm'),
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem(STORAGE_KEY);
            setHost('192.168.77.252');
            setPort('48911');
            setCharacterName('test');
          },
        },
      ]
    );
  }, [t]);

  // Quick fill common local IP patterns
  const quickFillLocalhost = () => {
    setHost('localhost');
    setPort('48911');
  };

  const quickFill192 = () => {
    setHost('192.168.1.100');
    setPort('48911');
  };

  if (!isLoaded) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>{Icons.back}</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{t('serverConfig.title')}</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveButton}>
            <Text style={styles.saveButtonText}>{Icons.save}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
          {/* Instructions */}
          <View style={styles.instructionCard}>
            <Text style={styles.instructionTitle}>{t('serverConfig.instructions')}</Text>
            <Text style={styles.instructionText}>
              {t('serverConfig.instruction1')}{'\n'}
              {t('serverConfig.instruction2')}{'\n'}
              {t('serverConfig.instruction3')}
            </Text>
          </View>

          {/* Quick Fill Buttons */}
          <View style={styles.quickFillContainer}>
            <Text style={styles.quickFillLabel}>{t('serverConfig.quickFill')}</Text>
            <View style={styles.quickFillButtons}>
              <TouchableOpacity style={styles.quickFillButton} onPress={quickFillLocalhost}>
                <Text style={styles.quickFillButtonText}>localhost</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.quickFillButton} onPress={quickFill192}>
                <Text style={styles.quickFillButtonText}>192.168.1.x</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Server Address Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{Icons.server}</Text>
              <Text style={styles.sectionTitle}>{t('serverConfig.serverAddress')}</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.label}>{t('serverConfig.ipHostname')}</Text>
                <TextInput
                  style={styles.input}
                  value={host}
                  onChangeText={setHost}
                  placeholder={t('serverConfig.hostPlaceholder')}
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="default"
                />
                <Text style={styles.hint}>{t('serverConfig.ipHint')}</Text>
              </View>

              <View style={styles.field}>
                <Text style={styles.label}>{t('serverConfig.portNumber')}</Text>
                <TextInput
                  style={styles.input}
                  value={port}
                  onChangeText={setPort}
                  placeholder={t('serverConfig.portPlaceholder')}
                  placeholderTextColor="#666"
                  keyboardType="number-pad"
                  maxLength={5}
                />
              </View>
            </View>
          </View>

          {/* Character Section */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{Icons.user}</Text>
              <Text style={styles.sectionTitle}>{t('serverConfig.characterSettings')}</Text>
            </View>
            <View style={styles.card}>
              <View style={styles.field}>
                <Text style={styles.label}>{t('serverConfig.character')}</Text>
                <TextInput
                  style={styles.input}
                  value={characterName}
                  onChangeText={setCharacterName}
                  placeholder={t('serverConfig.characterPlaceholder')}
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                <Text style={styles.hint}>{t('serverConfig.characterHint')}</Text>
              </View>
            </View>
          </View>

          {/* Current Connection Info */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionIcon}>{Icons.refresh}</Text>
              <Text style={styles.sectionTitle}>{t('serverConfig.currentConfig')}</Text>
            </View>
            <View style={styles.card}>
              {config.p2p ? (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('serverConfig.p2pMode')}</Text>
                  </View>
                  <Text style={styles.wsUrl}>
                    {config.host}:{config.port}
                  </Text>
                  <Text style={[styles.hint, { marginTop: 8 }]}>
                    Token: {config.p2p.token.slice(0, 8)}...{config.p2p.token.slice(-8)}
                  </Text>
                </>
              ) : (
                <>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('serverConfig.websocketUrl')}</Text>
                  </View>
                  <Text style={styles.wsUrl}>
                    ws://{config.host}:{config.port}/ws/{config.characterName}
                  </Text>
                </>
              )}
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionContainer}>
            <TouchableOpacity
              style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              <Text style={styles.primaryButtonText}>
                {saving ? t('serverConfig.saving') : `${Icons.check} ${t('serverConfig.save')}`}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={handleReset}>
              <Text style={styles.secondaryButtonText}>{t('serverConfig.resetDefault')}</Text>
            </TouchableOpacity>
          </View>

          {/* Tips */}
          <View style={styles.tipsContainer}>
            <Text style={styles.tipsTitle}>💡 {t('serverConfig.tips')}</Text>
            <Text style={styles.tipsText}>
              • {t('serverConfig.tip1')}{'\n'}
              • {t('serverConfig.tip2')}{'\n'}
              • {t('serverConfig.tip3')}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#00d9ff',
    fontSize: 24,
  },
  headerTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  saveButton: {
    padding: 8,
  },
  saveButtonText: {
    color: '#00d9ff',
    fontSize: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  instructionCard: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    borderLeftWidth: 4,
    borderLeftColor: '#00d9ff',
  },
  instructionTitle: {
    color: '#00d9ff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  instructionText: {
    color: '#ccc',
    fontSize: 13,
    lineHeight: 20,
  },
  quickFillContainer: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quickFillLabel: {
    color: '#888',
    fontSize: 13,
  },
  quickFillButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  quickFillButton: {
    backgroundColor: '#16213e',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#333',
  },
  quickFillButtonText: {
    color: '#00d9ff',
    fontSize: 12,
  },
  section: {
    marginTop: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  sectionTitle: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  card: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#aaa',
    fontSize: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  hint: {
    color: '#666',
    fontSize: 11,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    color: '#888',
    fontSize: 14,
  },
  wsUrl: {
    color: '#4ade80',
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    fontSize: 13,
    marginTop: 4,
  },
  actionContainer: {
    marginTop: 24,
    marginBottom: 16,
    gap: 12,
  },
  primaryButton: {
    backgroundColor: '#00d9ff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  primaryButtonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#1a1a2e',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#444',
  },
  secondaryButtonText: {
    color: '#888',
    fontSize: 14,
  },
  tipsContainer: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: '#333',
  },
  tipsTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  tipsText: {
    color: '#888',
    fontSize: 12,
    lineHeight: 18,
  },
});
