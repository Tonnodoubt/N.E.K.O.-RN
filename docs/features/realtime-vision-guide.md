# N.E.K.O. 实时视觉功能使用指南

**文档版本**: v1.4
**更新日期**: 2026-03-03
**适用范围**: React Native 移动端 / Web 端

---

## 1. 功能概述

N.E.K.O. **主项目已完整支持**实时视觉功能。摄像头画面或屏幕共享可以通过 WebSocket 实时传输给 AI 角色，无需后端开发，只需在前端正确调用即可。

### 1.1 核心能力

| 功能 | 描述 | 状态 |
|------|------|------|
| **单张图片发送** | 拍照/相册选择后发送 | ✅ RN 已实现 (`services/camera.ts`) |
| **实时摄像头流** | 持续捕获并发送视频帧 | ✅ 实装方案已定（4.2节） |
| **屏幕共享** | Web 端屏幕捕获流 | ✅ Web 已实现 |

### 1.2 后端支持（已存在，无需修改）

| 模型 | 原生视觉支持 | 协议类型 | 后端代码位置 |
|------|-------------|----------|--------------|
| Qwen (通义千问) | ✅ | WebSocket | `omni_realtime_client.py:785-789` |
| GLM-4 (智谱) | ✅ | WebSocket | `omni_realtime_client.py:791-794` |
| GPT-4o Realtime | ✅ | WebSocket | `omni_realtime_client.py:795-808` |
| Gemini | ✅ | SDK 封装 | `omni_realtime_client.py:763-774` |
| 其他模型 | ❌ (自动降级到 VISION_MODEL) | HTTP | `omni_realtime_client.py:810-849` |

---

## 2. 后端功能说明（已存在）

### 2.1 图像流处理入口

**文件**: `N.E.K.O.TONG/main_logic/core.py:2211-2238`

后端已经支持通过 `stream_data` 接收 `camera` 和 `screen` 类型的图像数据：

```python
elif input_type in ['screen', 'camera']:
    image_b64 = await process_screen_data(data)
    if image_b64:
        if isinstance(self.session, OmniOfflineClient):
            await self.session.stream_image(image_b64)
        elif isinstance(self.session, OmniRealtimeClient):
            await self.session.stream_image(image_b64)
```

### 2.2 图像流传输实现

**文件**: `N.E.K.O.TONG/main_logic/omni_realtime_client.py:741-854`

`stream_image()` 方法已实现：
- 模型自适应（Qwen/GLM/GPT/Gemini）
- 速率限制（1.5s 基础间隔，空闲时 7.5s）
- 不支持原生视觉的模型自动降级到 VISION_MODEL

### 2.3 图像处理工具

**文件**: `N.E.K.O.TONG/utils/screenshot_utils.py`

- `process_screen_data()` - 验证 base64 图像数据
- `compress_screenshot()` - 压缩图像到 1080p
- `analyze_image_with_vision_model()` - VISION_MODEL 分析

---

## 3. WebSocket 协议（与主项目兼容）

### 3.1 发送单张图片（已支持）

```typescript
// 当前 RN 实现: app/(tabs)/main.tsx:980-984
audio.sendMessage({
  action: 'stream_data',
  data: base64Image,  // data:image/jpeg;base64,...
  input_type: 'camera',  // 或 'screen'
  clientMessageId,
});
```

### 3.2 持续视觉流协议

持续摄像头流**不需要**单独的 session 管理。直接复用已有的音频会话，连续发送 `stream_data` 即可，后端自动限流。

> 注意：`start_session` / `end_session` 是音频会话的生命周期管理，不是视觉流专用协议。视觉帧搭载在已有会话上发送。

**连续发送图像帧**（前端每 1.5s 发送一帧）:
```json
{
  "action": "stream_data",
  "data": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
  "input_type": "camera"
}
```

**后端限流行为**:
- 有语音活动时：最小间隔 1.5s，超频帧静默丢弃
- 无语音活动时：最小间隔 7.5s（1.5s × 5 倍），超频帧静默丢弃
- 前端无需感知限流结果，fire-and-forget 即可

---

## 4. React Native 实现指南

### 4.1 现有代码（已支持单张图片）

**文件**: `services/camera.ts`

使用 `expo-image-picker` 实现拍照功能：

```typescript
import { CameraService } from '@/services/camera';

const camera = new CameraService();
const result = await camera.takePhoto({ quality: 0.8 });
if (result) {
  // result.base64 可直接发送到后端
  const base64WithPrefix = `data:${result.mimeType};base64,${result.base64}`;
}
```

