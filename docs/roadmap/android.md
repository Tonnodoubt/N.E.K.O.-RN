# Android 端路线图

> **最后更新**：2026-02-20
> **状态**：核心功能已完成，进入管理页面开发阶段
>
> 📋 完整开发计划见 [ROADMAP.md](../ROADMAP.md)

---

## 当前状态

✅ **核心链路已完成**（真机验证通过）：
- Live2D 渲染 + WS 通信 + 音频上下行 + 唇同步 + MainManager 协调
- ChatContainer WS 集成（文本消息流式显示）
- StatusToast.native.tsx ✅
- Modal/index.native.tsx ✅

---

## 下一步工作

| 优先级 | 任务 | 状态 |
|--------|------|------|
| P1 | 角色管理页面 | ⏳ 待开发 |
| P1 | 设置页面 | ⏳ 待开发 |
| P2 | 相机/图片发送 | ⏳ 待开发 |
| P2 | 后台音频播放 | ⏳ 待开发 |

---

## 历史完成项

### ✅ P0：主界面"字幕/聊天"闭环

- **P0-1**：✅ 把主界面的 WS 文本消息接入 `ChatContainer.native.tsx` 的 UI 展示。
  - 方案：`ChatContainer` 支持受控 props（`externalMessages/onSendMessage/connectionStatus`）。
  - 验收：`gemini_response` 流式追加能在 UI 上逐字增长；`turn end` 后标记完成。
  - **相关文档**：[Chat Text Conversation Feature Spec](../../../N.E.K.O/docs/frontend/spec/chat-text-conversation.md)（位于 N.E.K.O 仓库）

- **P0-2**：✅ 把"发送文本"打通到后端（与 Web 侧流程对齐）。
  - 验收：用户输入能触发后端回复（走 WS `stream_data` action）。
  - **新增特性**：
    - 移动端拍照支持（`getUserMedia` + 优先后置摄像头）
    - `clientMessageId` 消息去重机制
    - Ref 模式防止 WebSocket 重连
  - **相关文档**：[WebSocket 稳定性改进总结](../../../N.E.K.O/docs/frontend/SUMMARY-websocket-stability-improvements-2026-01-18.md)（位于 N.E.K.O 仓库）

### ✅ P1：Toast/Modal 原生化

- **P1-1**：✅ `StatusToast.native.tsx` 已实现
- **P1-2**：✅ `Modal/index.native.tsx` 已实现（AlertDialog/ConfirmDialog/PromptDialog）

### P2：Live2D 手势 + Preferences 持久化 ⏳

- **P2-1**：⏳ JS 层接入拖拽/捏合，把手势映射到 `scale/position`（原生 view 已支持 props 控制）。
- **P2-2**：⏳ 把 `useLive2DPreferences` 真正接入 `useLive2D`（当前主界面存在 TODO）。

### P3：Settings 菜单流程落地 ⏳

- **方案**：开发原生页面 或 用 WebView 打开后端现有页面

---

## 2. 验收建议（最小集合）

- **会话与音频**
  - Mic 打开：能录音上行；后端能回音频下行并播放。
  - 用户说话：能触发打断（stopPlayback）并恢复下一轮。

- **UI 与状态一致性**
  - 工具栏 Mic 状态与实际录音状态一致（失败时回落并提示）。
  - 聊天面板能显示真实 WS 文本消息（流式追加）。

- **Live2D**
  - 模型加载稳定；onBlur unload 不崩；LipSync 仅在 JS+Native ready 且页面聚焦时启用。

