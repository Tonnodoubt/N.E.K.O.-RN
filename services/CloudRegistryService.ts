/**
 * 云端设备查询服务
 *
 * 用于从云端注册服务查询设备信息（阅后即焚）
 */

import { DevConnectionConfig } from '@/utils/devConnectionConfig';

const CLOUD_REGISTRY_URL = 'http://47.117.174.64:8000';

export type CloudDeviceInfo = {
  device_id: string;
  lan_ip: string;
  token: string;
  stun_ip?: string;
  stun_port?: number;
  frp_ip?: string;
  frp_port?: number;
  character?: string;
  created_at: number;
};

/**
 * 从云端查询设备信息
 * @param deviceId 设备 ID
 * @returns 设备配置或 null
 */
export async function queryDeviceInfo(deviceId: string): Promise<DevConnectionConfig | null> {
  try {
    console.log(`[CloudRegistry] 查询设备: ${deviceId}`);

    const response = await fetch(
      `${CLOUD_REGISTRY_URL}/api/lookup?device_id=${encodeURIComponent(deviceId)}`,
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
    console.log('[CloudRegistry] 查询成功:', data);

    // 转换为 DevConnectionConfig 格式
    const config: DevConnectionConfig = {
      host: data.lan_ip,
      port: data.stun_port || 48920,
      characterName: data.character || 'test',
      p2p: {
        token: data.token,
        deviceId: data.device_id,

        // 第1层：LAN 直连
        lanIp: data.lan_ip,
        lanPort: data.stun_port || 48920,

        // 第2层：STUN 打洞
        stunIp: data.stun_ip,
        stunPort: data.stun_port,

        // 第3层：FRP 中转
        frpIp: data.frp_ip,
        frpPort: data.frp_port,
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
    const response = await fetch(`${CLOUD_REGISTRY_URL}/api/health`, {
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