**使用位置**: `app/(tabs)/main.tsx:946-984`

### 4.2 持续摄像头流实装方案

文档 v1.2 中第4.2节提出的持续视频流方案存在设计缺陷：`expo-image-picker` 的 `takePictureAsync` 不适合连续帧捕获、缺少前端压缩和限流、未处理生命周期。以下是利用 `expo-camera` 的 `CameraView` 实现的完整方案。

**后端无需任何修改** — `stream_data` + `input_type: 'camera'` 协议已完整支持，后端 `stream_image()` 自带 VAD 自适应限流（1.5s / 7.5s）。

#### 4.2.1 架构概览

遵循项目现有的 **Service → Hook → Component** 三层模式：

```
CameraStreamService (业务逻辑)
  ↓
useCameraStream Hook (React 生命周期)
  ↓
CameraStreamOverlay (PiP 预览 UI)  +  main.tsx (集成)
```

**数据流**：

```
CameraView.takePictureAsync()
  → ImageCompressionService.compress() (单次 720p, quality 0.7)
  → audio.sendMessage({ action: 'stream_data', data: base64, input_type: 'camera' })
  → WSService → 后端 core.py → stream_image() → LLM
```

#### 4.2.2 新建文件（3个）

**1. services/CameraStreamService.ts**

核心流式服务，纯业务逻辑，无 React 依赖。

```typescript
export type CameraStreamStatus = 'idle' | 'streaming' | 'paused' | 'error';

export interface CameraStreamConfig {
  sendFrame: (payload: object) => void;       // 来自 audio.sendMessage
  isConnected: () => boolean;                  // WS 连接检查
  onStatusChange?: (status: CameraStreamStatus) => void;
  onError?: (error: Error) => void;
  frameInterval?: number;                      // 默认 1500ms
}
```

**关键实现**：

- `setCameraRef(ref)` — 绑定 CameraView ref
- `start()` — 启动帧捕获循环，首帧延迟约 500ms 以提升 CameraView 启动稳定性
- `stop()` — 清除 interval，状态回到 `idle`
- `pause()` / `resume()` — 后台暂停/恢复
- `captureAndSend()` — 内部方法：
  - `isCapturing` 互斥锁防止重叠（上一帧压缩未完成时跳过）
  - 检查 `isConnected()` — WS 断开时跳过（不浪费 CPU）
  - `takePictureAsync({ base64: true, quality: 0.7, shutterSound: false })`
  - `ImageCompressionService.compress(uri, { quality: 0.7, maxWidth: 1280, maxHeight: 720 })` — 单次压缩，不用 `smartCompress` 的 5 轮迭代
  - `sendFrame({ action: 'stream_data', data: compressed.base64, input_type: 'camera' })`
  - `compress()` 返回的 base64 自带 `data:image/jpeg;base64,` 前缀，与后端 `process_screen_data()` 期望格式一致

**2. hooks/useCameraStream.ts**

React Hook，遵循 `useCamera` / `useAudio` 模式。

```typescript
export interface UseCameraStreamConfig {
  sendMessage: (message: object) => void;
  isConnected: boolean;
  isInBackgroundRef: React.RefObject<boolean>;
}

export interface UseCameraStreamReturn {
  isStreaming: boolean;               // streaming 或 paused 均为 true
  shouldShowCamera: boolean;          // 控制 CameraView 渲染
  status: CameraStreamStatus;
  error: string | null;
  cameraRef: React.RefObject<CameraView>;
  toggleStreaming: () => Promise<void>;
  onCameraReady: () => void;          // 绑定到 CameraView 的 onCameraReady
  hasPermission: boolean | null;
}
```

**关键逻辑**：

- **权限管理**：`useCameraPermissions()` 自动请求，拒绝时 Alert 引导去设置
- **两阶段启动**：`toggleStreaming` 设置 `shouldShowCamera=true` → React 渲染 CameraView → `onCameraReady` 回调中 `setCameraRef` + `start()`（解决 ref 必须在 mount 后才可用的时序问题）
- **AppState 响应**：轮询 `isInBackgroundRef`（复用 `main.tsx` 已有的 AppState 监听），后台时 `pause()`，回前台时 `resume()`
- **WS 断连处理**：`useEffect` 监听 `isConnected`，断连时 `stop()`（完全停止，非暂停 — 重连后需手动重新开启）
- 使用 ref 模式 (`sendMessageRef.current = config.sendMessage`) 避免闭包过期

