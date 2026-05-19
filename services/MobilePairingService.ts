import { type DevConnectionConfig } from '@/utils/devConnectionConfig';

type PairingPayload = NonNullable<NonNullable<DevConnectionConfig['p2p']>['pairing']>;

type PairingResult =
  | { ok: true; config: DevConnectionConfig; registered?: boolean; resolved?: boolean }
  | { ok: false; error: string };

const DEFAULT_REGISTER_PATH = '/pairing/register';
const DEFAULT_RESOLVE_PATH = '/pairing/resolve';

function normalizePath(path: string | undefined, fallback: string): string {
  if (!path || !path.startsWith('/')) return fallback;
  return path;
}

function buildBaseUrl(config: DevConnectionConfig): string {
  const host = config.p2p?.lanIp || config.host;
  const port = config.p2p?.lanPort || config.port;
  return `http://${host}:${port}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

function pickString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function isPrivateIpv4(host: string | undefined): boolean {
  if (!host) return false;
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }
  const [first, second] = parts;
  return first === 10 || (first === 172 && second >= 16 && second <= 31) || (first === 192 && second === 168);
}

function isLocalCleartextHost(host: string | undefined): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || isPrivateIpv4(host);
}

function assertPairingTransportAllowed(config: DevConnectionConfig): PairingResult | null {
  const host = config.p2p?.lanIp || config.host;
  if (isLocalCleartextHost(host)) return null;
  return { ok: false, error: 'Pairing over public HTTP is not allowed. Use HTTPS or scan a local-network QR code.' };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function configFromInfo(
  current: DevConnectionConfig,
  info: Record<string, unknown>,
  pairing?: PairingPayload,
): DevConnectionConfig | null {
  const lanIp = pickString(info.lan_ip);
  const token = pickString(info.token);
  if (!lanIp || !token) return null;

  const port = pickNumber(info.port) || 48920;
  const currentLanIp = current.p2p?.lanIp || current.host;
  const keepPublicHost = isPrivateIpv4(lanIp) && currentLanIp && !isPrivateIpv4(currentLanIp);
  const host = keepPublicHost ? currentLanIp : lanIp;
  const hostPort = keepPublicHost ? (current.p2p?.lanPort || current.port || port) : port;
  const characterName = pickString(info.character) || current.characterName || 'test';
  const deviceId = pickString(info.device_id) || current.p2p?.deviceId;
  const pairingRegisterPath =
    pickString(info.pairing_register_path) || current.p2p?.pairingRegisterPath;
  const pairingResolvePath =
    pickString(info.pairing_resolve_path) || current.p2p?.pairingResolvePath;

  return {
    ...current,
    host,
    port: hostPort,
    characterName,
    p2p: {
      ...(current.p2p || {}),
      token,
      deviceId,
      lanIp: host,
      lanPort: hostPort,
      stunIp: pickString(info.stun_ip) || current.p2p?.stunIp,
      stunPort: pickNumber(info.stun_port) || current.p2p?.stunPort,
      pairingSupported: info.pairing_supported === true || current.p2p?.pairingSupported,
      pairingRegisterPath,
      pairingResolvePath,
      pairing,
    },
  };
}

export async function registerMobilePairing(config: DevConnectionConfig): Promise<PairingResult> {
  if (!config.p2p?.token || !config.p2p.pairingSupported) {
    return { ok: false, error: 'Pairing is not supported by this QR payload' };
  }
  const transportError = assertPairingTransportAllowed(config);
  if (transportError) return transportError;

  const registerPath = normalizePath(config.p2p.pairingRegisterPath, DEFAULT_REGISTER_PATH);
  const url = `${buildBaseUrl(config)}${registerPath}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Proxy-Token': config.p2p.token,
        },
        body: JSON.stringify({
          client_name: 'N.E.K.O. RN',
          client_device_id: config.p2p.deviceId || '',
        }),
      },
      4000,
    );

    if (!response.ok) {
      return { ok: false, error: `Pairing register failed: HTTP ${response.status}` };
    }

    const payload: unknown = await response.json();
    if (!isObject(payload) || payload.success !== true || !isObject(payload.pairing)) {
      return { ok: false, error: 'Pairing register returned an invalid payload' };
    }

    const pairingId = pickString(payload.pairing.pairing_id);
    const pairingSecret = pickString(payload.pairing.pairing_secret);
    if (!pairingId || !pairingSecret) {
      return { ok: false, error: 'Pairing register did not return credentials' };
    }

    const pairing: PairingPayload = {
      pairingId,
      pairingSecret,
      deviceId: pickString(payload.pairing.device_id) || config.p2p.deviceId,
      createdAt: Date.now(),
    };
    const next = configFromInfo(config, payload, pairing);
    if (!next) return { ok: false, error: 'Pairing register returned incomplete connection info' };

    return { ok: true, config: next, registered: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function resolveMobilePairing(config: DevConnectionConfig): Promise<PairingResult> {
  const pairing = config.p2p?.pairing;
  if (!pairing?.pairingId || !pairing.pairingSecret) {
    return { ok: false, error: 'No stored pairing credentials' };
  }
  const transportError = assertPairingTransportAllowed(config);
  if (transportError) return transportError;

  const resolvePath = normalizePath(config.p2p?.pairingResolvePath, DEFAULT_RESOLVE_PATH);
  const url = `${buildBaseUrl(config)}${resolvePath}`;

  try {
    const response = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pairing_id: pairing.pairingId,
          pairing_secret: pairing.pairingSecret,
          client_name: 'N.E.K.O. RN',
          client_device_id: pairing.deviceId || config.p2p?.deviceId || '',
        }),
      },
      2500,
    );

    if (!response.ok) {
      return { ok: false, error: `Pairing resolve failed: HTTP ${response.status}` };
    }

    const payload: unknown = await response.json();
    if (!isObject(payload) || payload.success !== true) {
      return { ok: false, error: 'Pairing resolve returned an invalid payload' };
    }

    const next = configFromInfo(config, payload, {
      ...pairing,
      deviceId: pickString((payload.pairing as Record<string, unknown> | undefined)?.device_id)
        || pairing.deviceId
        || config.p2p?.deviceId,
    });
    if (!next) return { ok: false, error: 'Pairing resolve returned incomplete connection info' };

    return { ok: true, config: next, resolved: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
