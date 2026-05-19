/**
 * 云端设备查询服务
 *
 * 用于从云端注册服务查询设备信息（阅后即焚）
 */

import { DevConnectionConfig } from '@/utils/devConnectionConfig';

const CLOUD_REGISTRY_URL = process.env.EXPO_PUBLIC_CLOUD_REGISTRY_URL;

export type CloudDeviceInfo = {
  device_id: string;
  lan_ip: string;
  token: string;
  port?: number;
  lan_port?: number;
  stun_ip?: string;
  stun_port?: number;
  character?: string;
  created_at: number;
};

function isPrivateOrLocalHost(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
  const parts = hostname.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

function getRegistryBaseUrl(): string | null {
  if (!CLOUD_REGISTRY_URL) {
    console.warn('[CloudRegistry] EXPO_PUBLIC_CLOUD_REGISTRY_URL 未配置，跳过云端查询');
    return null;
  }
  try {
    const url = new URL(CLOUD_REGISTRY_URL);
    if (url.protocol === 'https:' || isPrivateOrLocalHost(url.hostname)) {
      return url.toString().replace(/\/+$/, '');
    }
  } catch {
    // fall through
  }
  console.warn('[CloudRegistry] 拒绝使用非 HTTPS 公网 registry');
  return null;
}

/**
 * 从云端查询设备信息
 * @param deviceId 设备 ID
 * @returns 设备配置或 null
 */
export async function queryDeviceInfo(deviceId: string): Promise<DevConnectionConfig | null> {
  try {
    console.log(`[CloudRegistry] 查询设备: ${deviceId}`);
    const registryBaseUrl = getRegistryBaseUrl();
    if (!registryBaseUrl) return null;

    const response = await fetch(
      `${registryBaseUrl}/api/lookup?device_id=${encodeURIComponent(deviceId)}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        console.log('[CloudRegistry] 设备未找到或已过期');
        return null;
      }
      console.error(`[CloudRegistry] 查询失败: ${response.status}`);
      return null;
    }

    const data: CloudDeviceInfo = await response.json();
    const logSafe = { ...data, token: '***' };
    console.log('[CloudRegistry] 查询成功:', logSafe);

    // 转换为 DevConnectionConfig 格式
    const httpPort = data.port || data.lan_port || 48920;
    const config: DevConnectionConfig = {
      host: data.lan_ip,
      port: httpPort,
      characterName: data.character || 'test',
      p2p: {
        token: data.token,
        deviceId: data.device_id,

        // 第1层：LAN 直连
        lanIp: data.lan_ip,
        lanPort: httpPort,

        // 第2层：STUN 打洞
        stunIp: data.stun_ip,
        stunPort: data.stun_port,
      },
    };

    return config;
  } catch (e) {
    console.error('[CloudRegistry] 查询异常:', e);
    return null;
  }
}

/**
 * 云端健康检查
 */
export async function cloudHealthCheck(): Promise<boolean> {
  try {
    const registryBaseUrl = getRegistryBaseUrl();
    if (!registryBaseUrl) return false;

    const response = await fetch(`${registryBaseUrl}/api/health`, {
      method: 'GET',
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[CloudRegistry] 服务正常:', data);
      return true;
    }

    return false;
  } catch (e) {
    console.error('[CloudRegistry] 健康检查失败:', e);
    return false;
  }
}
