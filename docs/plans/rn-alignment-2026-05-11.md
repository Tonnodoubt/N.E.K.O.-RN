# N.E.K.O.-RN 对齐主项目计划

> 日期: 2026-05-11
> 状态: DRAFT
> 目标: 以最小改动让 RN 客户端与当前主项目后端 (N.E.K.O) 完全兼容

---

## 1. 现状总结

### 1.1 主项目变化

主项目 (https://github.com/Project-N-E-K-O/N.E.K.O) 发生了结构性变化:

| 维度 | 之前 | 现在 |
|------|------|------|
| 前端包结构 | `frontend/packages/` (common, components, request, realtime...) | 已废弃，前端合并为 `react-neko-chat` + `plugin-manager` |
| 前端框架 | React monorepo | 独立 Vite 应用，Zod schema 定义消息格式 |
| 后端路由 | 基础 | 20+ routers，覆盖 agent/tool/galgame/game/music/jukebox/VRM/MMD 等 |
| 后端端口 | 48911 | 48911(main) + 48912(memory) + 48913(monitor) + 48915(agent) 等 |

### 1.2 RN 项目现状

**Workspace Packages 使用情况:**

| Package | 应用代码引用 | RN 原生模块 | 状态 |
|---------|-------------|-------------|------|
| `project-neko-common` | 0 (被其他包内部引用) | 无 | 基础依赖，保留 |
| `project-neko-components` | 1 文件 | 无 | Chat UI 组件，保留 |
| `project-neko-request` | 6 文件 | 有 platform 分支 | HTTP 客户端，保留 |
| `project-neko-realtime` | 1 文件 | 有 native/web 分支 | WS 客户端，**核心** |
| `project-neko-audio-service` | 3 文件 | 有 native/web 分支 | 音频服务，**核心** |
| `project-neko-live2d-service` | 1 文件 | 有 native 集成 | Live2D 管理，保留 |
| `project-neko-vad` | 0 (dist 目录) | 无 | 空的，未使用 |
| `react-native-live2d` | 4 文件 | **原生模块** | Live2D 渲染，**核心** |
| `react-native-pcm-stream` | 4 文件 | **原生模块** | PCM 播放，**核心** |

**RN 功能现状:**

| 功能 | 状态 | 说明 |
|------|------|------|
| Live2D 渲染 + 唇形同步 | 可用 | 拖拽/缩放/表情/呼吸/眨眼 |
| 文本聊天 | 可用 | stream_data + gemini_response |
| 语音对话 | 可用 | PCM 录音/播放，start_session(audio) |
| 实时摄像头视觉 | 可用 | CameraStreamService，帧间隔 ~1.5s |
| 角色管理 | 可用 | CRUD via REST API |
| QR 扫码配置 | 可用 | 连接配置 + P2P token |
| P2P/UDP 连接 | 可用 | 三层回退 (LAN/STUN/云中继) |
| VRM 渲染 | 不可用 | 只有预检页面 |
| i18n | 可用 | 6 语言 |

### 1.3 WS 协议对比

**好消息: WS 协议核心没变。** URL 格式 `ws://{host}:{port}/ws/{characterName}` 一致。

**RN 当前处理的消息类型 vs 后端当前发出的:**

| 后端发出 | RN 已处理 | 差距 |
|---------|----------|------|
| `gemini_response` (text, isNewMessage, turn_id, request_id) | 已处理 | 新增 `request_id` 字段未使用 |
| `audio_chunk` + binary PCM | 通过 audio-service 自动处理 | 兼容 |
| `session_started` / `session_preparing` / `session_failed` | 部分处理 | `session_preparing` 已有类型定义，但主聊天 UI 尚未显式展示 |
| `session_ended_by_server` | 已处理 | 兼容 |
| `status` | 已处理 | 兼容 |
| `system` (turn end) | 已处理 | 兼容 |
| `request_screenshot` | 待确认 | 只有用户主动拍照/附图链路，尚无服务端驱动的截图回传协议 |
| `catgirl_switched` | 已处理 | 兼容 |
| `avatar_interaction_ack` | 不需要 | 移动端无 avatar 点触 |
| `response_discarded` | 待确认 | 先确认后端是否真实发出，再决定 UI 清理逻辑 |
| agent/task 相关 | 不需要 | 移动端不需要 |

> 备注: `gemini_response` 里的 `request_id` / `turn_id` / `metadata` 先按可选字段处理，不要默认后端一定已发出。

### 1.4 对齐基线

- 后端基线：先记录当前对齐所依据的主项目 commit / tag，后续只以这个基线做比较。
- RN 基线：先确认本地 `npx expo start`、`npm run type-check`、`npm run lint` 都是可重复通过的状态，再开始改协议。
- 图片链路：当前存在多入口，后续只允许保留一套主发送路径。

---

## 2. 核心策略

**不做大手术。不 rebased。不重写。**

RN 项目的 9 个 workspace packages 虽然源头 (`frontend/packages/`) 没了，但它们已经在 RN 项目里独立运作。sync 脚本废了就废了，RN 的包自己做主。

策略:
1. **协议层对齐** — 确保 WS 消息格式与当前后端兼容
2. **清理死包** — 移除未使用且无价值的包 (vad)
3. **补齐缺失处理** — 处理新增的必要消息类型
4. **冻结 sync** — 删除或标记 sync 脚本为废弃
5. **保留现有架构** — 不引入主项目的 desktop-only 功能

---

## 3. 实施计划

### Phase 0: 前置准备 (预估 0.5h)

- [ ] **P0-1** 先确认当前未提交的 `package.json` / `package-lock.json` 变更是否只是 i18n 依赖重排，再决定提交还是合并进本次对齐
- [ ] **P0-2** 创建 `rn-alignment` 分支
- [ ] **P0-3** 确认 RN 项目能正常 `npx expo start` + 连接后端

### Phase 1: 清理废弃内容 (预估 1h)

- [ ] **P1-0** 删除前先做引用清点：`app/modal.tsx`、`app/webapp.tsx`、`scripts/sync-neko-packages.js` 的路由/脚本/文档引用都要先确认
- [ ] **P1-1** 删除 `project-neko-vad` 包 (空的 dist 目录，无引用)
- [ ] **P1-2** 将 `scripts/sync-neko-packages.js` 标记为废弃，但先保留脚本入口和 README 说明；等 RN 包冻结后再决定是否删除
- [ ] **P1-3** 清理 `packages-overrides/README.md`，更新说明"上游包已不存在"
- [ ] **P1-4** 删除或标记废弃页面:
  - `app/modal.tsx` — 如要删除，先同步处理 `qr-scanner` 返回路径和 `app/_layout.tsx` 的路由引用
  - `app/webapp.tsx` — 保留为调试/对齐页，不在本阶段删除

### Phase 2: WS 协议对齐 (预估 2h) — **核心**

- [ ] **P2-1** 在 `main.tsx` 的 onMessage 处理中增加/确认:
  - `session_preparing` — 显示 "准备中..." 状态
  - `response_discarded` — 若后端确实会发出，则清理流式 UI 状态
  - `request_screenshot` — 先确认后端协议；若要支持，再接入现有图片/截图发送链路

- [ ] **P2-2** 更新 `gemini_response` 处理:
  - `request_id` / `turn_id` / `metadata` 先按可选字段处理
  - 若后端实际返回这些字段，再决定是否用于去重、关联或回滚

- [ ] **P2-3** 更新 `start_session` 发送逻辑:
  - 确认 `audio_format: 'PCM_48000HZ_MONO_16BIT'` 仍被后端接受
  - `language` 字段仅在后端确认支持后再发送

- [ ] **P2-4** 更新 `stream_data` 文本发送:
  - 确认 `clientMessageId` 是否仍被后端回显；不回显也不影响当前客户端去重逻辑
  - 补做 `text` / `camera` / `image` 发送路径的字段对齐检查，避免图片链路继续漂移

- [ ] **P2-5** 收敛图片链路:
  - 明确 `services/imageMessage.ts` 与 `app/(tabs)/main.tsx` 的职责边界
  - 统一 `input_type` 语义，避免 `camera` / `image` 两套协议长期并存
  - 如果暂时不合并，至少在文档里明确哪一条是主路径、哪一条是临时路径

### Phase 3: REST API 对齐检查 (预估 1h)

- [ ] **P3-1** 检查 `services/api/` + `app/` + `hooks/` + `services/` 下所有 HTTP 客户端/手写 `fetch`:
  - `characters.ts` — 路径是否与后端一致 (`/api/characters/`)
  - `config.ts` — 路径是否一致 (`/api/config/`)
  - `pageConfig.ts` — 是否仍有效
  - `app/settings.tsx` 的 `fetch('/p2p-info')` 是否仍是当前约定

- [ ] **P3-2** 后端新增的有用 API (可选接入):
  - `GET /health` — 连接前健康检查
  - `GET /api/system/status` — 系统状态展示
  - `GET /api/config/api_providers` — 当前已在用，确认兼容
  - `GET /api/characters/persona-presets` — 角色预设列表
  - `POST /api/translate` — 翻译 API

### Phase 4: 类型定义更新 (预估 1h)

- [ ] **P4-1** 整理 RN 实际使用的 WS 协议类型:
  - 优先收敛 `app/(tabs)/main.tsx`、`hooks/useChatMessages.ts`、`packages/project-neko-audio-service/src/types.ts` 的消息定义
  - RN 继续保留简单 `text` 聊天模型，不直接照搬 web 端 `blocks` schema
  - 创建或合并到 `types/ws-messages.ts`，作为 RN 侧 wire contract 的单一入口

- [ ] **P4-2** 更新 `useChatMessages` hook 的消息模型:
  - 当前消息格式较简单 (text string)
  - 后端仍发 `text` 字符串，blocks 是前端渲染层概念
  - RN 可以继续用 `text` 字段，不需要实现 blocks 渲染

### Phase 5: 验证 (预估 1h)

- [ ] **P5-1** 启动后端 launcher + Metro + 手机连接
- [ ] **P5-2** 验证核心流程:
  - [ ] 文本对话 — 发送/接收/流式
  - [ ] 语音对话 — 录音/播放/打断
  - [ ] 摄像头视觉 — 帧发送/识别
  - [ ] 角色切换 — WS 重连/模型加载
  - [ ] 会话生命周期 — start/prepare/started/end
- [ ] **P5-2a** 验收门槛：以上 5 条任一失败，都不进入下一 phase
- [ ] **P5-3** 检查 type-check 是否通过 (`npm run type-check`)
- [ ] **P5-4** 检查 lint 是否通过 (`npm run lint`)

---

## 4. 风险评估

| 风险 | 级别 | 应对 |
|------|------|------|
| 后端 WS 协议有隐含变化 | 中 | Phase 5 实际连接测试验证 |
| 后端 REST API 路径变更 | 低 | Phase 3 逐一检查 |
| 包依赖断裂 (npm install 失败) | 低 | Phase 0 先验证基础构建 |
| Live2D 模型加载路径变化 | 低 | 检查 `/user_live2d/` 静态文件挂载是否一致 |
| 音频格式不兼容 | 低 | 后端仍接受 PCM，audio-service 未变 |
| `request_screenshot` 协议不明确 | 中 | 先确认后端是否发出，再接入截图回传链路 |
| 误删调试路由/同步脚本 | 中 | 先解除引用和文档依赖，再做删除 |
| 图片协议多入口长期并存 | 中 | 先收敛主路径，再保留临时兼容分支 |

---

## 5. 明确不做的事

| 不做 | 原因 |
|------|------|
| 引入 blocks 消息渲染 | 后端仍发 `text` 字段，blocks 是 web 前端渲染概念 |
| 实现 avatar interaction | 纯 PC 桌面功能 |
| 实现 agent/tool calling | 纯 PC 桌面功能 |
| 实现 galgame/game | 纯 PC 桌面功能 |
| 实现 jukebox/music | 纯 PC 桌面功能 |
| 实现 VRM/MMD 渲染 | VRM PoC 已有框架，但渲染器未就绪 |
| rebased 到主项目 | 架构差异太大，独立维护更合理 |
| 重新实现 sync 机制 | 上游包已不存在，RN 包自维护 |

---

## 6. 时间估计

| Phase | 内容 | 估计时间 |
|-------|------|---------|
| 0 | 前置准备 | 0.5h |
| 1 | 清理废弃内容 | 1h |
| 2 | WS 协议对齐 | 2h |
| 3 | REST API 检查 | 1h |
| 4 | 类型定义更新 | 1h |
| 5 | 验证 | 1h |
| **总计** | | **~6.5h** |

---

## 7. 长期方向

完成此次最小对齐后，RN 项目进入"自维护"模式:

1. **包冻结** — 9 个 workspace packages 不再尝试与主项目同步，作为 RN 专有代码维护
2. **协议契约** — 通过 `types/ws-messages.ts` 或现有消息类型集中定义与后端的 WS 协议契约，后端变更时同步更新
3. **API 契约** — 通过 `services/api/` 定义 REST API 契约，按需扩展
4. **独立演进** — RN 项目可以独立添加移动端特有功能 (通知、离线缓存、手势交互等)
