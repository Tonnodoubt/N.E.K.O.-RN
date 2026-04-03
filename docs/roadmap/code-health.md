# Code Health Roadmap

> **状态**: 进行中
> **最近更新**: 2026-03-16

## 概述

本文档记录 N.E.K.O.-RN 代码库中已识别的健康问题，按影响程度排列优先级。每项包含问题描述、受影响文件及修复方案。

---

## Critical

### CH-01: 缺少根级脚本 (test / type-check / lint:all)

- **文件**: `package.json` (root)
- **问题**: 根 `package.json` 没有 `test`、`type-check` 或全量 lint 脚本。CI 无法运行质量检查，新贡献者没有统一的验证命令。
- **修复**: 添加三个脚本：
  - `"type-check": "tsc --noEmit"` — 全量 TypeScript 类型检查
  - `"test": "npm run test --workspaces --if-present"` — 分发到各 workspace 包运行测试
  - `"lint:all": "expo lint"` — 使用 Expo 配置运行 ESLint
- **状态**: ✅ 已修复

### CH-02: WebSocket URL 未做输入校验

- **文件**: `services/wsService.ts` (第 31 行)
- **问题**: `host`、`port`、`characterName` 直接拼接为 URL 字符串，无任何验证。恶意或异常输入可能导致连接到非预期地址。
- **修复**: 在 `WSService` 类中添加 `validateConfig()` 方法，在 `init()` 开头调用。校验规则：
  - host: 非空字符串，不含 `/ ? # \s`
  - port: 1–65535 整数
  - characterName: 非空字符串，不含 `/ ? # \s`
- **状态**: ✅ 已修复

### CH-03: loadModel() 缺少错误边界

- **文件**: `services/Live2DService.ts` (第 349 行)
- **问题**: `this.core.loadModel()` 被 await 但未包裹 try-catch。网络或文件系统错误会产生未捕获的 Promise rejection。
- **修复**: 用 try-catch 包裹，捕获后调用 `this.config.onModelError?.(...)` 通知上层。core 的 stateChanged 事件会自动将状态置为 error，状态机保持一致。
- **状态**: ✅ 已修复

### CH-04: AudioService / wsService 大量 `any` 类型

- **文件**:
  - `services/AudioService.ts` — 第 63, 152, 164, 174, 179-195, 388, 518 行
  - `services/wsService.ts` — 第 75-88, 94, 140 行
- **问题**: 大量 `as any` 绕过 TypeScript 类型保护，隐藏真实类型不匹配，使编译时检查失效。
- **修复**:
  - **AudioService**: 定义 `InternalAudioService` 类型（含 `on`/`detach`/`getState`），替换字段类型并移除 `as any`
  - **wsService**: 导入 `RealtimeEventMap` 类型，用具体事件类型替换 `(evt: any)`；`send()` 参数改为 `string | Record<string, unknown>`
- **状态**: ✅ 已修复

---

## High

### CH-05: 无 CI/CD 流水线

- **问题**: 项目没有 `.github/workflows/` 目录。无自动化质量门禁。
- **修复**: 添加 `.github/workflows/ci.yml`，覆盖 lint + type-check + test。触发条件：push 到 main/neko_mobile 分支 + PR 到 main。
- **状态**: ✅ 已修复

### CH-06: WebSocket 消息未做 schema 校验

- **文件**: `hooks/useChatMessages.ts` (第 156 行)
- **问题**: `JSON.parse(event.data)` 的结果直接使用，没有运行时形状检查。畸形的服务端消息可能导致运行时错误。
- **修复**: 添加 `ServerMessage` 接口和 `isServerMessage()` 类型守卫，在解析后立即做类型检查。不引入新依赖（使用 TypeScript 原生 narrowing）。
- **状态**: ✅ 已修复

### CH-07: AudioService 静默吞错

- **文件**: `services/AudioService.ts` (第 284 行)
- **问题**: `catch (_e) { // ignore }` 完全吞掉错误，调试时无法发现 `end_session` 发送失败。
- **修复**: 改为 `catch (e) { console.debug('[AudioService] Failed to send end_session (non-fatal):', e); }`。用 debug 级别避免惊扰用户，但开发时可见。
- **状态**: ✅ 已修复

### CH-08: Wildcard 依赖版本

- **文件**: `package.json` (第 52-53 行)
- **问题**: `react-native-live2d` 和 `react-native-pcm-stream` 使用 `"*"` 通配符。虽然 workspace 会解析到本地包，但表意不清且有潜在风险。
- **修复**: 改为 `"0.1.0"` 以匹配各包实际版本。
- **状态**: ✅ 已修复

---

## Medium

### CH-09: Stats 轮询硬编码 500ms

- **文件**: `services/AudioService.ts` (第 220 行)
- **问题**: 固定 500ms 间隔不可配置，在不展示统计信息时浪费 CPU。
- **修复**: 在 `AudioServiceConfig` 中添加 `statsIntervalMs?: number`，默认值改为 1000ms。调用方可按需覆盖。
- **状态**: ✅ 已修复

### CH-10: Web 平台 TODO 占位方法

- **文件**: `services/AudioService.ts` (第 380, 397 行)
- **问题**: `handleBase64Audio` 和 `handleAudioBlob` 是空占位实现。
- **现状**: 已有 `console.warn` 提示，且音频播放已由 `@project_neko/audio-service` 接管。
- **修复**: 暂不处理。这些方法实际已不再被调用，可在后续清理中移除。
- **状态**: ⏳ 低优先级，暂缓
