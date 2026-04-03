# 摄像头资源共享方案

## 概述

本文档分析 N.E.K.O RN 项目中摄像头资源的使用场景、潜在冲突，并提出解决方案。

## 背景

移动端摄像头是**独占资源**，同一时间只能有一个组件/功能占用。当前项目中存在多个使用摄像头的功能，缺乏统一的协调机制，可能导致运行时冲突和用户体验问题。

---

## 当前使用场景

### 1. 视频流传输（Video Stream）

| 属性 | 值 |
|------|-----|
| **位置** | `app/(tabs)/main.tsx` |
| **实现** | `CameraView` (expo-camera) |
| **摄像头** | 前置/后置（用户可选） |
| **触发时机** | 语音对话时用户主动开启 |
| **渲染方式** | 隐藏组件（`left: -9999`），无预览界面 |
| **相关文件** | `hooks/useCameraStream.ts`, `services/CameraStreamService.ts` |

```typescript
// 当前实现：CameraView 始终挂载（如果有权限）
{cameraStream.hasPermission && (
  <CameraView
    ref={cameraStream.cameraRef}
    style={{ position: 'absolute', left: -9999, ... }}
    facing={cameraStream.facing}
    onCameraReady={cameraStream.onCameraReady}
  />
)}
```

### 2. QR 码扫描

| 属性 | 值 |
|------|-----|
| **位置** | `app/qr-scanner.tsx` |
| **实现** | `CameraView` (expo-camera) |
| **摄像头** | 后置（固定） |
| **触发时机** | 用户导航到 QR 扫描页面 |
| **渲染方式** | 全屏预览 |

### 3. 拍照功能

| 属性 | 值 |
|------|-----|
| **位置** | `ChatContainer.native.tsx` → `hooks/useCamera.ts` |
| **实现** | `expo-image-picker` (launchCameraAsync) |
| **摄像头** | 系统相机界面 |
| **触发时机** | 聊天中点击拍照按钮 |
| **渲染方式** | 系统相机全屏界面 |

---

## 核心问题：多模态输入冲突

> **这是当前最关键的问题** —— 开启摄像头分享后，语音对话功能无法正常工作。

### 问题表现

用户在语音对话时开启摄像头分享，AI 不再响应语音输入，或者响应异常。

### 根本原因分析

#### 1. WebSocket 消息协议冲突

音频流和摄像头流使用**同一个 WebSocket 连接**，发送格式相似但内容不同的消息：

```typescript
// 音频流 - 高频率（约 100ms/帧）
{
  action: "stream_data",
  data: number[],      // PCM 音频采样数据
  input_type: "audio"
}

// 摄像头流 - 低频率（10-15s/帧）
{
  action: "stream_data",
  data: "data:image/jpeg;base64,...",  // Base64 编码的图片
  input_type: "camera"
}
```

#### 2. 后端可能的行为

| 可能行为 | 影响 |
|---------|-----|
| **切换会话模式** | 收到 `input_type: "camera"` 后，后端可能切换到"视觉理解模式"，暂停处理音频输入 |
| **处理队列阻塞** | 大体积图片帧可能阻塞消息处理队列，导致音频消息延迟或丢失 |
| **状态机重置** | 某些后端实现在收到新类型输入时可能重置内部状态 |

#### 3. JS 线程阻塞

虽然 `CameraStreamService` 使用了 `yieldToMain` 让出主线程，但：

| 操作 | 耗时估算 | 影响 |
|-----|---------|-----|
| `takePictureAsync()` | 50-200ms | 某些设备上可能阻塞 |
| Base64 编码 | 10-50ms | CPU 密集型 |
| WebSocket 发送大数据 | 50-100ms | 网络IO + 序列化 |

音频 PCM 数据需要**持续稳定**的采样和发送，任何阻塞都可能导致：
- 录音缓冲区溢出
- 音频帧丢失
- 延迟累积

### 解决思路

#### 思路 A：后端支持多模态并行

**需要后端配合** —— 确保后端能同时处理 `input_type: "audio"` 和 `input_type: "camera"`。

```
后端需要实现：
1. 独立的消息队列（音频/视频分离）
2. 多模态融合逻辑（将音频和视频上下文结合）
3. 不会因为收到视频而停止处理音频
```

#### 思路 B：前端互斥控制

**纯前端解决** —— 摄像头分享和语音对话互斥，用户只能选择其一。

```
用户体验：
1. 开启摄像头分享时，显示提示"视觉模式下语音对话将暂停"
2. 提供"返回语音模式"按钮
3. 或者：摄像头分享只在"非对话状态"时可用
```

#### 思路 C：降低摄像头频率

**折中方案** —— 降低摄像头帧率，减少对音频的干扰。

```
当前：10-15s/帧
优化：30-60s/帧，或改为"按需捕获"（用户主动触发）
```

### 待确认问题

