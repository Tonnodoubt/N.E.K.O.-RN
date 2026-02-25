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
7. [方案对比总结](#7-方案对比总结)
8. [推荐落地路径](#8-推荐落地路径)
9. [实施前置验证项](#9-实施前置验证项)

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

### 方案 A（修正版）：小改原生 + JS 层 VAD（推荐，快速上线）

> **⚠️ 原方案 A 已验证不可行**（见第 6 节 Q1、Q4 调查结论）。原方案假设 JS 层调用 `startRecording()` 可覆盖原生自动暂停，且 `onAmplitudeUpdate` 可用于录音 VAD，两者均不成立。以下为修正版。

**原理**：在原生层增加一个开关 API 关闭"播放时自动暂停麦克风"的行为，并增加录音振幅事件。JS 层利用录音振幅做 VAD，检测到用户说话时立即打断。

**需要的原生改动（很小）**：

```kotlin
// 1. 新增 API：控制播放时是否自动暂停麦克风
fun setMicPauseOnPlayback(enabled: Boolean) {
    autoMicPauseEnabled = enabled
}

// 2. 在 pauseMicrophoneForPlayback() 中加判断
private fun pauseMicrophoneForPlayback() {
    if (!autoMicPauseEnabled) return  // 新增：开关关闭时跳过暂停
    if (isRecording && !microphonePausedForPlayback) {
        microphonePausedForPlayback = true
        // ...
    }
}

// 3. 在录音循环中增加录音振幅事件
val amplitude = calculateAmplitude(audioData)
sendEvent("onRecordingAmplitude", mapOf("amplitude" to amplitude))
```

**JS 层流程**：

```
语音会话开始
    → 调用 PCMStream.setMicPauseOnPlayback(false) 关闭自动暂停
    → 正常录音...

onPlaybackStart 触发
    → 麦克风继续录音（不再被自动暂停）
    → 监听 onRecordingAmplitude 事件（录音振幅，非播放振幅）
    → 录音振幅 > 设定阈值
    → 本地立即调用 stopPlayback()
    → 继续发送音频数据到服务端
    → 服务端收到新音频后发送 user_activity 确认
    → SpeechInterruptController 丢弃旧音频，接受新响应
```

**优点**：
- 原生改动极小（加一个 flag + 一个振幅事件），不涉及音频架构变更
- VAD 逻辑在 JS 层，调试方便
- 耳机场景可直接上线

**缺点**：
- 手机扬声器场景会有回声：AI 说话的声音被麦克风拾取，可能误触发打断
- 需要仔细调校振幅阈值
- 仍需少量原生代码修改

**回声问题的缓解策略**：
- 播放开始后的前 500ms 内忽略振幅（排除播放启动瞬间的冲击音）
- 建立"播放期间的基线振幅"，要求实际振幅显著高于基线才触发（例如 3 倍）
- 耳机场景下回声几乎为零，可以较低阈值

---

### 方案 B：原生层 AEC + VAD（最佳效果，需改原生代码）

**原理**：在 Android 原生层开启 `VOICE_COMMUNICATION` 音频模式，启用硬件级声学回声消除（AEC）。同时让原生层在播放期间也持续录音并做 VAD（语音活动检测），一旦检测到人声就通过事件通知 JS 层。

> **关于 AEC 的复杂度澄清**：这里说的 AEC 不是自己写回声消除算法（那确实极其复杂，需要声纹采集 + 自适应滤波器），而是利用 Android 系统内置的硬件级 AEC。这和手机打电话开免提时用的是同一套回声消除机制——系统自动处理，不需要自己实现算法。核心改动就是切换音频模式。

**需要在 `react-native-pcm-stream` 原生模块中修改**：

```kotlin
// 1. 切换音频模式（核心，就这一行启用硬件 AEC）
audioManager.mode = AudioManager.MODE_IN_COMMUNICATION

// 2. 切换 AudioAttributes（配合音频模式）
// 当前：USAGE_MEDIA + CONTENT_TYPE_MUSIC（无 AEC）
// 改为：USAGE_VOICE_COMMUNICATION + CONTENT_TYPE_SPEECH（启用 AEC）
val attrib = AudioAttributes.Builder()
    .setUsage(AudioAttributes.USAGE_VOICE_COMMUNICATION)
    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
    .build()

// 3. 播放期间持续采集麦克风，做能量检测
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
- 硬件 AEC 彻底解决回声问题（系统内置，不需要自己实现算法）
- VAD 精度更高，假阳性率更低
- 延迟最低（原生层直接处理）
- 扬声器场景也能正常工作

**缺点**：
- 需要修改 Android 原生代码
- 需要维护 native module 的 fork
- `MODE_IN_COMMUNICATION` 可能影响音频输出质量（系统会优化为通话模式），需要实测

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

**推荐：方案 D 立即兜底，方案 A（修正版）快速上线，方案 B 作为长期目标。**

### 4.1 方案 A（修正版）实现细节

#### 原生层改动（2 处）

**改动 1**：在 `PCMStreamModule.kt` 增加 `setMicPauseOnPlayback(enabled)` API

```kotlin
// 新增变量
@Volatile private var autoMicPauseEnabled = true  // 默认保持原有行为

// 新增 API
fun setMicPauseOnPlayback(enabled: Boolean) {
    autoMicPauseEnabled = enabled
    if (!enabled && microphonePausedForPlayback) {
        // 如果关闭自动暂停，同时恢复当前被暂停的麦克风
        microphonePausedForPlayback = false
    }
}

// 修改 pauseMicrophoneForPlayback()
private fun pauseMicrophoneForPlayback() {
    if (!autoMicPauseEnabled) return  // 开关关闭时跳过
    if (isRecording && !microphonePausedForPlayback) {
        microphonePausedForPlayback = true
        // ...
    }
}
```

**改动 2**：在录音循环中增加 `onRecordingAmplitude` 事件

```kotlin
// 在录音线程的数据处理循环中，每 ~50ms emit 一次录音振幅
val amplitude = calculateRmsAmplitude(audioData)
sendEvent("onRecordingAmplitude", mapOf("amplitude" to amplitude))
```

#### JS 层状态机

```
idle
  │ startVoiceSession()
  │ PCMStream.setMicPauseOnPlayback(false)  ← 新增
  ▼
recording ──────────────────────────────────────────────────────┐
  │ onPlaybackStart                                             │
  ▼                                                            │
recording_with_interrupt_listen                                  │
  │ onRecordingAmplitude > 阈值 或 onPlaybackStop              │
  ▼                                                            │
recording ◄─────────────────────────────────────────────────────┘
```

#### 振幅阈值设计

播放期间麦克风的振幅会受到扬声器声音的干扰，需要动态基线：

```
基线建立：onPlaybackStart 后 200ms，采集 onRecordingAmplitude 均值作为"回声基线"
打断条件：当前振幅 > 基线 × 3.0 AND 当前振幅 > 0.10（绝对下限）
冷却期：打断触发后 500ms 内不再重复触发
耳机场景：无回声，阈值直接设 0.10，无需动态基线
```

#### onPlaybackStart 中的关键改动

当前行为（`android.pcmstream.native.ts`）：
```typescript
// 什么都不做，原生层已自动暂停麦克风
this.feedbackControlStatus = '播放中-麦克风已暂停';
```

需要改为（在 `audioServiceNative.ts` 中）：
```typescript
// 由于已调用 setMicPauseOnPlayback(false)，麦克风不会被自动暂停
// 开始监听录音振幅，准备客户端 VAD
this.feedbackControlStatus = '播放中-麦克风保持活跃';
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

### 方案 A 修正版（小改原生 + JS 层 VAD）

| 文件 | 改动内容 | 优先级 |
|------|---------|-------|
| `packages/react-native-pcm-stream/.../PCMStreamModule.kt` | 新增 `setMicPauseOnPlayback(enabled)` API；新增 `autoMicPauseEnabled` 变量；修改 `pauseMicrophoneForPlayback()` 增加开关判断 | P0 |
| `packages/react-native-pcm-stream/.../PCMStreamModule.kt` | 在录音循环中增加 `onRecordingAmplitude` 事件 emit | P0 |
| `packages/project-neko-audio-service/src/native/audioServiceNative.ts` | 会话开始时调用 `setMicPauseOnPlayback(false)`；监听 `onRecordingAmplitude` 做 VAD；触发打断时调用 `stopPlayback()` | P0 |
| `packages/project-neko-audio-service/src/types.ts` | 添加新的 AudioServiceState（如 `recording_interrupt_listening`）；添加 `onInterrupt` 事件类型 | P1 |
| `packages/project-neko-audio-service/src/protocol.ts` | 添加客户端主动打断时的状态重置方法 | P1 |
| `app/(tabs)/main.tsx` | 根据打断状态更新 UI（如显示"正在聆听..."提示） | P2 |

### 方案 B（原生层，长期目标）

| 文件 | 改动内容 |
|------|---------|
| `android/...PCMStreamModule.kt`（原生模块） | 开启 AEC；播放期间持续录音；添加 VAD；emit `onUserSpeechDetectedDuringPlayback` |
| `audioServiceNative.ts` | 监听新的原生事件，调用打断流程 |

---

## 6. 未解决的问题（已调查）

以下问题已通过代码审查完成调查，结论如下：

**Q1：`react-native-pcm-stream` 是否支持播放时同时录音？**

> **结论：不支持。JS 层调用 `startRecording()` 也无法覆盖。**
>
> 原生模块 `PCMStreamModule.kt` 使用 `@Volatile microphonePausedForPlayback` 标志位控制。播放开始时，`PCMStreamPlayer.kt` 的 `onPlaybackStart` 回调调用 `pauseMicrophoneForPlayback()`，将此标志设为 `true`。录音线程虽然持续运行，但在循环中检查此标志——为 `true` 时直接 `Thread.sleep(32)` + `continue`，丢弃所有麦克风数据。
>
> 即使 JS 层重新调用 `startRecording()`，它只会先 `stopRecordingInternal()` 再启新线程，但标志位依然为 `true`（因为播放仍在进行），新线程同样会进入 sleep 循环。
>
> **影响**：原方案 A（纯 JS 层）不可行。修正版方案 A 需要在原生层增加 `setMicPauseOnPlayback(enabled)` 开关 API。
>
> 代码位置：
> - 标志位定义：`PCMStreamModule.kt` L21-23
> - 自动暂停：`PCMStreamPlayer.kt` L44-51 (`onPlaybackStart` → `pauseMicrophoneForPlayback()`)
> - 录音循环检查：`PCMStreamModule.kt` L178-183（`if (microphonePausedForPlayback) { sleep; continue }`)
> - 恢复路径：`onPlaybackCompleted` / `onPlaybackPaused` / `onError` / `stopPlaybackInternal`（4 个恢复点均已实现）

**Q2：当前设备场景是扬声器还是耳机？**

> **决定：先用耳机验证整条链路，后续扬声器场景通过方案 B（硬件 AEC）解决。**
>
> 耳机场景回声几乎为零，VAD 阈值可直接设 0.10，无需动态基线。这使得方案 A 修正版在耳机场景下可以直接上线。
>
> 扬声器场景的回声误触发问题，动态基线 + 阈值只能缓解不能根治，最终需要方案 B 的硬件 AEC 彻底解决。

**Q3：服务端是否在收到新音频后会正确中断当前响应？**

> **结论：客户端侧协议已完整实现，服务端大概率已支持，但需实测验证。**
>
> 客户端侧的证据：
> - `audioServiceNative.ts` L120-123：收到 `user_activity` 后立即调用 `stopPlayback()`
> - `protocol.ts` 的 `SpeechInterruptController`：
>   - `onUserActivity(interruptedSpeechId)` → 设 `pendingDecoderReset = true`，标记被打断的 speech_id
>   - `onAudioChunk(speechId)` → 如果 speech_id 匹配被打断的 → `skipNextBinary = true`（丢弃旧音频）；如果是新 speech_id → 重置解码器，接受新音频
>   - `getSkipNextBinary()` → `handleIncomingBinary()` 中用此判断是否丢弃二进制数据
>
> 设计文档已明确指出"这条路径在代码里是完整的"。真正的阻塞点不是服务端是否支持打断，而是麦克风被静音导致服务端收不到音频、根本无法触发检测。一旦解决麦克风问题，此路径应能直接跑通。建议在耳机测试时一并验证。

**Q4：`onAmplitudeUpdate` 事件在播放期间是否还会触发？**

> **结论：会触发，但它报告的是播放振幅（用于口型同步），不是录音振幅。不能用于用户语音检测。**
>
> `onAmplitudeUpdate` 来自 `PCMStreamPlayer.kt` L396-402，是对输出的播放 PCM 数据计算 RMS 振幅，约每 16ms 触发一次，用于 Live2D 口型同步。它与麦克风录音完全无关。
>
> **影响**：原方案 A 设计中"监听 `onAmplitudeUpdate` 做 VAD"的思路有误。修正版方案 A 需要在原生录音循环中新增 `onRecordingAmplitude` 事件来报告录音侧振幅。

---

## 7. 方案对比总结

| 方案 | 核心思路 | 改动范围 | 回声处理 | 落地速度 |
|------|---------|---------|---------|---------|
| **A 修正版: 小改原生 + JS VAD** | 原生加开关关闭自动暂停 + 录音振幅事件，JS 层做 VAD | 原生小改 + JS 层 | 动态基线 + 阈值（耳机场景足够） | 较快 |
| **B: 原生 AEC + VAD** | Android 原生开启硬件回声消除，原生层做 VAD | 需改原生模块 | 硬件 AEC（彻底） | 中等 |
| **C: 服务端 AEC** | 客户端始终上传音频，服务端自己做回声消除和 VAD | 依赖服务端 | 服务端处理 | 慢（依赖后端） |
| **D: 手动按钮** | UI 上加打断按钮 | 仅 UI 层 | 无需 | 最快 |

> **注**：原方案 A（纯 JS 层）已验证不可行——JS 调 `startRecording()` 无法覆盖原生自动暂停，且 `onAmplitudeUpdate` 是播放振幅而非录音振幅。上表中的"A 修正版"是在原方案基础上增加了必要的原生改动。

---

## 8. 推荐落地路径

**D → A（修正版） → B，逐步递进。**

### 第一步：方案 D 兜底（P0，立即可做）

- 在 AI 播放时显示一个打断按钮，点击调用 `audioService.stopPlayback()`
- 改动极小，纯 UI 层，可以立即上线，保证用户至少有办法打断
- 即使后续自动打断上线，手动按钮仍有保留价值（嘈杂环境、VAD 误判等场景）
- 涉及文件：`app/(tabs)/main.tsx`，在 `Live2DRightToolbar` 或 `ChatContainer` 添加按钮

### 第二步：方案 A 修正版快速上线（P1，需小改原生）

> ⚠️ 原方案 A（纯 JS 层）已验证不可行（见第 6 节 Q1、Q4 调查结论），修正版需要两处小的原生改动。

**原生改动（工作量小）**：

| 改动 | 文件 | 内容 |
|------|------|------|
| 1. 加开关 API | `PCMStreamModule.kt` | 暴露 `setMicPauseOnPlayback(enabled)` 方法，控制 `microphonePausedForPlayback` 的自动设置行为 |
| 2. 加录音振幅事件 | `PCMStreamModule.kt` | 在录音循环中增加录音振幅计算，emit `onRecordingAmplitude` 事件 |

**JS 层改动**：
- 语音会话开始时调用 `PCMStream.setMicPauseOnPlayback(false)` 关闭自动暂停
- 监听 `onRecordingAmplitude`（不是 `onAmplitudeUpdate`）做 VAD
- 检测到用户说话 → 调用 `stopPlayback()`

**适用场景**：耳机场景可直接上线（无回声问题）。扬声器场景需要动态基线调参，效果可能不够稳定。

### 第三步：方案 B 长期目标（P2，扬声器场景）

- 修改 `react-native-pcm-stream` 原生模块，开启 `MODE_IN_COMMUNICATION` + 硬件 AEC
- 彻底解决扬声器回声问题，VAD 精度最高、延迟最低
- 当前原生代码使用 `USAGE_MEDIA` + `CONTENT_TYPE_MUSIC`（`PCMStreamPlayer.kt` L107-110），无硬件 AEC

### 不推荐优先考虑的方案

**方案 C（服务端 AEC）**：增加上行流量（播放时也在上传麦克风数据）、延迟更高（需要一个网络往返）、且依赖后端改动。客户端可控性低，不建议优先。

---

## 9. 实施前置验证项（已完成代码审查，部分需实测）

通过代码审查已确认大部分问题，剩余需实测验证的标注如下：

### 验证 1：播放期间能否重开麦克风（对应 Q1）— ✅ 已确认

**结论：不能。** 原生层使用 `microphonePausedForPlayback` 标志位强制互斥，JS 层无法覆盖。

**解决方案**：在原生层增加 `setMicPauseOnPlayback(enabled)` API，允许 JS 层关闭自动暂停行为。改动量小，不涉及音频架构变更。

### 验证 2：播放期间振幅事件是否触发（对应 Q4）— ✅ 已确认

**结论：`onAmplitudeUpdate` 会触发，但它是播放振幅（用于口型同步），不是录音振幅。**

`onAmplitudeUpdate` 来自 `PCMStreamPlayer.kt` 的播放数据 RMS 计算，与麦克风无关。

**解决方案**：在录音循环中新增 `onRecordingAmplitude` 事件，report 录音侧的 RMS 振幅。

### 验证 3：服务端打断行为（对应 Q3）— ⏳ 需实测

**代码审查结论：客户端侧协议完整，服务端大概率支持。**

客户端已实现完整的 `user_activity` → `SpeechInterruptController` → 丢弃旧音频 → 接受新音频的流程。设计文档确认"这条路径在代码里是完整的"。

**仍需实测确认**：服务端收到用户新音频帧后是否能正确丢弃当前 TTS、发出 `user_activity`、开始处理新输入。建议在耳机测试方案 A 修正版时一并验证。

### 验证 4：耳机/扬声器检测（对应 Q2）— ✅ 已决定

**决定：先耳机，后扬声器。**

- 耳机场景：无回声，方案 A 修正版可直接上线
- 扬声器场景：后续通过方案 B（硬件 AEC）解决

---

## 附：相关文件速查

```
原生模块（需改动）：
packages/react-native-pcm-stream/android/src/main/java/expo/modules/pcmstream/
  PCMStreamModule.kt                    — 录音核心（microphonePausedForPlayback 标志位在此）
  PCMStreamPlayer.kt                    — 播放核心（onPlaybackStart 自动暂停麦克风在此）

TypeScript 服务层：
services/android.pcmstream.native.ts      — Android 录音/播放 TS 封装
packages/project-neko-audio-service/
  src/native/audioServiceNative.ts        — 语音会话管理、打断协调
  src/protocol.ts                         — SpeechInterruptController
  src/types.ts                            — 接口定义

应用层：
hooks/useAudio.ts                         — React Hook 集成层
app/(tabs)/main.tsx                       — 主界面，状态驱动 UI

文档：
docs/specs/websocket.md                   — WebSocket 消息协议
```