**3. components/CameraStreamOverlay.tsx**

PiP 摄像头预览浮层。

```
+----------+
| 📹 Preview|   120×120, borderRadius: 12
| [●] [✕]  |   左上角状态点 + 右上角关闭按钮
+----------+
```

- **位置**：`position: absolute, top: 60, left: 12, zIndex: 1500`
- **边框**：`2px solid rgba(64, 197, 241, 0.8)` (品牌色)
- **状态点**：绿色=`streaming` / 黄色=`paused` / 红色=`error`
- **动画**：`Animated.timing` fade in/out 200ms（遵循 VoicePrepareOverlay 模式）
- `CameraView facing="front", animateShutter={false}`
- 传入 `onCameraReady` 回调触发两阶段启动

#### 4.2.3 修改现有文件（2个）

**4. app/(tabs)/main.tsx**

**(a) 导入 (顶部)**

```typescript
import { useCameraStream } from '@/hooks/useCameraStream';
import { CameraStreamOverlay } from '@/components/CameraStreamOverlay';
```

**(b) 初始化 hook (在 useAudio 之后)**

```typescript
const cameraStream = useCameraStream({
  sendMessage: audio.sendMessage,
  isConnected: audio.isConnected,
  isInBackgroundRef,
});
```

**(c) 替换 toolbarScreenEnabled 状态 (line 220)**

- 删除 `const [toolbarScreenEnabled, setToolbarScreenEnabled] = useState(false);`
- 把 toolbar 的 `cameraEnabled` prop 接到 `cameraStream.isStreaming`

**(d) 重写 handleToggleScreen (line 772-775)**

```typescript
const handleToggleScreen = useCallback(async (_next: boolean) => {
  await cameraStream.toggleStreaming();
}, [cameraStream.toggleStreaming]);
```

**(e) 在 JSX 中渲染 overlay (toolbar View 后面)**

```tsx
<CameraStreamOverlay
  visible={cameraStream.shouldShowCamera}
  cameraRef={cameraStream.cameraRef}
  onCameraReady={cameraStream.onCameraReady}
  status={cameraStream.status}
  onClose={cameraStream.toggleStreaming}
/>
```

**(f) handleGoodbye 中停止流 (line 777-787)**

```typescript
if (cameraStream.isStreaming) {
  cameraStream.toggleStreaming();
}
```

**5. app.json — 相机权限说明**

```diff
- "cameraPermission": "允许 N.E.K.O.-RN 使用相机扫描二维码进行开发配置"
+ "cameraPermission": "允许 N.E.K.O.-RN 使用相机进行扫码配置和实时视觉功能"
```

iOS `NSCameraUsageDescription` 也做同样更新。

#### 4.2.4 不需修改的文件

| 文件 | 原因 |
|------|------|
| `services/camera.ts` | 单张拍照功能，与流式无关 |
| `services/imageCompression.ts` | 直接复用 `compress()` 方法，无需改动 |
| `services/AudioService.ts` | 通过 hook 层的 `sendMessage` 消费 |
| `hooks/useCamera.ts` | 单张拍照 hook，保持独立 |
| `packages/project-neko-components/` | toolbar 已统一为 `cameraEnabled` / `onToggleCamera` props |
| 后端所有文件 | 协议和限流完全兼容 |

#### 4.2.5 实现顺序

1. **Step 1**: `services/CameraStreamService.ts` (无依赖)
2. **Step 2**: `components/CameraStreamOverlay.tsx` (无依赖)
3. **Step 3**: `hooks/useCameraStream.ts` (依赖 Step 1)
4. **Step 4**: `app/(tabs)/main.tsx` 集成 (依赖 Step 2, 3)
5. **Step 5**: `app.json` 权限文案 (独立)

### 4.3 图像压缩服务

**文件**: `services/imageCompression.ts`（已存在）

```typescript
import { ImageCompressionService } from '@/services/imageCompression';

const compression = new ImageCompressionService();
const compressed = await compression.smartCompress(imageUri, 500 * 1024); // 最大 500KB
```

---

## 5. 配置说明（主项目已配置）

### 5.1 VISION_MODEL 配置

**文件**: `N.E.K.O.TONG/config/api_providers.json`

```json
{
  "vision": {
    "model": "qwen-vl-max",
    "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "api_key": "your-api-key"
  }
}
```

### 5.2 图像速率限制配置