1. **后端是否支持多模态并行？** 需要与后端开发者确认
2. **摄像头分享的实际用途是什么？** 实时视频 vs 单次图片发送
3. **用户期望的交互模式？** 并行使用 vs 切换使用

---

## 问题分析

### 冲突场景矩阵

| 场景 | 冲突类型 | 严重程度 | 描述 |
|------|---------|---------|------|
| 视频流开启 → 进入 QR 扫描 | CameraView 竞争 | **高** | 两个 CameraView 组件同时尝试占用摄像头 |
| 视频流开启 → 聊天中拍照 | CameraView vs 系统相机 | **中** | expo-camera 与 expo-image-picker 可能冲突 |
| 后台切换 → 前台恢复 | 状态不一致 | **中** | CameraView 可能无法正确恢复 |
| 快速切换摄像头用途 | 资源未释放 | **中** | 释放和获取之间存在时序问题 |

### 根本原因

1. **缺乏全局协调**：各功能独立管理摄像头，互不知情
2. **CameraView 始终挂载**：即使 `isStreaming` 为 false，组件仍然存在
3. **无优先级机制**：没有定义哪个功能应该优先获取摄像头
4. **异步释放延迟**：摄像头释放是异步的，立即请求可能失败

### 技术限制

- **expo-camera 限制**：CameraView 是 React 组件，需要挂载才能使用
- **系统相机限制**：expo-image-picker 使用系统相机，与 CameraView 可能互斥
- **平台差异**：iOS 和 Android 对摄像头资源管理的行为可能不同

---

## 解决方案

### 方案 A：全局摄像头协调器

创建单例管理器，统一协调摄像头资源的获取和释放。

#### 设计

```typescript
// services/CameraCoordinator.ts

export enum CameraPurpose {
  QR_SCANNER = 'qr_scanner',     // 高优先级
  PHOTO_CAPTURE = 'photo',       // 高优先级
  VIDEO_STREAM = 'video_stream', // 低优先级
}

export enum CameraPriority {
  HIGH = 10,
  LOW = 5,
}

interface CameraHolder {
  purpose: CameraPurpose;
  priority: CameraPriority;
  onRelease: () => void;
}

class CameraCoordinator {
  private currentHolder: CameraHolder | null = null;
  private waitingQueue: CameraHolder[] = [];

  request(purpose: CameraPurpose, onRelease: () => void): boolean {
    const priority = this.getPriority(purpose);
    const holder: CameraHolder = { purpose, priority, onRelease };

    if (!this.currentHolder) {
      this.currentHolder = holder;
      return true;
    }

    if (priority > this.currentHolder.priority) {
      // 优先级更高，通知当前持有者释放
      this.currentHolder.onRelease();
      this.waitingQueue.push(this.currentHolder);
      this.currentHolder = holder;
      return true;
    }

    // 加入等待队列
    this.waitingQueue.push(holder);
    return false;
  }

  release(purpose: CameraPurpose): void {
    if (this.currentHolder?.purpose === purpose) {
      this.currentHolder = null;
      // 通知下一个等待者
      const next = this.waitingQueue.shift();
      if (next) {
        this.currentHolder = next;
        // 通知可以获取摄像头
      }
    }
  }

  private getPriority(purpose: CameraPurpose): CameraPriority {
    switch (purpose) {
      case CameraPurpose.QR_SCANNER:
      case CameraPurpose.PHOTO_CAPTURE:
        return CameraPriority.HIGH;
      default:
        return CameraPriority.LOW;
    }
  }
}

export const cameraCoordinator = new CameraCoordinator();
```

#### 优点
- 完整的协调机制
- 支持优先级
- 可扩展性强

#### 缺点
- 实现复杂
- 需要修改多个模块
- 引入新的状态管理

---

### 方案 B：条件渲染 CameraView

**推荐方案** —— 最简单直接，只在需要时挂载 CameraView。

#### 设计

```typescript
// app/(tabs)/main.tsx

// 修改前：CameraView 始终挂载
{cameraStream.hasPermission && (
  <CameraView ... />
)}

// 修改后：只有在流传输时才挂载
{cameraStream.isStreaming && cameraStream.hasPermission && (
  <CameraView
    ref={cameraStream.cameraRef}
    style={{ position: 'absolute', left: -9999, ... }}
    facing={cameraStream.facing}
    onCameraReady={cameraStream.onCameraReady}
  />
)}
```

#### 配套修改

```typescript
// hooks/useCameraStream.ts

const startStreaming = useCallback((selectedFacing?: CameraType) => {
  // 设置状态，触发 CameraView 挂载
  setIsCameraReady(false);  // 重置就绪状态
  if (selectedFacing) {
    setFacing(selectedFacing);
  }
  // CameraView onCameraReady 回调会触发实际启动
}, []);

const onCameraReady = useCallback(() => {
  setIsCameraReady(true);
  // CameraView 就绪后启动流传输
  if (serviceRef.current && cameraRef.current) {
    serviceRef.current.setCameraRef(cameraRef.current);
    serviceRef.current.start();
  }
}, []);
```

