# N.E.K.O 与 N.E.K.O.-RN 跨项目集成架构

本文档描述 **N.E.K.O**（Python 后端 + Web 前端）与 **N.E.K.O.-RN**（React Native 移动端）两个仓库如何协同工作，共同实现跨平台的 AI 虚拟角色实时交互体验。

---

## 1. 全局架构总览

```
┌──────────────────────────────────────────────────────────────┐
│                   N.E.K.O (Python Backend)                   │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ FastAPI 主服务│  │ Memory 服务  │  │ Agent / Brain 服务│  │
│  │ :48911       │  │ :48912       │  │                   │  │
│  └──────┬───────┘  └──────────────┘  └───────────────────┘  │
│         │                                                    │
│  ┌──────┴───────────────────────────────────────────────┐   │
│  │  WebSocket (/ws/{characterName})  +  REST API (/api) │   │
│  └──────┬──────────────────────────────────┬────────────┘   │
└─────────┼──────────────────────────────────┼────────────────┘
          │                                  │
          │  WebSocket + REST                │  WebSocket + REST
          │  (完全相同的协议)                  │  (完全相同的协议)
          ▼                                  ▼
┌──────────────────────┐      ┌─────────────────────────────────┐
│   N.E.K.O Frontend   │      │        N.E.K.O.-RN              │
│   (React + Vite)     │      │   (React Native + Expo)         │
│                      │      │                                 │
│  桌面浏览器 / Web     │      │  iOS / Android 原生应用          │
│                      │      │                                 │
│  ┌────────────────┐  │      │  ┌───────────────────────────┐  │
│  │ 共享 packages  │  │      │  │ 共享 packages (同步镜像)   │  │
│  │ (source of     │◄─┼──────┼──│ + 原生模块 (Live2D, PCM)  │  │
│  │  truth)        │  │  同步 │  └───────────────────────────┘  │
│  └────────────────┘  │      │                                 │
└──────────────────────┘      └─────────────────────────────────┘
```

### 核心设计理念

- **后端统一**：Web 和 RN 客户端连接同一个 Python FastAPI 后端，使用完全相同的通信协议
- **包共享**：前端核心逻辑封装在 monorepo packages 中，通过条件导出（Conditional Exports）实现跨平台
- **原生补充**：RN 端通过原生模块提供 Web 无法覆盖的平台能力（Live2D 渲染、PCM 音频流）

---

## 2. 仓库职责划分

| 仓库 | 技术栈 | 职责 |
|------|--------|------|
| **N.E.K.O** | Python 3.11, FastAPI, React 19, Vite | AI 对话引擎、TTS、记忆系统、WebSocket 服务、Web 前端、**共享 packages 源** |
| **N.E.K.O.-RN** | React Native 0.81, Expo 54, TypeScript | iOS/Android 原生客户端、原生模块（Live2D / PCM）、移动端 UI |

### 关键目录对照

```
N.E.K.O/                               N.E.K.O.-RN/
├── main_server.py      (后端入口)
├── main_routers/
│   └── websocket_router.py  (WS 端点)
├── main_logic/         (AI 对话逻辑)
├── memory/             (记忆系统)
├── frontend/
│   ├── src/            (Web React 应用)
│   └── packages/       (共享包 - 源)    ──同步──►  packages/project-neko-*/
│       ├── common/                                  ├── project-neko-common/
│       ├── request/                                 ├── project-neko-request/
│       ├── realtime/                                ├── project-neko-realtime/
│       ├── audio-service/                           ├── project-neko-audio-service/
│       ├── live2d-service/                          ├── project-neko-live2d-service/
│       └── components/                              └── project-neko-components/
│
│                                       ├── packages/  (RN 独有)
│                                       │   ├── react-native-live2d/     (原生模块)
│                                       │   └── react-native-pcm-stream/ (原生模块)
│                                       ├── app/       (Expo Router 页面)
│                                       ├── services/  (服务层)
│                                       ├── hooks/     (React Hooks)
│                                       └── utils/     (工具 & MainManager)
```

---

## 3. 通信协议

两端客户端与后端的通信协议完全一致，详细规格见 [WebSocket 协议规范](../specs/websocket.md)。

### 3.1 WebSocket 实时通道

