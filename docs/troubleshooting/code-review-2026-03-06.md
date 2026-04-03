# 代码审查修复记录（2026-03-06）

**日期**: 2026-03-06
**触发**: 全项目代码审查（两轮）
**修复文件**: `services/AudioService.ts`, `hooks/useAudio.ts`, `services/wsService.ts`, `app/(tabs)/main.tsx`, `app/character-manager.tsx`, `packages/.../ChatContainer.native.tsx`

---

## 第一轮：代码质量修复

### 1. audioService 返回值始终是 null

**文件**: `hooks/useAudio.ts`
**问题**: `audioService: audioServiceRef.current` 在 hook 初次渲染时为 null，effect 赋值后不触发重新渲染，外部拿到的永远是 null，`registerAudioService` 无法执行。
**修复**: 改用 `useState<AudioService | null>` 追踪实例，赋值时同步调用 `setAudioService(service)`，清理时 `setAudioService(null)`。

### 2. .catch().then() 链式调用顺序错误

**文件**: `hooks/useAudio.ts`
**问题**: `init().catch(...).then(...)` 中，catch 捕获后 Promise 变为 resolved，then 仍会执行，可能把 `isReadyRef` 设为错误状态。
**修复**: 改为 `.then(...).catch(...)`，失败时 catch 处理，成功时 then 处理，两者互斥。

### 3. P2P 模式 URL 硬编码 `ws://`

**文件**: `services/wsService.ts`
**问题**: P2P 模式 URL 写死 `ws://`，无法走 `wss://`，与标准模式的 `config.protocol` 不一致。
**修复**: 改为 `${this.config.protocol}://`，与标准模式保持一致。

### 4. 删除角色时使用旧列表快照

**文件**: `app/character-manager.tsx`
**问题**: `setCatgirls(catgirls.filter(...))` 捕获的是 useCallback 创建时的旧 catgirls，快速连续删除有竞态。
**修复**: 改为函数式更新 `setCatgirls(prev => prev.filter(...))`。

### 5. ChatContainer 滚动 timer 未清理

**文件**: `packages/.../ChatContainer.native.tsx`
**问题**: `scrollToBottom` 和展开面板的 `setTimeout` 没有保存 handle，组件卸载后 timer 仍执行。
**修复**: 新增 `scrollTimerRef` / `expandTimerRef`，设置前 clearTimeout，卸载 effect 中统一清理。

### 6. 生产环境打印敏感调试信息

**文件**: `app/(tabs)/main.tsx`
**问题**: config 对象、API 原始返回、模型 URL 等调试日志在生产环境也输出。
**修复**: 加 `__DEV__` 守卫，仅开发模式输出。

---

## 第二轮：功能性 Bug 修复

### BUG-1: 弱网下音频服务初始化永久卡死

**文件**: `services/AudioService.ts:130-143`
**问题**: 首次连接遇到 1006 断线时，`initWebSocket()` 的 Promise 既不 resolve 也不 reject，`init()` 永远卡住，语音和发消息全部失效。
**根本原因**: `onError` 对 1006 做了 early-return，跳过了 reject，而 onOpen 只在连接成功时 resolve，造成悬空 Promise。
**修复**: 1006 时调用 `resolve()`，让重连机制在后台继续，连接成功后 `onOpen → onConnectionChange(true)` 自然更新状态。

```typescript
// 修复后
if (isAbnormalClose) {
  console.log('🔌 WebSocket 中断(1006)，等待重连...');
  resolve();  // 不再挂起，让初始化继续
} else {
  reject(error);
}
```

### BUG-2: 频繁切换角色时可能崩溃

**文件**: `services/AudioService.ts:565-597`
**问题**: `destroy()` 先 fire-and-forget 调用 `stopVoiceSession()`，下一行就同步置 `this.audioService = null`，异步操作继续访问已销毁的底层资源。
**修复**: 先将成员引用保存到局部变量，立即清空类成员，在局部变量上完成异步清理。

