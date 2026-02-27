# N.E.K.O. 语音播放链路分析

> 分析范围：文本模式与语音模式下，服务端生成音频 → 客户端播放的完整链路，以及发现的问题。

---

## 一、语音播放全链路

### 1.1 服务端音频生成

**两条路径：**

| 路径 | 适用场景 | 流程 |
|------|----------|------|
| TTS 路径 | 文本模式（始终）/ 语音模式（有自定义音色时） | LLM 文本 → TTS 队列 → TTS Worker 合成 → tts_response_queue → send_speech |
| 直出路径 | 语音模式（无自定义音色时） | Realtime API 直接返回音频 → handle_audio_data → 重采样 → send_speech |

**TTS 流程细节：**
1. LLM 每产出一个文本 chunk → `handle_text_data` / `handle_output_transcript`
2. 文本放入 `tts_request_queue`，附带 `(speech_id, text)`
3. TTS Worker（独立线程）从队列取出，调用 TTS API 合成
4. 合成的 PCM 音频放入 `tts_response_queue`
5. `tts_response_handler`（async task）持续轮询队列，调用 `send_speech()`

**send_speech 协议（两段式）：**
```
第1帧: JSON  → { type: "audio_chunk", speech_id: "uuid" }
第2帧: Binary → PCM16 音频数据 (48kHz)
```

### 1.2 speech_id 打断机制

**服务端：**
- 每次新回复生成唯一 `speech_id`（UUID）
- 用户打断时发送 `{ type: "user_activity", interrupted_speech_id: "旧ID" }`
- 新回复的音频携带新的 `speech_id`

**客户端 SpeechInterruptController：**
```
收到 user_activity(interrupted_speech_id = ID_A)
  → 标记 ID_A 为被打断

收到 audio_chunk(speech_id = ID_B)
  → 如果 ID_B === ID_A（被打断的）→ 丢弃后续 binary
  → 如果 ID_B !== ID_A（新的）→ 正常播放，重置解码器
```

### 1.3 客户端播放流程（RN Native）

```
WebSocket binary 事件
  → handleIncomingBinary(data)
    → 检查 interrupt.getSkipNextBinary() → 是则丢弃
    → 检查 manualInterruptActive → 是则丢弃
    → PCMStream.initPlayer(48000)
    → PCMStream.playPCMChunk(Uint8Array)
    → 原生播放器内部排队播放
```

**打断时：**
```
收到 user_activity
  → interrupt.onUserActivity(interrupted_speech_id)
  → stopPlayback()
    → PCMStream.stopPlayback()（清空原生缓冲区）
    → manualInterruptActive = true（屏蔽后续 binary）
    → micMutedUntil = now + 600ms（防回声）

收到新的 audio_chunk
  → manualInterruptActive = false（解除屏蔽）
  → 后续 binary 正常播放
```

---

## 二、发现的问题

### 🔴 问题 A（严重）：文本模式下 TTS 音频被全部丢弃

**根因：** `_process_stream_data_internal` 中 speech_id 生成和 user_activity 发送的顺序错误。

**当前代码（core.py L1866-1870）：**
```python
# 先生成新 speech_id
async with self.lock:
    self.current_speech_id = str(uuid4())  # speech_id = ID_X

# 再发 user_activity（此时 interrupted_speech_id 已经是新的 ID_X）
await self.send_user_activity()  # → interrupted_speech_id = ID_X
```

**导致的时序：**
1. 服务端生成 `speech_id = ID_X`
2. 服务端发送 `user_activity(interrupted = ID_X)`
3. LLM 回复 → TTS 合成 → `audio_chunk(speech_id = ID_X)`
4. 客户端：`ID_X === interruptedSpeechId` → 丢弃所有音频

**对比语音模式（正确的）：**
1. `handle_input_transcript` 生成 `speech_id = ID_interrupt`
2. `handle_new_message` 发送 `user_activity(interrupted = ID_interrupt)`
3. `handle_new_message` 再生成新的 `speech_id = ID_new`
4. `audio_chunk(speech_id = ID_new)` → `ID_new ≠ ID_interrupt` → 正常播放

**为什么 Web 端（localhost:48911）没感觉到：**
Web 端使用的是旧版 `static/app.js`，其打断逻辑与 RN 端的 `SpeechInterruptController` 实现不同，可能不做 speech_id 匹配丢弃。

**修复：** 交换顺序——先发 `user_activity`（带旧 speech_id），再生成新 speech_id。

---

### 🟡 问题 B：角色切换时未立即停止音频播放

**现象：** 收到 `catgirl_switched` 消息时（main.tsx L307-316），没有调用 `audio.clearAudioQueue()`。

**影响：**
- `useAudio` 会因 `characterName` 变化而重建 AudioService
- 但重建是异步的，在重建完成前，旧角色的 TTS 音频可能还在原生 PCM 播放器的缓冲区里继续播放
- 用户会听到切换后还有旧角色的声音残留

**修复：** 在 `catgirl_switched` 处理中，立即调用 `audio.clearAudioQueue()` 停止播放。

---

### ⚪ 问题 C（轻微）：TTS 响应处理器的轮询间隔

**现象：** `tts_response_handler` 使用 `await asyncio.sleep(0.01)` 轮询 `tts_response_queue`。

**影响：** 每个音频 chunk 最多有 10ms 的额外延迟。对于实时对话场景，这个延迟可以接受，但如果 TTS 产出速度快，多个 chunk 会在同一次轮询中被批量发送，可能导致客户端瞬间收到大量数据。

**状态：** 不影响功能，暂不处理。

---

## 三、修复状态

| 状态 | 问题 | 影响 | 方案 |
|------|------|------|------|
| ✅ 已修复（客户端 workaround） | 文本模式 TTS 音频被丢弃 | 文本模式下完全没有语音输出 | `SpeechInterruptController.onUserActivity` 不再记录 `interruptedSpeechId`，打断由 `stopPlayback` + `manualInterruptActive` 保证 |
| 🔴 待上游修复（服务端根因） | 同上 | 同上 | 服务端 `_process_stream_data_internal` 中交换 `send_user_activity()` 和生成新 `speech_id` 的顺序（core.py L1866-1870） |
| ✅ 已修复 | 角色切换音频残留 | 切换后短暂听到旧角色声音 | `catgirl_switched` 处理中立即调用 `audio.clearAudioQueue()` |
| ⚪ 暂缓 | TTS 轮询间隔 | 10ms 额外延迟 | 不影响体验 |