**端点**：`ws://{host}:{port}/ws/{characterName}`

| 方向 | 消息类型 | 格式 | 用途 |
|------|---------|------|------|
| C2S | `start_session` | JSON | 开启对话会话 |
| C2S | `stream_data` | JSON (含 Int16 数组) | 上行麦克风 PCM 音频 |
| C2S | `end_session` | JSON | 结束会话 |
| C2S | `ping` | JSON | 心跳保活 |
| S2C | `gemini_response` | JSON | AI 文本回复（流式） |
| S2C | `user_activity` | JSON | 检测到用户语音（触发打断） |
| S2C | `system: turn end` | JSON | 回合结束 |
| S2C | 二进制帧 | Raw PCM | 下行语音（48kHz, PCM16LE, Mono） |

### 3.2 REST API

**基地址**：`http://{host}:{port}`

| 端点 | 用途 |
|------|------|
| `/api/config/page_config` | 页面/角色配置 |
| `/api/agent/*` | Agent 状态管理 |
| 其他业务 API | 文件上传、设置管理等 |

### 3.3 后端 WebSocket 实现

后端 WebSocket 端点位于 `N.E.K.O/main_routers/websocket_router.py`：

```python
@router.websocket("/ws/{lanlan_name}")
```

> **注意**：后端使用 `lanlan_name` 作为路径参数名，对应 RN 端的 `characterName`。

---

## 4. 共享 Packages 机制

### 4.1 条件导出（Conditional Exports）

共享包的核心跨平台策略是利用 `package.json` 的 `exports` 字段，让打包工具（Vite / Metro）自动选择对应平台的实现文件：

```json
{
  "name": "@project_neko/realtime",
  "exports": {
    ".": {
      "react-native": "./index.native.ts",
      "browser": "./index.web.ts",
      "default": "./index.ts"
    }
  }
}
```

运行时：
- **Web 浏览器**（Vite 构建）→ 解析到 `index.web.ts`
- **React Native**（Metro 构建）→ 解析到 `index.native.ts`
- **Node / 默认**→ 解析到 `index.ts`

### 4.2 各共享包详情

| 包名 | 功能 | Web 实现 | RN 实现 | 平台差异说明 |
|------|------|----------|---------|-------------|
| `@project_neko/common` | 通用工具函数、类型定义 | 统一 | 统一 | 无平台差异，纯 TypeScript |
| `@project_neko/request` | HTTP 客户端、Token 管理 | `localStorage` 存储 Token | `AsyncStorage` 存储 Token | 存储后端不同 |
| `@project_neko/realtime` | WebSocket 客户端、自动重连、心跳 | 浏览器 `WebSocket` | RN 原生 `WebSocket` | 连接 API 略有差异 |
| `@project_neko/audio-service` | 麦克风采集 + 音频播放 | Web Audio API + AudioWorklet | `react-native-pcm-stream` 原生模块 | 底层音频 API 完全不同 |
| `@project_neko/live2d-service` | Live2D 渲染控制 | PixiJS + Cubism Web SDK | `react-native-live2d` 原生模块 | 渲染引擎完全不同 |
| `@project_neko/components` | UI 组件（聊天、工具栏、弹窗） | React DOM 组件 + CSS | React Native 组件（`.native.tsx`） | UI 层各自实现 |

### 4.3 同步流程

**源（Source of Truth）**：`N.E.K.O/frontend/packages/*`

**同步方向**：单向，从 N.E.K.O → N.E.K.O.-RN

```bash
# 在 N.E.K.O.-RN 根目录执行
node scripts/sync-neko-packages.js --verbose

# 同步后验证
npm install
npm run typecheck
```

**RN 本地差异处理**：通过 `packages-overrides/` 目录叠加（overlay），避免同步时被覆盖。

> 详细同步流程见 [上游 packages 同步指南](../guides/upstream-sync.md)。

---

## 5. RN 端原生能力补充

RN 端通过两个自研原生模块弥补 Web 平台无法提供的能力，均以 git submodule 形式引入：

### 5.1 react-native-live2d

- **位置**：`packages/react-native-live2d/`（git submodule）
- **功能**：在原生层渲染 Live2D Cubism 模型
- **能力**：
  - 模型加载与缓存
  - 动作（Motion）播放与表情（Expression）切换
  - 触摸/点击交互
  - 自动呼吸与眨眼动画
  - 口型参数实时驱动（配合 LipSyncService）
