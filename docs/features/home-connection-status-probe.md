# 首页服务器连接状态

## 问题描述

首页"服务器连接"卡片存在两个硬编码问题：

1. **状态永远显示"就绪"**：状态指示灯与文字不反映实际连接情况
2. **断开时仍显示实际 IP**：用户尚未建立连接时，卡片仍展示上次保存的 host:port，造成"已连接"的错误预期

## 解决方案

### 机制概述

基于 WebSocket 实际连接状态（被动订阅）而非 HTTP 主动探测。`main.tsx` 的 WebSocket 建立/断开时调用 `sessionStore.set(connected)`，`index.tsx` 订阅该 store 并实时更新 UI。

```text
main.tsx（onConnectionChange 回调）
  └─ sessionStore.set(connected)
       └─ 通知所有订阅者
            └─ index.tsx setIsConnected → 重新渲染
```

### 优势

| 维度 | WebSocket 被动订阅（当前方案） |
|------|-------------------------------|
| 触发时机 | WebSocket 连接/断开时立即更新，零延迟 |
| 额外请求 | 无 |
| 中间态 | 无（只有"就绪"与"未连接"两态） |
| 实现复杂度 | 低（简单 pub/sub，无 AbortController / 轮询） |
| 准确性 | 与实际 WebSocket 状态完全同步 |

### 状态定义

| 状态 | 圆点颜色 | 文字 | IP 显示 |
|------|---------|------|---------|
| `true`（已连接） | `#40c5f1`（蓝色） | 就绪 | `isUserConfigured = true` 时显示 |
| `false` + 已配置 | `#ff4d4d`（红色） | 未连接 | **不显示**，显示"已配置，等待连接…" |
| `false` + 未配置 | `#ff4d4d`（红色） | 未连接 | **不显示**，显示引导文字 |

IP 的显示条件为 `isUserConfigured && isConnected`（三态）：
- `!isUserConfigured`：显示引导文字"扫码或手动配置以连接"
- `isUserConfigured && !isConnected`：显示"已配置，等待连接…"（已保存配置，但 WebSocket 尚未建立）
- `isUserConfigured && isConnected`：显示实际 `host:port`

## 核心代码位置

| 文件 | 职责 |
|------|------|
| `utils/sessionStore.ts` | 模块级 pub/sub store |
| `app/(tabs)/main.tsx` | 写入：`onConnectionChange` 调用 `sessionStore.set()` |
| `app/(tabs)/index.tsx` | 读取：订阅 store，更新 UI |
| `services/DevConnectionStorage.ts` | `hasUserStoredConfig()` 判断是否配置过 |

## 关键改动

### 1. `utils/sessionStore.ts`（新增文件）

```typescript
/**
 * 全局 WebSocket 会话状态（纯内存，App 重启自动重置为 false）。
 * main.tsx 在 WebSocket 连接/断开时调用 set()；
 * 其他页面（如 index.tsx）通过 subscribe() 被动监听。
 */
type Listener = (connected: boolean) => void;

let _connected = false;
const _listeners = new Set<Listener>();

export const sessionStore = {
  get isConnected(): boolean {
    return _connected;
  },

  set(connected: boolean): void {
    if (_connected === connected) return;
    _connected = connected;
    _listeners.forEach((l) => { l(connected); });
  },

  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
```

### 2. `app/(tabs)/main.tsx`：写入 store

```typescript
import { sessionStore } from '@/utils/sessionStore';

// useAudio 的 onConnectionChange 回调中，首行加入：
onConnectionChange: (connected) => {
  sessionStore.set(connected);
  // ... 原有逻辑不变
}
```

### 3. `app/(tabs)/index.tsx`：订阅 store

```typescript
import { useEffect, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { sessionStore } from '@/utils/sessionStore';
import { hasUserStoredConfig } from '@/services/DevConnectionStorage';

type ConnectionStatus = 'online' | 'offline';

const STATUS_MAP: Record<ConnectionStatus, { color: string; text: string }> = {
  online:  { color: '#40c5f1', text: '就绪' },
  offline: { color: '#ff4d4d', text: '未连接' },
};

export default function HomeScreen() {
  const { config, isLoaded, reload } = useDevConnectionConfig();
  const isFocused = useIsFocused();

  const [isConnected, setIsConnected] = useState(sessionStore.isConnected);
  const [isUserConfigured, setIsUserConfigured] = useState(false);

  // 订阅 WebSocket 连接状态变化（返回值即 unsubscribe，作为 cleanup）
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
  // ...
}
```

### 4. 条件渲染

```tsx
<View style={styles.statusIndicator}>
  <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
  <Text style={[styles.statusText, { color: statusColor }]}>{statusText}</Text>
</View>

{showIp ? (
  <Text style={styles.configValue}>{config.host}:{config.port}</Text>
) : isUserConfigured ? (
  <Text style={styles.configValueOffline}>已配置，等待连接…</Text>
) : (
  <Text style={styles.configValueOffline}>扫码或手动配置以连接</Text>
)}
```