```typescript
// 修复后：先保存，再清空成员
const audioSvc = this.audioService;
const wsSvc = this.wsService;
this.audioService = null;  // 立即清空
this.wsService = null;
audioSvc?.stopVoiceSession().catch(...);  // 在局部引用上操作
wsSvc?.close();
```

### BUG-3: 快速切换时旧 Promise 污染 isReadyRef

**文件**: `hooks/useAudio.ts:155-165`
**问题**: `service.init().then()` 没有取消机制，快速切换角色时 cleanup 先执行（isReadyRef 置 false），旧 init() 回调后续还会把 isReadyRef 设回 true。
**修复**: 在 `.then()` 和 `.catch()` 中加入 service 身份守护。

```typescript
service.init().then(() => {
  if (audioServiceRef.current !== service) return;  // 守护：跳过旧实例的回调
  if (service.isReady()) isReadyRef.current = true;
}).catch(error => {
  if (audioServiceRef.current !== service) return;
  isReadyRef.current = false;
});
```

### BUG-4: 启动时发消息用旧连接状态判断

**文件**: `app/(tabs)/main.tsx:215`
**问题**: `useEffect([isConfigLoaded])` 内部 500ms 延迟发消息用的是 `audio.isConnected`（闭包旧值），配置加载时连接未建立，500ms 后跳过发送。
**修复**: 改用 `audio.isReadyRef.current`（ref 始终最新）。

```typescript
// 修复后
setTimeout(() => {
  if (audio.isReadyRef.current) {  // 不再是 stale 的 audio.isConnected
    audio.sendMessage({ action: 'start_session', ... });
  }
}, 500);
```

### WARNING-5: 文字/语音模式切换有 500ms 竞态窗口

**文件**: `app/(tabs)/main.tsx:997-1003`
**问题**: 从语音切到文字时等 500ms 让服务器清理，期间用户可以重新开始录音，此后程序不知情，继续发 text session，15 秒超时后弹"发送失败"。
**修复**: 500ms 等待后重检 `audio.isRecording`，若已重新录音则提前 return false。

### WARNING-6: 后台恢复 timer 泄漏

**文件**: `app/(tabs)/main.tsx:101-123`
**问题**: AppState 监听中的 2 秒延迟 timer 未保存 handle，组件卸载后 timer 仍执行，修改失效的 ref。
**修复**: 新增 `appStateTimerRef`，每次设置前先 clearTimeout，cleanup 函数中清理。

### WARNING-7: P2P 配置 useMemo 依赖不完整

**文件**: `app/(tabs)/main.tsx:332`
**问题**: `useMemo(() => config.p2p, [config.p2p?.token])` 只追踪 token，p2p 从 undefined 首次变为对象时 memo 不更新，useAudio 收不到 P2P 配置。
**修复**: 改为 `[config.p2p]`，依赖整个对象。

### WARNING-8: 切换角色期间未及时屏蔽 WebSocket 错误

**文件**: `app/(tabs)/main.tsx:961`
**问题**: `isSwitchingCharacterRef.current` 只在收到服务端广播 `catgirl_switched` 后才置 true，发出切换请求到收到广播的这段时间，断线错误不会被屏蔽，用户看到误报。
**修复**: API 调用成功后立即置 `isSwitchingCharacterRef.current = true`，不等服务端广播。

---

## 相关文件

- `services/AudioService.ts` — init 生命周期、destroy 资源管理
- `hooks/useAudio.ts` — AudioService 封装、isReadyRef 守护
- `services/wsService.ts` — WebSocket 连接、P2P 协议
- `app/(tabs)/main.tsx` — 主界面状态机、角色切换流程
- `app/character-manager.tsx` — 角色管理页
- `packages/project-neko-components/src/chat/ChatContainer.native.tsx` — 聊天组件

## 参考

- [character-switch-websocket-fix.md](./character-switch-websocket-fix.md) — 角色切换 WebSocket 问题历史修复记录