#### 优点
- 实现简单
- 无需额外的状态管理
- 自然避免冲突（不使用时不存在）

#### 缺点
- 每次启动流需要重新初始化 CameraView
- 状态切换有短暂延迟

---

### 方案 C：页面级协调

在导航层面协调，进入需要摄像头的页面前先释放当前占用。

#### 设计

```typescript
// app/(tabs)/main.tsx

// 导航到 QR 扫描时停止视频流
const handleQrScan = useCallback(() => {
  if (cameraStream.isStreaming) {
    // 方案 C1: 自动停止，用户返回后需手动重启
    cameraStream.stopStreaming();

    // 方案 C2: 提示用户
    Alert.alert(
      '提示',
      '进入扫码页面将停止摄像头分享，是否继续？',
      [
        { text: '取消', style: 'cancel' },
        { text: '继续', onPress: () => {
          cameraStream.stopStreaming();
          router.push('/qr-scanner');
        }}
      ]
    );
    return;
  }
  router.push('/qr-scanner');
}, [cameraStream, router]);
```

#### 优点
- 用户明确知道状态变化
- 逻辑清晰

#### 缺点
- 需要修改所有导航入口
- 用户体验可能受影响（需要重新开启）

---

### 方案 D：混合方案（推荐采用）

**B + C 结合** —— 条件渲染 + 页面级提示。

#### 实现要点

1. **条件渲染**（方案 B）
   - CameraView 只在 `isStreaming` 时挂载
   - 自动避免与 QR 扫描冲突

2. **页面级提示**（方案 C 简化版）
   - 导航到 QR 扫描时检查状态
   - 如果正在流传输，显示 toast 提示已自动暂停

3. **恢复机制**
   - 用户返回后，显示"摄像头分享已暂停"提示
   - 提供快速恢复按钮

---

## 推荐方案

采用 **方案 D（混合方案）**，理由：

| 考量 | 方案 D 的优势 |
|------|-------------|
| 实现复杂度 | 低，主要修改条件渲染逻辑 |
| 代码改动量 | 小，集中在 main.tsx 和 useCameraStream.ts |
| 用户体验 | 好，自动处理 + 清晰提示 |
| 可维护性 | 高，逻辑简单清晰 |
| 扩展性 | 好，后续可升级为方案 A |

---

## 实现计划

### Phase 0: 确认后端能力（前置条件）

**必须先确认**：后端是否支持同时处理 `input_type: "audio"` 和 `input_type: "camera"`？

- [ ] 与后端开发者沟通多模态支持情况
- [ ] 查看后端 WebSocket 消息处理代码
- [ ] 测试：发送摄像头帧后，音频是否仍被处理

**如果后端不支持**：采用 Phase 1B（互斥模式）
**如果后端支持**：采用 Phase 1A（优化共存）

---

### Phase 1A: 优化多模态共存（后端支持时）

1. 优化 `CameraStreamService` 的 `yieldToMain` 策略
2. 降低摄像头帧率或改为按需模式
3. 添加性能监控，确保不影响音频

### Phase 1B: 互斥模式（后端不支持时）

1. 开启摄像头分享时暂停语音对话
2. 显示明确的状态提示
3. 提供快速切换回语音模式的按钮

---

### Phase 2: 条件渲染 CameraView

1. 修改 `app/(tabs)/main.tsx` 中 CameraView 的渲染条件
2. CameraView 只在 `isStreaming` 时挂载
3. 测试流传输的开始/停止流程

### Phase 3: 用户提示与状态管理

1. 添加"摄像头分享已暂停"状态 toast
2. 添加快速恢复按钮
3. 优化状态恢复逻辑
4. 处理后台/前台切换
5. 处理权限变化

---

## 立即行动项

1. **确认后端多模态支持**（最重要）
2. 根据确认结果选择 Phase 1A 或 Phase 1B
3. 实现 Phase 2 条件渲染（无论哪种方案都需要）

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|---------|
| CameraView 重新初始化延迟 | 显示加载状态，优化 onCameraReady 回调 |
| 状态恢复失败 | 提供手动恢复入口，记录日志便于排查 |
| 特定设备兼容性问题 | 增加错误处理，降级到手动模式 |

---

## 附录：相关文件

- `app/(tabs)/main.tsx` - 主页面
- `app/qr-scanner.tsx` - QR 扫描页面
- `hooks/useCameraStream.ts` - 摄像头流 hook
- `hooks/useCamera.ts` - 拍照 hook
- `services/CameraStreamService.ts` - 流传输服务
- `packages/project-neko-components/src/chat/ChatContainer.native.tsx` - 聊天容器

---

## 变更历史

| 日期 | 版本 | 描述 |
|------|------|------|
| 2026-03-17 | 1.1 | 新增"多模态输入冲突"核心问题分析，更新实现计划 |
| 2026-03-17 | 1.0 | 初始版本，问题分析与方案设计 |
