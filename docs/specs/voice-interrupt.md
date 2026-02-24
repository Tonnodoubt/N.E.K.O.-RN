# 语音打断功能设计文档

> 功能：AI 回复语音播放期间，用户开口说话时，AI 立即停止说话并开始倾听。

---

## 目录

1. [现状分析](#1-现状分析)
2. [核心问题](#2-核心问题)
3. [实现方案](#3-实现方案)
4. [推荐方案详解](#4-推荐方案详解)
5. [需要修改的文件](#5-需要修改的文件)
6. [未解决的问题](#6-未解决的问题)

---

## 1. 现状分析

### 1.1 已有的打断协议（服务端驱动）

服务端检测到用户说话后，会通过 WebSocket 发送 `user_activity` 消息：

```json
{ "type": "user_activity", "interrupted_speech_id": "speech-abc-123" }
```

客户端的 `SpeechInterruptController`（`protocol.ts`）和 `audioServiceNative.ts` 已经处理这条消息：收到后立即调用 `PCMStream.stopPlayback()` 停止播放。

**这条路径在代码里是完整的**，问题出在更早的环节。

### 1.2 打断流程的现有代码位置

| 环节 | 文件 | 位置 |
|------|------|------|
| 接收 user_activity | `audioServiceNative.ts` | `handleIncomingJson` L120-123 |
| 调用 stopPlayback | `audioServiceNative.ts` | `stopPlayback()` L271-276 |
| 打断状态机 | `protocol.ts` | `SpeechInterruptController` |
| 丢弃旧音频块 | `protocol.ts` | `onAudioChunk()` + `getSkipNextBinary()` |

---

## 2. 核心问题

### 死锁：麦克风在 AI 说话时被自动暂停

原生模块 `react-native-pcm-stream` 在播放音频时会自动暂停麦克风录音。这导致整个打断流程陷入死锁：

```
AI 开始播放
    → 原生层自动暂停麦克风
    → 用户说话，但麦克风已关
    → 服务端收不到用户音频
    → 服务端无法检测到用户说话
    → 服务端不发送 user_activity
    → 打断永远不会触发
```

代码证据在 `android.pcmstream.native.ts:92-96`：

```typescript
this.playbackStartSubscription = PCMStream.addListener('onPlaybackStart', (event: any) => {
    console.log('▶️ PCMStream播放开始（麦克风自动暂停）', event);
    this.feedbackControlStatus = '播放中-麦克风已暂停';
    this.isPlaying = true;
});
```

原生层自动暂停麦克风的设计初衷是防止回声（AI 的声音被麦克风拾取后再次发送给服务端），但它同时阻断了打断能力。

---

## 3. 实现方案

### 方案 A：JS 层强制保持麦克风 + 振幅 VAD（推荐，快速上线）

**原理**：在 `onPlaybackStart` 触发后，JS 层主动调用 `PCMStream.startRecording()` 覆盖原生的自动暂停，并监听麦克风振幅。振幅超过阈值时认为用户在说话，立即打断。

**流程**：

```
onPlaybackStart 触发
    → JS 层调用 startRecording() 重新激活麦克风
    → 监听 onAmplitudeUpdate 事件
    → 振幅 > 设定阈值（例如 0.15）
    → 本地立即调用 stopPlayback()
    → 继续发送音频数据到服务端
    → 服务端收到新音频后发送 user_activity 确认
    → SpeechInterruptController 丢弃旧音频，接受新响应
```

**优点**：
- 只改 JS 层，无需修改原生代码
- 实现简单，改动集中

**缺点**：
- 手机扬声器场景会有回声：AI 说话的声音被麦克风拾取，可能误触发打断
- 需要仔细调校振幅阈值

**回声问题的缓解策略**：
- 播放开始后的前 500ms 内忽略振幅（排除播放启动瞬间的冲击音）
- 建立"播放期间的基线振幅"，要求实际振幅显著高于基线才触发（例如 3 倍）
- 耳机场景下回声几乎为零，可以较低阈值

---

### 方案 B：原生层 AEC + VAD（最佳效果，需改原生代码）

**原理**：在 Android 原生层开启 `VOICE_COMMUNICATION` 音频模式，启用硬件级声学回声消除（AEC）。同时让原生层在播放期间也持续录音并做 VAD（语音活动检测），一旦检测到人声就通过事件通知 JS 层。

**需要在 `react-native-pcm-stream` 原生模块中增加**：

```kotlin
// 开启 AEC 的音频模式
audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

// 播放期间持续采集麦克风，做能量检测
// 如果能量超阈值，emit 事件：
sendEvent("onUserSpeechDetectedDuringPlayback", null)
```

**JS 层只需监听新事件**：

```typescript
PCMStream.addListener('onUserSpeechDetectedDuringPlayback', () => {
    stopPlayback();
    // 继续发送音频到服务端
});
```

**优点**：
- 硬件 AEC 彻底解决回声问题
- VAD 精度更高，假阳性率更低
- 延迟最低（原生层直接处理）

**缺点**：
- 需要修改 Android 原生代码
- 需要维护 native module 的 fork

---

### 方案 C：服务端 AEC + 双向流（最完整，依赖服务端支持）

**原理**：客户端始终发送麦克风音频（包括播放期间），服务端自己做回声消除和 VAD。服务端只要检测到用户真实语音，发出 `user_activity` 即可。

**JS 层改动**：
- 播放期间不暂停麦克风，音频流持续上传
- 客户端不做本地 VAD，完全由服务端决策

**优点**：
- 客户端几乎不需要改动
- 服务端有更多上下文，可以做更智能的判断

**缺点**：
- 完全依赖服务端支持 AEC 和实时 VAD
- 需要服务端侧修改
- 上行音频量翻倍（播放时也在上传麦克风数据）
- 延迟比本地 VAD 高（需要一个网络往返）

---

### 方案 D：手动打断按钮（兜底方案）

在 UI 上提供一个"打断"按钮（或长按麦克风图标），用户手动触发打断。

**适用场景**：方案 A/B/C 都未落地时的临时方案，或作为辅助操作保留。

**改动**：
- UI 层：在 `Live2DRightToolbar` 或 `ChatContainer` 添加打断按钮，仅在 AI 播放时显示
- 逻辑层：点击后调用 `audioService.stopPlayback()`

---

## 4. 推荐方案详解

**推荐：方案 A 作为快速上线版，方案 B 作为长期目标。**

### 4.1 方案 A 实现细节

#### 状态机

```
idle
  │ startVoiceSession()
  ▼
recording ──────────────────────────────────────────────────────┐
  │ onPlaybackStart                                             │
  ▼                                                            │
recording_with_interrupt_listen                                  │
  │ 振幅 > 阈值 或 onPlaybackStop                              │
  ▼                                                            │
recording ◄─────────────────────────────────────────────────────┘
```

#### 振幅阈值设计

播放期间麦克风的振幅会受到扬声器声音的干扰，需要动态基线：

```
基线建立：onPlaybackStart 后 200ms，采集振幅均值作为"回声基线"
打断条件：当前振幅 > 基线 × 3.0 AND 当前振幅 > 0.10（绝对下限）
冷却期：打断触发后 500ms 内不再重复触发
```

#### onPlaybackStart 中的关键改动

当前行为（`android.pcmstream.native.ts`）：
```typescript
// 什么都不做，原生层已自动暂停麦克风
this.feedbackControlStatus = '播放中-麦克风已暂停';
```

需要改为（在 `audioServiceNative.ts` 中）：
```typescript
// 播放开始后，重新激活麦克风以支持打断
PCMStream.startRecording(recordSampleRate, recordFrameSize, recordTargetRate);
// 开始监听振幅，准备客户端 VAD
startInterruptListening();
```

#### 打断触发后的动作序列

```
1. 立即：PCMStream.stopPlayback()
2. 立即：emitter.emit("outputAmplitude", { amplitude: 0 }) （停止口型同步）
3. 立即：interrupt.reset() （清理 SpeechInterruptController 状态）
4. 继续：麦克风保持活跃，音频流继续发往服务端
5. 等待：服务端收到新音频后发出 user_activity（用于双重确认）
6. 等待：服务端开始生成新响应，发出新的 audio_chunk
```

---

### 4.2 关键边界情况

| 场景 | 处理方式 |
|------|---------|
| AI 刚开始说话，用户立即打断 | 冷却期 200ms 内不触发，避免播放启动噪声误触 |
| 用户打断后又没说话 | 服务端检测到静音，继续等待，不发 user_activity |
| 网络抖动导致 user_activity 延迟 | 本地已停止播放，体验已完成，服务端确认只是附加保障 |
| 耳机 vs 扬声器 | 耳机无回声，阈值可以更低；扬声器需要动态基线 |
| 用户打断时 AI 刚好说完 | `onPlaybackStop` 和打断同时发生，需要防止重复 reset |

---

## 5. 需要修改的文件

### 方案 A（JS 层，快速上线）

| 文件 | 改动内容 | 优先级 |
|------|---------|-------|
| `packages/project-neko-audio-service/src/native/audioServiceNative.ts` | 在 `onPlaybackStart` 后重新激活录音；添加振幅 VAD 逻辑；触发打断时调用 `stopPlayback()` | P0 |
| `packages/project-neko-audio-service/src/types.ts` | 添加新的 AudioServiceState（如 `recording_interrupt_listening`）；添加 `onInterrupt` 事件类型 | P1 |
| `packages/project-neko-audio-service/src/protocol.ts` | 添加客户端主动打断时的状态重置方法 | P1 |
| `app/(tabs)/main.tsx` | 根据打断状态更新 UI（如显示"正在聆听..."提示） | P2 |

### 方案 B（原生层，长期目标）

| 文件 | 改动内容 |
|------|---------|
| `android/...PCMStreamModule.kt`（原生模块） | 开启 AEC；播放期间持续录音；添加 VAD；emit `onUserSpeechDetectedDuringPlayback` |
| `audioServiceNative.ts` | 监听新的原生事件，调用打断流程 |

---

## 6. 未解决的问题

在开始实现前，需要确认以下问题：

**Q1：`react-native-pcm-stream` 是否支持播放时同时录音？**

原生模块目前在播放开始时自动暂停麦克风。这是模块内部的强制行为，还是可以通过参数关闭？如果是强制行为，方案 A 中通过 JS 层调用 `startRecording()` 能否成功覆盖，需要实际测试验证。

**Q2：当前设备场景是扬声器还是耳机？**

- **耳机**：回声几乎为零，方案 A 可以直接上线，振幅阈值设 0.10 左右即可
- **扬声器**：必须做动态基线或使用方案 B（AEC），否则 AI 自己的声音会触发打断

**Q3：服务端是否在收到新音频后会正确中断当前响应？**

服务端需要满足：收到用户新音频帧时，能够丢弃当前正在生成的 TTS 任务，发出 `user_activity`，并开始处理新的用户输入。如果服务端不支持，打断只是本地停止播放，没有真正的"AI 停止思考"效果。

**Q4：`onAmplitudeUpdate` 事件在播放期间是否还会触发？**

如果原生层在暂停麦克风的同时也停止发送 `onAmplitudeUpdate`，那么方案 A 的振幅 VAD 方法需要调整为在 JS 层重新调用录音，而不是仅依赖振幅事件。

---

## 附：相关文件速查

```
services/android.pcmstream.native.ts      — Android 录音/播放核心
packages/project-neko-audio-service/
  src/native/audioServiceNative.ts        — 语音会话管理、打断协调
  src/protocol.ts                         — SpeechInterruptController
  src/types.ts                            — 接口定义
hooks/useAudio.ts                         — React Hook 集成层
app/(tabs)/main.tsx                       — 主界面，状态驱动 UI
docs/specs/websocket.md                   — WebSocket 消息协议
```
