# RN 移动端项目现状评估

> 评估时间：2026-02-19
> 评估基准：N.E.K.O.-RN `RN` 分支 + N.E.K.O `main` 分支后端

---

## 1. 总体完成度：~90-95%

核心实时对话链路（语音输入 → AI 处理 → 语音输出 + Live2D 动画）已经 **端到端打通**。剩余工作主要是真机验证、体验打磨和少量缺失功能补全。

---

## 2. 功能完成度详表

### 2.1 核心功能（全部完成）

| 功能 | 状态 | 实现位置 | 说明 |
|------|------|---------|------|
| WebSocket 连接 | ✅ 100% | `services/wsService.ts` | 自动重连（3s 间隔，5 次）、心跳（30s）、JSON 解析 |
| 语音录制（麦克风） | ✅ 100% | `services/AudioService.ts` + `@project_neko/audio-service` | PCM 16-bit 采集 → stream_data 上传 |
| 语音播放（TTS） | ✅ 100% | `@project_neko/audio-service` + `react-native-pcm-stream` | 接收二进制 PCM 帧 → 原生播放 |
| Live2D 渲染 | ✅ 100% | `services/Live2DService.ts` + `react-native-live2d` | 模型加载、缓存、动作、表情 |
| 唇同步 | ✅ 100% | `services/LipSyncService.ts` | PCM 振幅 → 嘴型参数，阈值过滤 |
| 聊天界面 | ✅ 100% | `@project_neko/components` ChatContainer.native.tsx | 消息收发、去重（5min TTL）、文本输入 |
| 工具栏 | ✅ 100% | `@project_neko/components` Live2DRightToolbar.native.tsx | 麦克风开关、设置面板、Agent 面板 |
| 连接配置 | ✅ 100% | `hooks/useDevConnectionConfig.ts` + `app/qr-scanner.tsx` | QR 扫码、手动输入、AsyncStorage 持久化 |
| 偏好持久化 | ✅ 100% | `hooks/useLive2DPreferences.ts` | 模型位置/缩放，模糊匹配 |
| MainManager 协调 | ✅ 100% | `utils/MainManager.ts` | 情绪映射、打断逻辑、服务间调度 |
| 消息去重 | ✅ 100% | `hooks/useChatMessages.ts` | clientMessageId 去重，1000 条上限 |
| 文本会话管理 | ✅ 100% | `app/(tabs)/main.tsx` | start_session / session_started 协议 |

### 2.2 部分完成功能

| 功能 | 状态 | 实现位置 | 缺失说明 |
|------|------|---------|---------|
| Live2D 参数系统 | 🟡 85% | `@project_neko/live2d-service` native | 嘴型参数可用，但完整参数 API（setParameters/getParameterIds）未暴露 |
| Agent 后端集成 | 🟡 85% | `hooks/useLive2DAgentBackend.ts` | 健康检查轮询、Flag 管理可用，部分高级功能依赖后端版本 |
| 情绪检测 | 🟡 框架在 | `utils/MainManager.ts:116` | 情绪 → 表情/动作映射完成，但 NLP 分析部分标记 TODO（用固定表情兜底） |

### 2.3 未实现功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 屏幕共享 | ❌ 占位 | `app/(tabs)/main.tsx:327` placeholder，需求未定义 |
| 相机/图片发送 | ❌ 未接入 | ChatContainer.native.tsx:289 有注释代码，需添加 `expo-image-picker` 依赖 |
| Web 平台音频 | ❌ 存根 | `AudioService.ts:378-399` Web 回退方法标记 TODO（非优先级） |
| 角色切换 UI | ❌ 无界面 | 后端 API `/api/characters/` 已有，RN 端缺角色列表页面 |
| 后台音频播放 | ❌ 未实现 | AI 说话时切后台会中断 |
| 推送通知 | ❌ 未实现 | AI 主动消息场景 |

---

## 3. 服务层详细评估

### 3.1 wsService.ts — WebSocket 服务