## 行为说明

- **首次打开（从未扫码/配置）**：`isUserConfigured = false`，IP 位置始终显示引导文字；`sessionStore.isConnected = false` → 显示"未连接"
- **WebSocket 建立连接**：`onConnectionChange(true)` → `sessionStore.set(true)` → 首页立即更新为"就绪"，若已配置则显示 IP
- **WebSocket 断开**：`onConnectionChange(false)` → `sessionStore.set(false)` → 首页立即切换为"未连接"，IP 隐藏
- **扫码后进入主页面，再切换回首页**：`useIsFocused` 触发 `hasUserStoredConfig` 重新读取，`isUserConfigured` 正确更新；store 中保留最新的连接状态，首页直接读取 `sessionStore.isConnected` 初始值，无需重新探测

---

## 废弃方案：HTTP 主动探测

> **状态：已废弃**（经历多次迭代后放弃，改用 WebSocket 被动订阅）

### 可行性复查（2026-03-06）

针对"废弃方案现在能否实现"做逐条核查：

| 原废弃原因 | 当前状态 |
|-----------|---------|
| ① 探测端点选错（`/api/config/preferences` → 404） | ✅ **已解决**：`main_server.py` 确认有 `/health` 端点（line 574） |
| ② "检测中…"中间态 | ❌ **仍然存在**：HTTP 探测本身有等待窗口 |
| ③ 每次进入首页额外发起网络请求 | ❌ **仍然存在**：设计缺陷 |
| ④ `router.replace` 后 `useIsFocused` 触发时机不稳定 | ❌ **仍然存在**：`qr-scanner.tsx` 仍然使用 `router.replace` 跳转 |
| ⑤ `timedOut` abort bug | ⚠️ **可修复**：可用更规范的 abort 写法绕过 |

**结论**：技术上可落地（端点问题已解决，abort bug 可修复），但②③④ 三个根本缺陷仍然存在。当前 WebSocket 被动订阅方案已完整实现，在零延迟、零额外请求、无中间态三个维度全面优于 HTTP 探测，**不建议回退**。

### 废弃原因

1. **端点选错**：最初探测 `/api/config/preferences`，该端点仅在 `monitor.py`（端口 48913）存在，而 LAN 代理转发目标是 `main_server.py`（端口 48911），导致始终返回 404 → 始终显示"未连接"
2. **即使改为 `/health`**，HTTP 探测仍存在以下问题：
   - 有"检测中..."中间态，体验不如实时同步
   - 每次进入首页/返回都额外发起网络请求
   - `useIsFocused` / `useFocusEffect` 在 `router.replace` 后触发时机不稳定
   - 超时中止 bug（`timedOut` 标志）需要额外处理

### 探测方案回顾

```typescript
// ❌ 废弃：HTTP 主动探测
const checkConnection = useCallback(async () => {
  const ac = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; ac.abort(); }, 3000);
  try {
    const freshConfig = await getStoredDevConnectionConfig();
    const base = buildHttpBaseURL(freshConfig);
    // /health 是 main_server.py 中唯一可用的探测端点
    const url = appendP2PToken(`${base}/health`, freshConfig.p2p?.token);
    const res = await fetch(url, { signal: ac.signal, method: 'HEAD' });
    clearTimeout(timeout);
    setConnectionStatus(res.ok ? 'online' : 'offline');
  } catch {
    clearTimeout(timeout);
    if (!ac.signal.aborted || timedOut) setConnectionStatus('offline');
  }
}, []);
```

---

## 变更记录

| 日期 | 变更内容 | 作者 |
|------|---------|------|
| 2026-03-05 | 设计：首页连接状态实时探测方案（HTTP 主动探测） | Claude |
| 2026-03-06 | 重写：新增断开时隐藏 IP、isUserConfigured 标志、10s 轮询 | Claude |
| 2026-03-06 | 修复：探测条件改为 `res.ok`，修复超时 bug（timedOut 标志），改用 `useIsFocused` + `useEffect` | Claude |
| 2026-03-06 | 修复：探测端点从 `/api/config/preferences` 改为 `/health`（前者仅在 monitor.py 端口 48913 存在，代理转发后得 404） | Claude |
| 2026-03-06 | 重构（当前方案）：放弃 HTTP 探测，改为 WebSocket 被动订阅。新增 `utils/sessionStore.ts`，`main.tsx` 写入，`index.tsx` 订阅，实现零延迟、零额外请求的状态同步 | Claude |
| 2026-03-07 | 修复：useEffect 加入 `isFocused` 依赖，扫码/配置后返回首页立即更新；IP 显示改为三态（已连接/已配置未连接/未配置）；sessionStore forEach Biome lint | Claude |