- **平台**：Android (Kotlin) / iOS (Swift)

### 5.2 react-native-pcm-stream

- **位置**：`packages/react-native-pcm-stream/`（git submodule）
- **功能**：原生 PCM 音频流播放与录制
- **能力**：
  - 16-bit PCM 流式播放（48kHz, Mono）
  - 麦克风 PCM 采集
  - 低延迟音频通路
- **平台**：Android (AudioTrack/AudioRecord) / iOS (AVAudioEngine)
- **Web 降级**：提供 Web Audio API 的兼容实现

---

## 6. 手机端运行时序

### 6.1 连接建立

```
用户启动 App
    │
    ├── 首次使用 ──► QR 扫码 / 手动输入
    │                 解析 host:port:characterName
    │                 持久化到 AsyncStorage
    │
    └── 后续使用 ──► 从 AsyncStorage 读取配置
                      │
                      ▼
              wsService.connect()
              ┌─────────────────────────────┐
              │ createNativeRealtimeClient()│
              │ ws://host:48911/ws/{name}   │
              │ 心跳: 30s                    │
              │ 重连: 3s 间隔, 最多 5 次     │
              └─────────────────────────────┘
```

### 6.2 实时对话循环

```
┌─────────────────────────────────────────────────────────────┐
│                    完整对话循环                               │
│                                                             │
│  [用户说话]                                                  │
│      │                                                      │
│      ▼                                                      │
│  AudioService 采集麦克风 PCM                                 │
│      │                                                      │
│      ▼                                                      │
│  WebSocket 发送 stream_data { action, data: Int16[] }       │
│      │                                                      │
│      ▼                                                      │
│  ─── 后端 AI 处理（Gemini / 其他 LLM）───                    │
│      │                                                      │
│      ├──► gemini_response (JSON)  ──► ChatContainer 显示文本 │
│      │                                                      │
│      ├──► 二进制 PCM 音频帧       ──► AudioService 播放      │
│      │                                ──► LipSyncService    │
│      │                                    驱动 Live2D 口型   │
│      │                                                      │
│      └──► system: turn end        ──► MainManager           │
│                                       恢复角色中立状态       │
│                                                             │
│  [用户打断]                                                  │
│      │                                                      │
│      ▼                                                      │
│  后端发送 user_activity                                      │
│      │                                                      │
│      ▼                                                      │
│  MainManager.onUserSpeechDetected()                         │
│      ├── 停止音频播放                                        │
│      └── Live2D 切换到"倾听"姿态                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.3 MainManager 协调逻辑

`MainManager`（`utils/MainManager.ts`）是 RN 端的核心调度器，协调 Audio、Live2D 和 UI 三个子系统：

| 事件回调 | 触发时机 | 处理逻辑 |
|---------|---------|---------|
| `onGeminiResponse(isNewMessage)` | 收到 AI 文本 | 清空音频队列 → 播放"开心"动作/表情 → 转发文本到 UI |
| `onUserSpeechDetected()` | 检测到用户语音 | 停止音频播放 → Live2D 切换倾听姿态 |
| `onTurnEnd(fullText?)` | 回合结束 | 恢复中立状态（未来：情绪分析） |
| `applyEmotion(emotion)` | 情绪映射 | 将情绪枚举映射到 Live2D 表情 + 动作 |

**情绪映射表**：

| 情绪 | Live2D 表情 | Live2D 动作 |
|------|------------|------------|
| NEUTRAL | `exp_exp_01` | Idle |
| HAPPY | `exp_exp_02` | happy |
| SAD | `exp_exp_03` | sad |
| SURPRISED | `exp_exp_04` | surprised |
| ANGRY | `exp_exp_05` | sad (fallback) |

---

## 7. RN 端分层架构

```
┌──────────────────────────────────────────────────────┐
│  UI 层 (app/ & components/)                          │
│  Expo Router 页面 + React Native 组件                 │
├──────────────────────────────────────────────────────┤
│  Hooks 层 (hooks/)                                   │
│  useAudio, useLive2D, useLipSync, useChatMessages    │
│  将 Service 的事件流转为 React 响应式 State            │
├──────────────────────────────────────────────────────┤
│  协调层 (utils/MainManager.ts)                       │
│  跨服务业务逻辑编排                                    │
├──────────────────────────────────────────────────────┤
│  Service 层 (services/)                              │
│  AudioService, Live2DService, wsService, LipSync     │
│  纯 TypeScript Class，不依赖 React 生命周期            │
├──────────────────────────────────────────────────────┤
│  共享 Packages (@project_neko/*)                     │
│  request, realtime, audio-service, live2d-service    │
│  条件导出，Web/RN 各选各的实现                         │
├──────────────────────────────────────────────────────┤
│  Native Module 层                                    │
│  react-native-live2d, react-native-pcm-stream        │
│  Kotlin / Swift 原生代码                              │
├──────────────────────────────────────────────────────┤
│  底座                                                │
│  Cubism SDK, Android AudioTrack, iOS AVAudioEngine   │
└──────────────────────────────────────────────────────┘
```

---

## 8. 开发工作流

### 8.1 本地开发环境

1. **启动后端**（N.E.K.O 项目）：
   ```bash
   cd N.E.K.O
   python main_server.py   # FastAPI :48911
   ```

2. **启动 RN 开发服务器**（N.E.K.O.-RN 项目）：
   ```bash
   cd N.E.K.O.-RN
   npx expo start
   ```

3. **连接配置**：
   - 手机扫描 QR 码输入后端地址（`host:48911`）
   - 或使用 `EXPO_PUBLIC_API_BASE_URL` 环境变量

### 8.2 共享包开发流程

```
修改需求
   │
   ├── 改业务逻辑（两端共用）
   │     │
   │     ▼
   │   在 N.E.K.O/frontend/packages/ 中修改 (上游源)
   │     │
   │     ▼
   │   Web 端验证通过
   │     │
   │     ▼
   │   同步到 N.E.K.O.-RN:
   │   node scripts/sync-neko-packages.js --verbose
   │     │
   │     ▼
   │   RN 端验证通过
   │
   └── 改 RN 平台特有逻辑
         │
         ▼
       在 N.E.K.O.-RN/packages-overrides/ 中修改 (overlay)
         │
         ▼
       不会被同步覆盖
```

### 8.3 原生模块开发

原生模块（`react-native-live2d`, `react-native-pcm-stream`）为 git submodule，需单独维护：

```bash
# 更新 submodule
git submodule update --remote packages/react-native-live2d
git submodule update --remote packages/react-native-pcm-stream

# 重新构建原生代码
npx expo prebuild --clean
```

---

## 9. 配置连接方式

RN 端提供多种方式配置后端连接：

| 方式 | 格式 | 适用场景 |
|------|------|---------|
| QR 扫码 (JSON) | `{"host":"192.168.x.x","port":48911,"characterName":"test"}` | 推荐，开发调试 |
| QR 扫码 (URL) | `nekorn://dev?host=...&port=...&name=...` | 自定义 scheme |
| QR 扫码 (简写) | `192.168.x.x:48911?name=test` | 快速输入 |
| 环境变量 | `EXPO_PUBLIC_API_BASE_URL` | CI / 固定环境 |
| 全局注入 | `globalThis.API_BASE_URL` | WebView 模式 |

---

## 10. 多客户端共存

后端天然支持多客户端同时连接：

```
                    ┌─── 浏览器 A (Web)
                    │
FastAPI :48911 ─────┼─── 浏览器 B (Web)
                    │
                    ├─── iPhone (RN)
                    │
                    └─── Android (RN)
```

每个客户端建立独立的 WebSocket 会话，共享同一套 AI 对话逻辑和记忆系统。

---

## 相关文档

- [架构设计](./design.md) — RN 端内部分层架构
- [WebSocket 协议规范](../specs/websocket.md) — 详细消息格式
- [上游 packages 同步指南](../guides/upstream-sync.md) — 同步流程与 overlay 机制
- [上游公共文档入口](../upstream/frontend-packages.md) — 共享 packages 逐包说明
- [系统概述](../core/overview.md) — 项目使命与技术栈
- [RN 开发策略](../strategy/rn-development.md) — 当前开发策略与组件现状
