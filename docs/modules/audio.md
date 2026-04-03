# 音频服务规格 (Audio Service Spec)

## 3.1 职责
管理录音、播放状态以及通过 WebSocket 与 AI 后端进行 PCM 数据交换。

## 3.1.1 实现与依赖（2026-01-11）
- **跨平台音频&麦克风库**：`@project_neko/audio-service`
  - **React Native**：`createNativeAudioService()`（底层走 `react-native-pcm-stream`）
  - **Web**：`createWebAudioService()`（底层走 `getUserMedia + AudioWorklet`）
- **Realtime(WebSocket)**：`@project_neko/realtime`
- **主界面接入方式**：`app/(tabs)/main.tsx` → `hooks/useAudio.ts` → `services/AudioService.ts`（兼容层）→ `@project_neko/audio-service`

## 3.2 关键 API
- `startRecording()`: 
  - 启动原生录音采样 (16kHz, Mono)。
  - 缓冲区达到阈值 (512 samples/32ms) 时通过 WS 发送 `stream_data`。
- `playPCMData(arrayBuffer)`: 
  - 接收下行二进制数据入播放队列。
  - 推荐格式：PCM16LE, 48kHz, Mono。
- `clearAudioQueue()`: 即时中止播放并清空所有未播放的数据块。
- `handleUserSpeechDetection()`: 进入“用户说话”模式，通常包含自动打断 (Shut up) 逻辑。

> 当前行为说明：
> - **下行播放由 `@project_neko/audio-service` 接管**：二进制消息会在 Realtime 的 `binary` 事件里自动播放。
> - `playPCMData` 仅用于兼容旧代码路径；主链路请勿手动调用（避免双重播放）。
> - `hooks/useAudio.ts` 不对外暴露 `playPCMData`（避免误用）。

## 3.3 性能规格
- **上行延迟**：目标单位切片 < 40ms。
- **下行抖动缓冲**：由原生 `PCMStream` 处理队列。

## 3.4 生命周期注意事项（2026-03-06 修复）

### AudioService 初始化（BUG-1 修复）

`initWebSocket()` 在 1006 断线（首次连接失败）时，现在会 `resolve()` 而非挂起：

```
1006 出现
  → resolve()（初始化继续）
  → initAudioService() 正常执行（client 对象已创建）
  → 重连机制在后台自动重试
  → onOpen 触发 → onConnectionChange(true) 通知上层
```

**旧行为（已修复）**：1006 时既不 resolve 也不 reject，导致 `init()` 永久挂起，音频和发消息功能全部失效。

### destroy() 资源清理（BUG-2 修复）

`destroy()` 现在先保存局部引用再清空成员，避免 fire-and-forget 异步操作访问已销毁的实例：

```typescript
// 正确顺序：先保存，立即清空成员，再用局部引用做异步清理
const audioSvc = this.audioService;
const wsSvc = this.wsService;
this.audioService = null;
this.wsService = null;
audioSvc?.stopVoiceSession().catch(...);  // 在局部引用上完成
wsSvc?.close();
```

### useAudio isReadyRef 守护（BUG-3 修复）

`init().then()` 回调现在检查 service 身份，防止旧 Promise 在 cleanup 后污染 `isReadyRef`：

```typescript
service.init().then(() => {
  if (audioServiceRef.current !== service) return;  // 守护
  if (service.isReady()) isReadyRef.current = true;
});
```

快速切换角色时（reconnectKey 递增），旧 service 的回调不会再干扰新 service 的状态。
