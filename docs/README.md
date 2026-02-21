# N.E.K.O.-RN 文档中心

> React Native 移动端开发文档
>
> **最新更新**: 2026-02-21

---

## 快速导航

| 我想... | 请看 |
|---------|------|
| 查看开发路线图 | [ROADMAP.md](./ROADMAP.md) |
| 查看开发进度 | 自己建的进度表 |
| 搭建开发环境 | [guides/development.md](./guides/development.md) |
| 排查问题 | [troubleshooting/](./troubleshooting/) |
| 了解架构 | [arch/design.md](./arch/design.md) |

---

## 核心文档

| 文档 | 说明 |
|------|------|
| [ROADMAP.md](./ROADMAP.md) | 开发路线图和功能规划（必读） |
| [core/overview.md](./core/overview.md) | 项目概述 |
| [arch/design.md](./arch/design.md) | 架构设计 |

---

## 目录结构

```
docs/
├── ROADMAP.md              # 开发路线图
│
├── arch/                   # 架构文档
│   ├── design.md          # 架构设计
│   ├── rn-development-guide.md  # 开发指南
│   └── ...
│
├── guides/                 # 开发指南
│   ├── development.md     # 开发与验收
│   ├── android-env-macos.md  # Android 环境
│   └── upstream-sync.md   # 同步主项目
│
├── modules/                # 模块文档
│   ├── audio.md           # 音频服务
│   ├── live2d.md          # Live2D 服务
│   └── coordination.md    # 主协调层
│
├── specs/                  # 规格文档
│   ├── websocket.md       # WebSocket 协议
│   └── states.md          # 状态机
│
├── troubleshooting/        # 故障排查
│   └── ...
│
└── strategy/               # 策略文档
    └── cross-platform-components.md
```

---

## 开发指南

### 环境搭建

1. [开发与验收](./guides/development.md) - 基础环境配置
2. [Android 环境 (macOS)](./guides/android-env-macos.md) - Android SDK/JDK 配置
3. [Android 运行指南](./platforms/android.md) - 构建运行调试

### 模块开发

| 模块 | 文档 |
|------|------|
| 音频 | [modules/audio.md](./modules/audio.md) |
| Live2D | [modules/live2d.md](./modules/live2d.md) |
| WebSocket | [specs/websocket.md](./specs/websocket.md) |

### 与主项目同步

- [上游 packages 同步](./guides/upstream-sync.md)
- [跨项目集成架构](./arch/cross-project-integration.md)

---

## 故障排查

| 问题 | 文档 |
|------|------|
| 音频录制 | [android-audio-recording-fix.md](./troubleshooting/android-audio-recording-fix.md) |
| 权限问题 | [permission-auto-redirect-fix.md](./troubleshooting/permission-auto-redirect-fix.md) |
| 其他问题 | [guides/troubleshooting.md](./guides/troubleshooting.md) |

---

## 相关项目

- **主项目文档**: `../N.E.K.O/docs/`
- **主项目前端**: `../N.E.K.O/docs/frontend/`