**文件**: `N.E.K.O.TONG/config/__init__.py:152-155`

```python
NATIVE_IMAGE_MIN_INTERVAL = 1.5      # 基础间隔（秒）
IMAGE_IDLE_RATE_MULTIPLIER = 5       # 空闲时倍数（1.5 * 5 = 7.5s）
```

---

## 6. 使用流程

### 6.1 单张图片发送（当前实现）

```
用户点击拍照/相册按钮
        ↓
ImagePicker 选择图片
        ↓
添加 data: 前缀生成完整 base64
        ↓
发送 stream_data (input_type='camera')
        ↓
后端 core.py:2211 接收
        ↓
omni_realtime_client.stream_image() 发送到 LLM
        ↓
LLM 基于图像生成回复
```

### 6.2 持续视频流

```
用户点击工具栏"屏幕分享"按钮
        ↓
toggleStreaming() 设置 shouldShowCamera = true
        ↓
React 渲染 CameraStreamOverlay + CameraView
        ↓
onCameraReady 回调触发 → setCameraRef + start()
        ↓
定时启动 (每 1.5s) + 首帧延迟约 500ms
        ↓
takePictureAsync() → ImageCompressionService.compress()
        ↓
sendMessage({ action: 'stream_data', input_type: 'camera' })
        ↓
后端自动限流 → stream_image() → LLM
        ↓
用户再次点击按钮或 PiP 上的 ✕ → stop() → 预览消失
```

---

## 7. 关键代码引用

### 后端（N.E.K.O.TONG - 已存在）

| 功能 | 文件路径 | 行号范围 |
|------|----------|----------|
| stream_data 路由 | `main_logic/core.py` | L1947-2238 |
| camera/screen 处理 | `main_logic/core.py` | L2211-2238 |
| 图像流传输 | `main_logic/omni_realtime_client.py` | L741-854 |
| 图像处理工具 | `utils/screenshot_utils.py` | L20-249 |
| 速率限制配置 | `config/__init__.py` | L152-155 |
| VISION_MODEL 配置 | `config/api_providers.json` | vision 字段 |

### 前端（N.E.K.O.-RN - 已部分实现）

| 功能 | 文件路径 | 状态 |
|------|----------|------|
| 相机服务 | `services/camera.ts` | ✅ 已支持单张 |
| 图像压缩 | `services/imageCompression.ts` | ✅ 已存在 |
| 消息发送 | `app/(tabs)/main.tsx:980-984` | ✅ 已支持 |
| 持续流服务 | `services/CameraStreamService.ts` | ✅ 实装方案已定 |
| 流式 Hook | `hooks/useCameraStream.ts` | ✅ 实装方案已定 |
| PiP 预览 | `components/CameraStreamOverlay.tsx` | ✅ 实装方案已定 |

---

## 8. 验证方案

### 8.1 基本功能验证

| 测试项 | 操作步骤 | 预期结果 |
|--------|----------|----------|
| **启动流** | 点击工具栏"屏幕分享"按钮 | PiP 预览出现，绿色状态点闪烁，后端日志显示 🖼️ 收到图像帧 |
| **AI 回应** | 流运行中，对准物体说话 | AI 基于画面内容生成回应 |
| **关闭流** | 再次点击按钮或 PiP 上的 ✕ | 预览消失，帧传输停止 |

### 8.2 边界场景验证

| 测试项 | 操作步骤 | 预期结果 |
|--------|----------|----------|
| **后台暂停** | 流式进行中切到后台 | 状态变 `paused`（黄色状态点），回到前台自动恢复（绿色） |
| **WS 断连** | 断开 WiFi | 流自动停止，重连后需手动重新开启 |
| **权限拒绝** | 首次启动时拒绝相机权限 | Alert 引导去设置，流不启动 |
| **Goodbye** | 流运行时点击告别按钮 | mic 和视觉流同时停止 |

### 8.3 性能指标

- **帧间隔**: 1.5s（与后端 `NATIVE_IMAGE_MIN_INTERVAL` 对齐）
- **图像尺寸**: 1280×720 压缩后 ~50-100KB
- **互斥锁**: 上一帧压缩未完成时跳过，防止重叠
- **后台轮询**: 复用 `main.tsx` 已有的 `AppState` 监听，无额外开销

---

## 9. 已知问题与改进方向

### 9.1 JS 线程阻塞问题（关键）