```
状态: ✅ 生产就绪
```

- 基于 `@project_neko/realtime` 的 `createNativeRealtimeClient()`
- 连接生命周期管理（init / close / destroy）
- 消息发送支持类型转换
- 事件监听（open / message / error / close）
- 自动重连：固定 3 秒间隔，最多 5 次
- 心跳：30 秒 ping
- JSON 自动解析（parseJson: true）

### 3.2 AudioService.ts — 音频服务

```
状态: ✅ 原生平台生产就绪 / Web 平台存根
```

- 音频服务初始化（WebSocket + AudioService 绑定）
- 录音生命周期（start / stop / toggle）
- 语音会话管理（带超时）
- 状态轮询（500ms 间隔）
- 二进制音频播放（@project_neko/audio-service 处理）
- 跨平台检测（Platform.OS）
- 输入/输出振幅追踪
- 资源清理和销毁

**Web 平台存根**（不影响原生）：
- `handleBase64Audio()` — 标记 TODO
- `handleAudioBlob()` — 标记 TODO

### 3.3 Live2DService.ts — Live2D 服务

```
状态: ✅ 核心功能完成
```

- 模型下载管道（缓存管理）
- 依赖验证（model3.json + moc3 文件检查）
- 动画控制（playMotion / setExpression）
- 变换控制（scale / position / reset）
- 自动呼吸/自动眨眼
- View Props 聚合（传递给 RN View）
- 错误处理和资源清理

**已知限制**：
- Native 模块的完整参数 API 未完全暴露（嘴型参数已够用）

### 3.4 LipSyncService.ts — 唇同步服务

```
状态: ✅ 生产就绪
```

- PCMStream 振幅监听
- 阈值过滤（可配置 minAmplitude）
- 振幅缩放和钳制
- 无平滑（即时响应，与 Web 版一致）
- 播放停止检测 + 嘴型复位

---

## 4. Hooks 层评估

| Hook | 状态 | 职责 |
|------|------|------|
| `useAudio.ts` | ✅ 100% | AudioService 的 React 包装，连接状态/录音状态/统计轮询 |
| `useLive2D.ts` | ✅ 100% | Live2DService 包装，模型加载去重/状态同步/Props 聚合 |
| `useLipSync.ts` | ✅ 100% | LipSyncService 生命周期管理 |
| `useChatMessages.ts` | ✅ 90% | 消息流处理、去重、类型判别、历史限制 |
| `useDevConnectionConfig.ts` | ✅ 100% | QR 解析、AsyncStorage 持久化、配置校验 |
| `useLive2DAgentBackend.ts` | 🟡 85% | Agent 健康检查轮询、Flag 管理 |
| `useLive2DPreferences.ts` | ✅ 100% | AsyncStorage 偏好存储、模糊匹配 |

---

## 5. 共享 Packages 状态

| 包名 | Native 入口 | 状态 | 说明 |
|------|------------|------|------|
| `@project_neko/common` | 无需（纯 TS） | ✅ 完整 | 通用工具函数和类型 |
| `@project_neko/request` | `index.native.ts` + `storage/index.native.ts` | ✅ 完整 | AsyncStorage Token 存储 |
| `@project_neko/realtime` | `index.native.ts` | ✅ 完整 | 标准 WebSocket，无需特殊处理 |
| `@project_neko/audio-service` | `index.native.ts` + `src/native/audioServiceNative.ts` | ✅ 完整 | PCMStream 集成、Int16Array 转换、振幅追踪 |
| `@project_neko/live2d-service` | `index.native.ts` + `src/native/index.ts` | 🟡 85% | 核心可用，参数 API 接口不完整 |
| `@project_neko/components` | 各组件 `.native.tsx` | ✅ 完整 | Live2DRightToolbar / ChatContainer / Modal / StatusToast |

---

## 6. 原生模块状态

### react-native-live2d（git submodule）

```
位置: packages/react-native-live2d/
平台: Android (Kotlin) + iOS (Swift)
状态: ✅ 核心功能可用
```

