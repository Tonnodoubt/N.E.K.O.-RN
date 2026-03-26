import { createPageConfigApiClient, type PageConfigResponse } from '@/services/api/pageConfig';
import { useDevConnectionConfig } from '@/hooks/useDevConnectionConfig';
import { buildHttpBaseURL } from '@/utils/devConnectionConfig';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type CheckStatus = 'pass' | 'warn' | 'fail';

type CheckItem = {
  id: string;
  label: string;
  detail: string;
  status: CheckStatus;
};

function getBadgeStyle(status: CheckStatus) {
  switch (status) {
    case 'pass':
      return styles.badge_pass;
    case 'warn':
      return styles.badge_warn;
    case 'fail':
      return styles.badge_fail;
  }
}

function buildChecks(data: PageConfigResponse | null, error: string | null): CheckItem[] {
  if (error) {
    return [
      {
        id: 'api',
        label: 'page_config 可访问',
        detail: error,
        status: 'fail',
      },
    ];
  }

  if (!data) {
    return [
      {
        id: 'pending',
        label: '等待拉取 page_config',
        detail: '进入页面后会自动请求一次，也可以手动点击刷新。',
        status: 'warn',
      },
    ];
  }

  const isLive3D = data.model_type === 'live3d';
  const isVrm = isLive3D && data.live3d_sub_type === 'vrm';
  const hasModelPath = !!String(data.model_path || '').trim();

  return [
    {
      id: 'api',
      label: 'page_config 可访问',
      detail: data.success ? '服务端已返回 page_config。' : (data.error || '服务端返回 success=false'),
      status: data.success ? 'pass' : 'fail',
    },
    {
      id: 'type',
      label: '当前角色为 VRM 候选',
      detail: isVrm
        ? '当前角色是 live3d/vrm，可进入后续渲染 PoC。'
        : `当前返回 model_type=${data.model_type || '(empty)'}, live3d_sub_type=${data.live3d_sub_type || '(empty)'}`,
      status: isVrm ? 'pass' : (isLive3D ? 'warn' : 'fail'),
    },
    {
      id: 'path',
      label: '模型路径存在',
      detail: hasModelPath ? data.model_path : 'model_path 为空，无法进入模型加载验证。',
      status: hasModelPath ? 'pass' : 'fail',
    },
    {
      id: 'scope',
      label: '当前页面验证范围',
      detail: '本页面只做服务端与角色配置预检，不代表 R3F/native + three-vrm 已在手机端验证通过。',
      status: 'warn',
    },
  ];
}

export default function VRMPocScreen() {
  const { config, isLoaded } = useDevConnectionConfig();
  const apiBase = useMemo(
    () => buildHttpBaseURL({ host: config.host, port: config.port }),
    [config.host, config.port]
  );
  const client = useMemo(
    () => createPageConfigApiClient(apiBase, config.p2p?.token),
    [apiBase, config.p2p?.token]
  );

  const [characterName, setCharacterName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PageConfigResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;
    setCharacterName(config.characterName || '');
  }, [config.characterName, isLoaded]);

  const loadPageConfig = async (targetName?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await client.getPageConfig(targetName?.trim() || undefined);
      setResult(data);
      if (!data.success) {
        setError(data.error || '服务端返回 success=false');
      }
    } catch (err: any) {
      setResult(null);
      setError(err?.message || '请求 page_config 失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoaded) return;
    void loadPageConfig(config.characterName);
  }, [client, config.characterName, isLoaded]);

  const checks = buildChecks(result, error);

  const summary = useMemo(() => {
    const passCount = checks.filter(item => item.status === 'pass').length;
    const failCount = checks.filter(item => item.status === 'fail').length;
    return { passCount, failCount, total: checks.length };
  }, [checks]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>VRM R3F PoC 预检</Text>
        <Text style={styles.subtitle}>
          这个页面只验证“服务端和角色配置是否已经具备进入移动端 VRM PoC 的条件”，
          不代表手机端渲染链路已经跑通。
        </Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>当前连接</Text>
          <Text style={styles.meta}>Base URL: {apiBase}</Text>
          <Text style={styles.meta}>P2P: {config.p2p?.token ? '开启' : '关闭'}</Text>
          <Text style={styles.meta}>默认角色: {config.characterName || '(empty)'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>目标角色</Text>
          <TextInput
            style={styles.input}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="输入角色名，留空则按服务端当前角色"
            placeholderTextColor="#7d8590"
            value={characterName}
            onChangeText={setCharacterName}
          />
          <Pressable
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPress={() => void loadPageConfig(characterName)}
          >
            <Text style={styles.buttonText}>{loading ? '刷新中...' : '刷新 page_config'}</Text>
          </Pressable>
          {loading ? <ActivityIndicator style={styles.loader} /> : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>预检摘要</Text>
          <Text style={styles.summary}>
            通过 {summary.passCount}/{summary.total}，失败 {summary.failCount} 项
          </Text>
          {checks.map((item) => (
            <View key={item.id} style={styles.checkRow}>
              <View style={[styles.badge, getBadgeStyle(item.status)]}>
                <Text style={styles.badgeText}>{item.status.toUpperCase()}</Text>
              </View>
              <View style={styles.checkBody}>
                <Text style={styles.checkLabel}>{item.label}</Text>
                <Text style={styles.checkDetail}>{item.detail}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>最近一次 page_config 结果</Text>
          <Text style={styles.code}>
            {result ? JSON.stringify(result, null, 2) : (error || '暂无结果')}
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>下一步验证</Text>
          <Text style={styles.listItem}>1. 引入 `@react-three/fiber/native`、`three`、`@pixiv/three-vrm`、`expo-gl`。</Text>
          <Text style={styles.listItem}>2. 新建最小模型加载页，只验证 `Canvas` 是否能在真机起起来。</Text>
          <Text style={styles.listItem}>3. 不先接入表情、口型、VRMA，先只验证 `.vrm` 二进制 parse 和渲染。</Text>
          <Text style={styles.listItem}>4. 如果最小加载失败，就回退“原生模块优先”的判断，不继续深投 R3F。</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f3f4f6',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 22,
    color: '#4b5563',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    gap: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  meta: {
    fontSize: 14,
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#111827',
  },
  button: {
    backgroundColor: '#0f766e',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  loader: {
    marginTop: 4,
  },
  summary: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1f2937',
  },
  checkRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  badge: {
    minWidth: 56,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: 'center',
  },
  badge_pass: {
    backgroundColor: '#dcfce7',
  },
  badge_warn: {
    backgroundColor: '#fef3c7',
  },
  badge_fail: {
    backgroundColor: '#fee2e2',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#111827',
  },
  checkBody: {
    flex: 1,
    gap: 4,
  },
  checkLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  checkDetail: {
    fontSize: 14,
    lineHeight: 21,
    color: '#4b5563',
  },
  code: {
    fontFamily: 'Courier',
    fontSize: 12,
    lineHeight: 18,
    color: '#111827',
  },
  listItem: {
    fontSize: 14,
    lineHeight: 22,
    color: '#374151',
  },
});
