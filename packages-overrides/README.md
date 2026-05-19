# packages-overrides

## 状态: 已冻结

> **2026-05-11**: 上游 N.E.K.O 的 `frontend/packages/` 目录已不存在（前端重构为 `react-neko-chat` + `plugin-manager`）。
> 同步脚本 `sync-neko-packages.js` 已废弃并移至 `scripts/deprecated/`。
> 本目录下的 overlay 文件和 `packages/project-neko-*` 现作为 RN 专有代码独立维护，不再与上游同步。

## 目的

本目录存放 **N.E.K.O.-RN 特有的文件**，这些文件会叠加（overlay）到对应的 `packages/project-neko-*` 目录中。

由于上游包已不存在，这些 overlay 文件现在是 RN packages 的一部分，需要在此目录中手动维护。

## 目录结构

```
packages-overrides/
├── README.md (本文件)
├── project-neko-components/
│   └── src/
│       └── assets/
│           └── toast_background.png (RN 特有的 toast 背景图)
└── (其他包的 overlay,按需添加)
```

## 当前 Overlay 清单

### project-neko-common

- `package.json` — vite 依赖版本声明

### project-neko-components

- `src/assets/toast_background.png` — RN 特有的 toast 背景图片
- `package.json` — vite 依赖版本声明

### project-neko-audio-service

- `package.json` — vite 依赖版本声明

### project-neko-live2d-service

- `package.json` — vite 依赖版本声明

### project-neko-realtime

- `package.json` — vite 依赖版本声明