**问题描述**：
在 React Native 中启用实时摄像头流后，AI 语音播放会出现卡顿或中断。这是因为 RN 的 JavaScript 线程是**单线程**，而 `expo-camera` 的 `takePictureAsync({ base64: true })` 会阻塞主线程。

**根本原因分析**：
1. **后端（Python）**：使用 `asyncio` + `run_in_executor()` 将耗时操作（如图像压缩）放到线程池，不阻塞事件循环
2. **前端（React Native）**：JS 是单线程，`takePictureAsync` 的 base64 编码在原生层执行，但返回大量数据到 JS 时会阻塞线程
3. **冲突**：拍照/编码阻塞期间，音频播放（依赖 JS 线程回调）被挂起

**尝试过的解决方案**：

| 方案 | 实现 | 结果 | 原因 |
|------|------|------|------|
| 降低帧率 | 1.5s → 10s → 15s | ❌ 仍卡顿 | 阻塞发生在每次拍照时，不是频率问题 |
| 降低图片质量 | quality 0.7 → 0.4 → 0.1 | ❌ 仍卡顿 | 即使 10% 质量，base64 转换仍阻塞 |
| 分片执行 | `setTimeout` 每步间插入 50-100ms 延迟 | ❌ 仍卡顿 | `takePictureAsync` 本身是原子操作，无法拆分 |
| `requestAnimationFrame` | 让出主线程 | ❌ 无效 | RAF 在下一帧执行，但拍照耗时 >16ms |

**根本解决方案**（需后续实现）：

| 方案 | 复杂度 | 可行性 | 说明 |
|------|--------|--------|------|
| **原生模块** | 高 | ✅ 推荐 | 创建 TurboModule/Expo Module，在原生线程（Swift/Kotlin）完成拍照+压缩，通过异步事件返回结果 |
| **react-native-worklets-core** | 中 | ⚠️ 需调研 | 在 Worklet 线程执行拍照逻辑，但不确定是否支持 CameraView |
| **JSI (JavaScript Interface)** | 高 | ⚠️ 需新架构 | RN 新架构支持同步调用原生代码不阻塞 JS，但需完整迁移到新架构 |
| **改为手动发送** | 低 | ✅ 备选 | 放弃自动流，用户点击拍照按钮时发送单张，避免后台持续阻塞 |

**原生模块方案设计**：

```typescript
// 目标 API
import { CameraFrameCapture } from './modules/CameraFrameCapture';

// 原生线程异步拍照，不阻塞 JS
const result = await CameraFrameCapture.captureFrame({
  facing: 'front',
  quality: 0.5,
  maxWidth: 1280,
});

// result.base64 通过异步事件返回
sendMessage({
  action: 'stream_data',
  data: result.base64,
  input_type: 'camera',
});
```

**参考实现**：
- iOS: 使用 `AVCaptureSession` + `DispatchQueue.global(qos: .background)`
- Android: 使用 `CameraX` + `Dispatchers.IO`
- 数据传递: 原生层完成 base64 编码后，通过 `EventEmitter` 异步发送给 JS

### 9.2 其他已知问题

| 问题 | 状态 | 说明 |
|------|------|------|
| PiP 预览窗口 | ✅ 已移除 | 改为后台无预览模式，避免干扰用户 |
| 快门动画闪烁 | ✅ 已修复 | 添加 `animateShutter={false}` |
| 摄像头内容显示在屏幕上 | ✅ 已修复 | CameraView 移到屏幕外 `left: -9999` |

---

## 10. 调试日志

### 前端
```typescript
console.log('📷 捕获帧:', { width, height, size: base64.length });
console.log('📤 发送图像帧');
```

### 后端
```python
logger.info(f"🖼️ 收到图像帧: {len(image_b64)} bytes")
logger.info(f"📤 发送到 LLM: {model}")
logger.info(f"⏱️ 图像速率限制: 跳过帧 (间隔太短)")
```

---

## 10. 更新记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.4 | 2026-03-03 | 新增第 9 节「已知问题与改进方向」，记录 JS 线程阻塞问题及解决方案调研结果 |
| v1.3 | 2026-03-03 | 重写 4.2 节，提供完整的 CameraView 实装方案（Service → Hook → Component） |
| v1.2 | 2026-03-03 | 文档版本升级，标记旧 4.2 方案存在设计缺陷 |
| v1.1 | 2026-03-03 | 重写文档，强调复用主项目现有功能 |
| v1.0 | 2026-03-02 | 初始版本（已过时，包含错误指导） |
