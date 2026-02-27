# N.E.K.O. 消息全链路分析

> 分析范围：移动端（RN）用户发送第一条消息起，文本模式与语音模式下客户端 ↔ 服务端的完整响应链路。

---

## 一、文本模式全链路

### 1.1 客户端发送

```
用户输入文字 → ChatInput.handleSend()
    → main.tsx: handleSendMessage(text)
        → ensureTextSession()
            ├─ isTextSessionActive === true → 直接返回
            └─ isTextSessionActive === false
                → 发送 {action: 'start_session', input_type: 'text', audio_format: 'PCM_48000HZ_MONO_16BIT'}
                → 等待 session_started 回复（15秒超时）
        → 发送 {action: 'stream_data', input_type: 'text', data: "用户文字", clientMessageId}
        → chat.addMessage(text, 'user')  // UI 立即显示
```

关键文件：
- `app/(tabs)/main.tsx` L630-679（handleSendMessage）
- `app/(tabs)/main.tsx` L578-626（ensureTextSession）
- `packages/project-neko-components/src/chat/ChatInput.tsx`

### 1.2 服务端处理

```
websocket_router 收到 start_session
    → asyncio.create_task(session_manager.start_session(ws, mode='text'))
        → 创建 OmniOfflineClient（REST 流式 API）
        → 启动 TTS worker（如需要）
        → warmup / prefill 系统指令
        → session_ready = True
        → 发送 {type: 'session_started', input_mode: 'text'}
        → flush pending_input_data（如有缓存数据）

websocket_router 收到 stream_data
    → session_manager.stream_data(message)
        → _process_stream_data_internal()
            → 检查 session 类型是否为 OmniOfflineClient（不匹配则自动重建）
            → session.stream_text(data)
                → LangChain ChatOpenAI.astream() 流式调用 LLM
```

LLM 流式返回：
```
每个 text chunk → on_text_delta 回调
    → 发送 {type: 'gemini_response', text: chunk, isNewMessage: true/false}
    → 如果 use_tts=True → 文本入 TTS 队列

TTS 合成完成 → 发送 JSON header {type: 'audio_chunk', speech_id}
             → 发送二进制 PCM 音频数据

LLM 完成 → 发送 {type: 'system', data: 'turn end'}
```

关键文件：
- `main_routers/websocket_router.py` L96-110
- `main_logic/core.py` L715-819（start_session）
- `main_logic/core.py` L1751-1887（stream_data → 文本处理）
- `main_logic/omni_offline_client.py`（OmniOfflineClient.stream_text）

### 1.3 客户端接收

```
onMessage 回调（main.tsx L233）
    ├─ 二进制数据 → AudioService 自动播放 PCM（不进入此回调）
    └─ JSON 文本消息 → 先做 clientMessageId 去重检查
        ├─ session_started → setIsTextSessionActive(true), resolve pending promise
        ├─ session_failed  → setIsTextSessionActive(false), reject
        └─ 其余交给 chat.handleWebSocketMessage()
            ├─ gemini_response
            │   ├─ isNewMessage=true  → 创建新消息气泡
            │   └─ isNewMessage=false → 追加到现有气泡（流式）
            ├─ user_activity → mainManager.onUserSpeechDetected()（停止播放）
            ├─ turn end      → markLastMessageComplete(), mainManager.onTurnEnd()
            └─ catgirl_switched → clearMessages(), 重新加载角色
```

关键文件：
- `app/(tabs)/main.tsx` L233-310（onMessage）
- `hooks/useChatMessages.ts` L145-224（handleWebSocketMessage）

---

## 二、语音模式全链路

### 2.1 客户端发送

```
用户按下录音按钮 → toggleRecording()
    → AudioService.startVoiceSession({targetSampleRate: 16000})
        → 发送 {action: 'start_session', input_type: 'audio'}
        → PCMStream.startRecording()（原生层，16kHz）

录音中：
    onAudioFrame 事件（每帧 PCM）
        → 转为 Int16Array
        → 发送 {action: 'stream_data', input_type: 'audio', data: [int16...]}
```

关键文件：
- `hooks/useAudio.ts` L56-63（toggleRecording）
- `services/AudioService.ts`（startVoiceSession）
- `packages/project-neko-audio-service/src/native/audioServiceNative.ts`（原生录音 + 发送）

### 2.2 服务端处理

```
start_session(mode='audio')
    → 创建 OmniRealtimeClient（WebSocket 实时 API）
    → 注册回调：on_text_delta, on_audio_delta, on_input_transcript, on_output_transcript, on_response_done
    → 启动 TTS worker（如有自定义音色）
    → session_ready = True
    → 发送 {type: 'session_started', input_mode: 'audio'}

收到音频 stream_data：
    → _process_stream_data_internal()
        → 检查 session 类型为 OmniRealtimeClient
        → struct.pack 转为 bytes
        → 48kHz 输入 → RNNoise 降噪 + 降采样到 16kHz
        → 16kHz 输入（移动端）→ 直接使用
        → Base64 编码 → 发给 Realtime API
```

Realtime API 回调：
```
用户语音识别完成 → on_input_transcript
    → 发送 {type: 'user_transcript', text: "用户说的话"}

AI 生成回复 → on_output_transcript / on_text_delta
    → 发送 {type: 'gemini_response', text: chunk, isNewMessage: true/false}
    → 如果 use_tts=True → 文本入 TTS 队列合成后发二进制音频
    → 如果 use_tts=False → on_audio_delta 直接收到音频 → 重采样到 48kHz → 发二进制

回复完成 → on_response_done
    → 发送 {type: 'system', data: 'turn end'}
    → 触发 hot-swap 检查（session > 40s 则准备新 session）
```

