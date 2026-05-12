import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_DEV_CONNECTION_CONFIG, type DevConnectionConfig } from '@/utils/devConnectionConfig';

const STORAGE_KEY = 'NEKO_DEV_CONNECTION_CONFIG_V1';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

function isValidPort(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 && v < 65536;
}

type DevConnectionConfigInput = Partial<DevConnectionConfig> & {
  p2p?: DevConnectionConfig['p2p'] | null;
};

function sanitizeP2P(input: unknown): DevConnectionConfig['p2p'] | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const p2p = input as Record<string, unknown>;
  if (!isNonEmptyString(p2p.token)) return undefined;

  return {
    token: p2p.token.trim(),
    deviceId: isNonEmptyString(p2p.deviceId) ? p2p.deviceId : undefined,
    // 第1层：LAN 直连
    lanIp: isNonEmptyString(p2p.lanIp) ? p2p.lanIp : undefined,
    lanPort: isValidPort(p2p.lanPort) ? p2p.lanPort : undefined,
    // 第2层：STUN 打洞
    stunIp: isNonEmptyString(p2p.stunIp) ? p2p.stunIp : undefined,
    stunPort: isValidPort(p2p.stunPort) ? p2p.stunPort : undefined,
  };
}

function sanitizePartial(input: unknown): Partial<DevConnectionConfig> {
  const obj = input as Record<string, unknown> | null | undefined;
  const out: Partial<DevConnectionConfig> = {};
  if (isNonEmptyString(obj?.host)) out.host = (obj.host as string).trim();
  if (isValidPort(obj?.port)) out.port = obj.port as number;
  if (isNonEmptyString(obj?.characterName)) out.characterName = (obj.characterName as string).trim();

  // 支持 P2P 配置 (v3: 完整的两层连接信息)
  if (Object.prototype.hasOwnProperty.call(obj ?? {}, 'p2p')) {
    const p2p = sanitizeP2P(obj?.p2p);
    if (p2p) {
      out.p2p = p2p;
    } else {
      // 显式传入 `p2p: undefined/null` 时，表示清掉旧的 P2P 配置。
      out.p2p = undefined;
    }
  }

  return out;
}

export async function getStoredDevConnectionConfig(): Promise<DevConnectionConfig> {
  // 环境变量优先：如果设置了任一环境变量，直接使用，忽略 AsyncStorage
  const envConfig: Partial<DevConnectionConfig> = {};
  if (process.env.EXPO_PUBLIC_DEV_HOST) envConfig.host = process.env.EXPO_PUBLIC_DEV_HOST;
  if (process.env.EXPO_PUBLIC_DEV_PORT) envConfig.port = Number(process.env.EXPO_PUBLIC_DEV_PORT);
  if (process.env.EXPO_PUBLIC_DEV_CHARACTER) envConfig.characterName = process.env.EXPO_PUBLIC_DEV_CHARACTER;

  if (Object.keys(envConfig).length > 0) {
    return { ...DEFAULT_DEV_CONNECTION_CONFIG, ...envConfig };
  }

  // 无环境变量时，从 AsyncStorage 读取
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_DEV_CONNECTION_CONFIG;
    const parsed = JSON.parse(raw);
    const partial = sanitizePartial(parsed);
    return { ...DEFAULT_DEV_CONNECTION_CONFIG, ...partial };
  } catch {
    return DEFAULT_DEV_CONNECTION_CONFIG;
  }
}

export async function setStoredDevConnectionConfig(
  next: DevConnectionConfigInput
): Promise<DevConnectionConfig> {
  let current: DevConnectionConfig = DEFAULT_DEV_CONNECTION_CONFIG;
  try {
    current = await getStoredDevConnectionConfig();
    const merged: DevConnectionConfig = { ...current, ...sanitizePartial(next) };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  } catch (error) {
    console.error('[DevConnectionStorage] Failed to persist dev connection config', error);
    // Fallback: return the last known-good config so callers still get a DevConnectionConfig.
    return current;
  }
}

export async function clearStoredDevConnectionConfig(): Promise<void> {
  try {
    await AsyncStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error(`[DevConnectionStorage] Failed to clear dev connection config for key "${STORAGE_KEY}"`, error);
    // Swallow error: callers expect this to resolve to void.
  }
}

/** 用户是否存有显式配置（扫码/手动保存后才为 true）。环境变量覆盖时视为已配置。 */
export async function hasUserStoredConfig(): Promise<boolean> {
  if (
    process.env.EXPO_PUBLIC_DEV_HOST ||
    process.env.EXPO_PUBLIC_DEV_PORT ||
    process.env.EXPO_PUBLIC_DEV_CHARACTER
  ) {
    return true;
  }
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw !== null;
  } catch {
    return false;
  }
}
