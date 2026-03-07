import { StyleSheet, View, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { hasUserStoredConfig } from '@/services/DevConnectionStorage';
import { sessionStore } from '@/utils/sessionStore';

type ConnectionStatus = 'online' | 'offline';

const STATUS_MAP: Record<ConnectionStatus, { color: string; text: string }> = {
  online:  { color: '#40c5f1', text: '就绪' },
  offline: { color: '#ff4d4d', text: '未连接' },
};

export default function HomeScreen() {
  const router = useRouter();
  const { config, isLoaded, reload } = useDevConnectionConfig();

  const isFocused = useIsFocused();
  const [isConnected, setIsConnected] = useState(sessionStore.isConnected);
  const [isUserConfigured, setIsUserConfigured] = useState(false);

  // 订阅 WebSocket 连接状态变化
  useEffect(() => sessionStore.subscribe(setIsConnected), []);

  // 每次页面获得焦点时同步配置状态（扫码/手动配置后返回首页可立即更新）
  useEffect(() => {
    if (!isLoaded || !isFocused) return;
    hasUserStoredConfig().then(setIsUserConfigured);
    reload();
  }, [isLoaded, isFocused, reload]);

  const status: ConnectionStatus = isConnected ? 'online' : 'offline';
  const { color: statusColor, text: statusText } = STATUS_MAP[status];
  const showIp = isUserConfigured && isConnected;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* 标题区域 */}
        <View style={styles.header}>
           <Text style={styles.title}>Project N.E.K.O.</Text>
        </View>

        {/* 快捷功能 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>快捷功能</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/settings')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}>🔑</Text>
              <Text style={styles.actionText}>API 设置</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/character-manager')}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}>🐱</Text>
              <Text style={styles.actionText}>角色管理</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 服务器配置 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>服务器连接</Text>

          <View style={styles.configCard}>
            <View style={styles.configRow}>
              <Text style={styles.configLabel}>当前连接</Text>
              <View style={styles.statusIndicator}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
              </View>
            </View>
            {showIp ? (
              <Text style={styles.configValue}>
                {config.host}:{config.port}
              </Text>
            ) : isUserConfigured ? (
              <Text style={styles.configValueOffline}>已配置，等待连接…</Text>
            ) : (
              <Text style={styles.configValueOffline}>扫码或手动配置以连接</Text>
            )}
            <Text style={styles.configSubtext}>角色: {config.characterName}</Text>
          </View>

          <View style={styles.configButtons}>
            <TouchableOpacity
              style={styles.configButton}
              onPress={() => router.push('/server-config')}
              activeOpacity={0.8}
            >
              <Text style={styles.configButtonIcon}>⚙️</Text>
              <Text style={styles.configButtonText}>手动配置</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.configButton}
              onPress={() => router.push({ pathname: '/qr-scanner', params: { returnTo: '/main' } })}
              activeOpacity={0.8}
            >
              <Text style={styles.configButtonIcon}>📷</Text>
              <Text style={styles.configButtonText}>扫码配置</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#40c5f1',
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    letterSpacing: 4,
  },
  section: {
    marginBottom: 28,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#40c5f1',
    marginBottom: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    backgroundColor: 'rgba(64, 197, 241, 0.1)',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(64, 197, 241, 0.3)',
  },
  actionIcon: {
    fontSize: 28,
  },
  actionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  configCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  configLabel: {
    color: '#888',
    fontSize: 12,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#40c5f1',
  },
  statusText: {
    color: '#40c5f1',
    fontSize: 12,
    fontWeight: '600',
  },
  configValue: {
    color: '#fff',
    fontSize: 20,
    fontFamily: 'monospace',
    fontWeight: '600',
  },
  configValueOffline: {
    color: '#555',
    fontSize: 14,
    fontStyle: 'italic',
  },
  configSubtext: {
    color: '#666',
    fontSize: 13,
    marginTop: 6,
  },
  configButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  configButton: {
    flex: 1,
    backgroundColor: 'rgba(64, 197, 241, 0.08)',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(64, 197, 241, 0.2)',
  },
  configButtonIcon: {
    fontSize: 20,
  },
  configButtonText: {
    color: '#40c5f1',
    fontSize: 13,
    fontWeight: '600',
  },
  hintCard: {
    backgroundColor: 'rgba(30, 30, 30, 0.6)',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  hintText: {
    color: '#888',
    fontSize: 14,
    lineHeight: 22,
  },
});
