export type DevConnectionConfig = {
  host: string;
  port: number;
  characterName: string;
  // P2P 连接配置（v3: 两层回退）
  p2p?: {
    token: string;
    deviceId?: string;              // 设备 ID（用于云端查询）

    // 第1层：LAN 直连
    lanIp?: string;                 // 局域网 IP
    lanPort?: number;               // 局域网端口

    // 第2层：STUN 打洞
    stunIp?: string;                // STUN 公网 IP
    stunPort?: number;              // STUN 公网端口
  };
};

export const DEFAULT_DEV_CONNECTION_CONFIG: DevConnectionConfig = {
  host: process.env.EXPO_PUBLIC_DEV_HOST || '192.168.1.8',
  port: Number(process.env.EXPO_PUBLIC_DEV_PORT) || 48911,
  characterName: process.env.EXPO_PUBLIC_DEV_CHARACTER || 'test',
};

export function parseDevConnectionConfig(raw: string): Partial<DevConnectionConfig> | null {
  const text = raw.trim();
  if (!text) return null;

  // 1) JSON: {"host":"x","port":48911,"characterName":"test"}
  //    或 P2P 格式: {"lan_ip":"x","port":48920,"token":"xxx"}
  try {
    const obj = JSON.parse(text) as any;
    if (obj && typeof obj === 'object') {
      const out: Partial<DevConnectionConfig> = {};

      // 检测 P2P 格式（包含 lan_ip 和 token）- v3 架构：两层回退
      if (typeof obj.lan_ip === 'string' && obj.lan_ip.trim() && typeof obj.token === 'string') {
        out.host = obj.lan_ip.trim();
        out.port = typeof obj.port === 'number' ? obj.port : 48920;
        out.characterName = obj.character || obj.name || 'test';

        // v3: 完整的两层连接信息
        out.p2p = {
          token: obj.token,
          deviceId: obj.device_id,

          // 第1层：LAN 直连
          lanIp: obj.lan_ip.trim(),
          lanPort: obj.port || 48920,

          // 第2层：STUN 打洞
          stunIp: obj.stun_ip,
          stunPort: obj.stun_port,
        };
        return out;
      }

      // 普通格式
      if (typeof obj.host === 'string' && obj.host.trim()) out.host = obj.host.trim();
      if (typeof obj.port === 'number' && Number.isFinite(obj.port)) out.port = obj.port;
      if (typeof obj.characterName === 'string' && obj.characterName.trim()) out.characterName = obj.characterName.trim();
      if (typeof obj.name === 'string' && obj.name.trim()) out.characterName = obj.name.trim();
      if (Object.keys(out).length > 0) return out;
    }
  } catch {
    // ignore
  }

  // 2) URL-like: nekorn://dev?host=...&port=...&name=...
  try {
    const url = new URL(text);
    const host = (url.searchParams.get('host') || '').trim();
    const portStr = (url.searchParams.get('port') || '').trim();
    const name = (url.searchParams.get('characterName') || url.searchParams.get('name') || '').trim();
    const out: Partial<DevConnectionConfig> = {};
    if (host) out.host = host;
    if (portStr && /^\d+$/.test(portStr)) out.port = Number(portStr);
    if (name) out.characterName = name;

    // 允许直接从 URL 的 host/port 取值（如 http://1.2.3.4:48911）
    if (!out.host && url.hostname) out.host = url.hostname;
    if (out.port == null && url.port && /^\d+$/.test(url.port)) out.port = Number(url.port);

    if (Object.keys(out).length > 0) return out;
  } catch {
    // ignore
  }

  // 3) host:port 或 host:port?name=xxx
  // 允许 ws:// / http:// 前缀在这里被粗略剥离
  const stripped = text.replace(/^(ws|wss|http|https):\/\//, '');
  const parts = stripped.split('?');
  const hostPort = (parts[0] || '').trim();
  const query = (parts[1] || '').trim();
  const m = hostPort.match(/^([a-zA-Z0-9.\-]+)(?::(\d+))?$/);
  if (m) {
    const out: Partial<DevConnectionConfig> = {};
    if (m[1]) out.host = m[1];
    if (m[2]) out.port = Number(m[2]);
    if (query) {
      try {
        const q = new URLSearchParams(query);
        const name = (q.get('characterName') || q.get('name') || '').trim();
        if (name) out.characterName = name;
      } catch {
        // ignore
      }
    }
    if (Object.keys(out).length > 0) return out;
  }

  return null;
}

export function buildHttpBaseURL(config: Pick<DevConnectionConfig, 'host' | 'port'>): string {
  const host = String(config.host || '').trim();
  const port = Number(config.port);
  return `http://${host}:${port}`;
}

/**
 * 给任意 URL 追加 P2P token query 参数。
 * 非 P2P 模式（token 为空）时原样返回。
 */
export function appendP2PToken(url: string, token?: string): string {
  if (!token) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}token=${token}`;
}