关键文件：
- `main_logic/core.py` L1890-1939（音频 stream_data 处理）
- `main_logic/omni_realtime_client.py`（Realtime API 交互）
- `main_logic/tts_client.py`（TTS worker）
- `main_logic/core.py` L2323-2360（send_speech + TTS 响应处理）

### 2.3 客户端接收

```
onMessage 回调
    ├─ user_transcript → chat.addMessage(text, 'user')（显示语音转文字）
    ├─ gemini_response → 流式显示 AI 回复文字
    ├─ user_activity   → mainManager.onUserSpeechDetected()（打断，停止播放）
    └─ turn end        → markLastMessageComplete()

二进制数据（独立通道）
    → AudioService.handleIncomingBinary()
        → PCMStream.playPCMChunk(data)（播放音频）
        → 触发 onAmplitudeUpdate → useLipSync hook 更新口型
```

---

## 三、发现的问题及修复

> 所有修复均为纯客户端方案（仅修改 RN 端），不涉及服务端改动。

### ✅ 问题 1&2：`session_ended_by_server` 未处理 + `isTextSessionActive` 缺少重置机制

**现象：**
- 服务端在 API 断连时发送 `{type: 'session_ended_by_server'}`，但客户端未处理
- `isTextSessionActive` 一旦为 `true` 几乎不会重置，后续全靠服务端自动恢复兜底

**修复（main.tsx `onMessage` 回调）：**
1. 新增 `session_ended_by_server` 处理 → 重置 `isTextSessionActive = false`
2. 收到 `session_started` 且 `input_mode=audio` 时 → 重置 `isTextSessionActive = false`（audio session 启动意味着 text session 已被替换）
3. WebSocket 断开时已有重置逻辑（`onConnectionChange`），无需额外修改

### ✅ 问题 3：文本 ↔ 语音模式切换的竞态条件

**现象：** 用户正在语音模式时发文本，`ensureTextSession` 直接发 `start_session(text)`，可能撞上服务端 `is_starting_session` 防重入，导致 15 秒超时失败。

**修复（main.tsx `ensureTextSession`）：**
- 在发送 `start_session(text)` 前，检测是否正在录音
- 如果正在录音，先调用 `toggleRecording()` 停止录音（会触发 `end_session`）
- 等待 500ms 让服务端完成旧 session 清理，再发 `start_session(text)`

### 🟡 问题 4（未修复）：`stream_data` 自动恢复时的消息顺序风险

**现象：** Session 不存在时，`stream_data` 自动触发 `start_session`，触发消息（A）在 `start_session` 完成后继续执行，但期间缓存的消息（B）会被先 flush。

**影响：** 文本模式下用户一般一条一条发，实际影响很小。需要修改服务端才能彻底解决，暂不处理。

### ⚪ 问题 5（未修复）：`clientMessageId` 去重逻辑是死代码

**现象：** 服务端从未在响应中附带 `clientMessageId`，客户端的去重检查永远不会触发。不影响功能。

---

## 四、链路总览图

```
┌─────────────────────────────────────────────────────────────────────┐
│                          客户端 (React Native)                       │
│                                                                     │
│  ChatInput ──→ handleSendMessage ──→ ensureTextSession              │
│       │                                    │                        │
│       │         ┌──────────────────────────┘                        │
│       │         ▼                                                   │
│       │   {start_session}  ──── WebSocket ────→  服务端              │
│       │         │                                                   │
│       │    等待 session_started                                      │
│       │         │                                                   │
│       ▼         ▼                                                   │
│   {stream_data, input_type: text/audio}  ──→  服务端                 │
│                                                                     │
│  ◄── {gemini_response}          ◄── 流式文本                         │
│  ◄── binary PCM                  ◄── TTS 音频                       │
│  ◄── {turn end}                  ◄── 回合结束                        │
│  ◄── {user_transcript}           ◄── 语音转文字                      │
│  ◄── {user_activity}             ◄── 打断信号                        │
│  ◄── {session_ended_by_server}   ◄── ✅ 已处理                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                          服务端 (FastAPI)                            │
│                                                                     │
│  websocket_router                                                   │
│       │                                                             │
│       ▼                                                             │
│  LLMSessionManager                                                  │
│       │                                                             │
│       ├── 文本模式 → OmniOfflineClient → ChatOpenAI (REST 流式)      │
│       │       └── on_text_delta → gemini_response + TTS 队列         │
│       │                                                             │
│       ├── 语音模式 → OmniRealtimeClient → Realtime API (WS 流式)     │
│       │       ├── on_input_transcript → user_transcript              │
│       │       ├── on_output_transcript → gemini_response + TTS      │
│       │       └── on_audio_delta → 直接音频（无 TTS 时）              │
│       │                                                             │
│       └── TTS Worker (独立线程)                                      │
│               └── 文本 → 语音合成 → binary PCM → 客户端               │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 五、修复状态总览

| 状态 | 问题 | 方案 |
|------|------|------|
| ✅ 已修复 | `session_ended_by_server` 未处理 | 客户端新增消息处理，重置 session 状态 |
| ✅ 已修复 | `isTextSessionActive` 缺少重置 | audio session 启动时 / 断连时 / 服务端终止时均重置 |
| ✅ 已修复 | 模式切换竞态条件 | 切换前先停止录音，等待旧 session 清理 |
| 🟡 暂缓 | 自动恢复消息顺序 | 需改服务端，实际影响小 |
| ⚪ 暂缓 | clientMessageId 去重死代码 | 不影响功能 |