已实现的 Native API：
- `initializeLive2D` — 初始化引擎
- `startMotion` — 播放动作
- `setExpression` — 设置表情
- `setMouthValue` / `getMouthValue` — 嘴型参数

未完全暴露：
- `setParameters` — 批量参数设置
- `getParameterValueById` / `getParameterIds` — 参数查询

### react-native-pcm-stream（git submodule）

```
位置: packages/react-native-pcm-stream/
平台: Android (AudioTrack/AudioRecord) + iOS (AVAudioEngine)
状态: ✅ 生产就绪
```

已实现：
- 16-bit PCM 流式播放（48kHz, Mono）
- 麦克风 PCM 采集
- 低延迟音频通路
- 振幅回调
- Web 降级实现

---

## 7. 后端兼容性（N.E.K.O main 分支）

| 需求 | main 分支后端 | 说明 |
|------|-------------|------|
| CORS 开放 | ✅ `allow_origins=["*"]` | 手机任意 IP 可连 |
| WebSocket 端点 | ✅ `/ws/{lanlan_name}` | 协议完全兼容 |
| 配置 API | ✅ `/api/config/*` | page_config / preferences / language |
| 角色 API | ✅ `/api/characters/*` | 列表 / 切换 / 语音状态 |
| Agent API | ✅ `/api/agent/*` | flags / health / availability |
| 静态文件服务 | ✅ `/static/` `/user_live2d/` | Live2D 模型文件 |
| QR 码发现 | ✅ `/getipqrcode` | 自动检测局域网 IP |
| 服务器绑定 | ✅ `0.0.0.0` | 局域网可达 |

**注意**：`main` 分支后端的 WebSocket 路由使用 `lanlan_name` 参数名，RN 端使用 `characterName`，但 URL 路径格式一致（`/ws/{角色名}`），不影响连接。

---

## 8. 页面结构现状

### 主要页面

| 页面 | 路径 | 状态 | 说明 |
|------|------|------|------|
| 首页（开发菜单） | `app/(tabs)/index.tsx` | ✅ 功能正常 | 测试页面导航入口 |
| 主交互页 | `app/(tabs)/main.tsx` | ✅ 95% | Live2D + 语音 + 聊天的核心页面 |
| QR 扫码 | `app/qr-scanner.tsx` | ✅ 功能正常 | 连接配置 |
| WebApp 容器 | `app/webapp.tsx` | ✅ 功能正常 | WebView 加载 Web 前端 |

### 测试/调试页面

| 页面 | 路径 | 用途 |
|------|------|------|
| 音频测试 | `app/audio-test.tsx` | 麦克风/播放调试 |
| Live2D 测试 | `app/rnlive2d.tsx` | 模型渲染调试 |
| PCM 流测试 | `app/pcmstream-test.tsx` | 音频流调试 |
| 请求实验室 | `app/request-lab.tsx` | HTTP 请求调试 |

---

## 9. 已知技术债务

1. **无同步来源追踪** — packages 同步脚本不记录上游 commit hash，无法判断是否最新
2. **Web 平台音频存根** — AudioService 的 Web 回退未实现（仅影响 Expo Web）
3. **Live2D 参数 API 不完整** — Native 模块未暴露完整参数查询接口
4. **debug 日志残留** — `useLive2D.ts:114` 等处有 console.log 未清理
5. **ChatContainer 相机代码注释** — 等待 image-picker 依赖接入

---

## 10. 结论

RN 移动端的核心架构和功能已基本完成。当前阶段的重点不是"继续写新代码"，而是：

1. **真机验证** — 在 Android/iOS 真机上跑通核心链路
2. **体验打磨** — 音频延迟、断线恢复、权限处理
3. **缺失功能按需补全** — 角色切换、相机、后台播放等

详细开发步骤见 [RN 移动端开发指南](./rn-development-guide.md)。
分支合并策略见 [分支合并策略](./branch-merge-strategy.md)。
