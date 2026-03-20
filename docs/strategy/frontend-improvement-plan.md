# 前端设计改进计划

**创建日期**: 2026-03-06
**状态**: 待排期
**背景**: 基于代码审查和 UI 设计分析，整理需要系统性改进的前端问题

---

## 现状评估

### 整体架构（良好）

- Live2D 舞台 + 浮动工具栏 + 聊天面板的分层架构清晰，z-index 有序
- 跨平台方案成熟：`.native.tsx` / `.tsx` 自动分流，类型和业务逻辑通过 `hooks.ts` 共享
- 青蓝 `#40C5F1` + 深蓝黑背景的整体风格一致

### 主要问题

1. 没有设计系统（颜色/字号全部硬编码，分散在各文件）
2. 基础 UI 组件未抽象（Button、Input 各处重复定义）
3. 动画缺失（Modal 无入场动画，状态切换无过渡）
4. 角色切换加载体验差（全屏遮罩卡住界面）
5. `main.tsx` 过大（1700+ 行，UI 和逻辑混杂）
6. 聊天气泡设计基础，缺少视觉层次

---

## 改进事项

### P0 — 基础设施（必须先做，其他改进依赖它）

#### 1. 建立设计 Token 文件

**文件**: `constants/theme.ts`

```typescript
export const colors = {
  // 主色
  primary: '#40C5F1',
  primaryDark: '#44b7fe',
  // 背景
  background: '#1a1a2e',
  surface: '#16213e',
  surfaceElevated: '#1e2d4a',
  // 文字
  textPrimary: '#ffffff',
  textSecondary: '#aaaaaa',
  textDisabled: '#555555',
  // 状态
  error: '#ff4444',
  success: '#52c41a',
  warning: '#faad14',
  // 边框
  border: '#333333',
  borderLight: '#444444',
};

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 14,
  base: 16,
  lg: 18,
  xl: 20,
  xxl: 24,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
};

export const radius = {
  sm: 6,
  md: 8,
  lg: 12,
  xl: 16,
  round: 999,
};
```

**影响范围**: 全部样式文件
**预计工时**: 半天（建文件）+ 逐步替换各文件硬编码（可分批做）

---

#### 2. 抽取公共基础组件

**目录**: `components/ui/`

需要抽取的组件：

| 组件 | 说明 | 当前重复位置 |
|------|------|-------------|
| `Button.tsx` | 主按钮、次按钮、危险按钮三种变体 | character-manager、ChatContainer、工具栏 |
| `Input.tsx` | 文本输入框，含错误状态 | character-manager、设置页 |
| `Modal.tsx` | 通用 Modal 容器（遮罩+面板+关闭按钮） | main.tsx、character-manager |
| `LoadingOverlay.tsx` | 加载遮罩 | main.tsx 角色切换加载 |
| `StatusBadge.tsx` | 连接状态指示器（绿/黄/红点） | ChatContainer header |

**预计工时**: 1~2 天

---

### P1 — 交互体验（用户感知最明显）

#### 3. 角色切换加载体验重设计

**当前问题**: 切换角色时弹出全屏半透明遮罩，整个界面冻结，用户不知道在等什么，体验像"卡住了"。

**改进方案**: 改为顶部进度横幅，Live2D 保持可见

```
┌─────────────────────────────────────┐
│  ⟳  正在切换到「sakura」...          │  ← 顶部横幅，不遮挡主界面
└─────────────────────────────────────┘
│                                     │
│         Live2D 仍然可见              │
│                                     │
```

- 切换成功：横幅变绿，显示「✓ 已切换到 sakura」，1.5 秒后自动消失
- 切换失败：横幅变红，显示错误信息，提供「重试」按钮
- 超时：横幅提示「切换超时，请检查网络」

**涉及文件**: `app/(tabs)/main.tsx`（角色切换 Modal 相关逻辑）、新建 `components/CharacterSwitchBanner.tsx`
**预计工时**: 1 天

---

#### 4. Modal 入场 / 退场动画

**当前问题**: 所有 Modal（角色选择、工具栏面板、聊天窗口）硬出现/消失，没有过渡。

**改进方案**: 使用 RN 内置 `Animated` API，统一动画规范：

| Modal 类型 | 入场动画 | 退场动画 |
|-----------|---------|---------|
| 底部弹出面板（聊天、工具栏设置） | 从下方滑入（translateY: 300→0） + 淡入 | 滑出 + 淡出 |
| 中央弹出 Modal（角色选择） | 缩放 + 淡入（scale: 0.9→1, opacity: 0→1） | 缩放 + 淡出 |
| 顶部横幅（切换状态） | 从上方滑入（translateY: -50→0） | 滑出 |

动画时长统一：入场 200ms，退场 150ms，使用 `easeOut` 曲线。

**涉及文件**: `ChatContainer.native.tsx`、`Live2DRightToolbar.native.tsx`、`main.tsx`
**预计工时**: 1 天

---

#### 5. 按钮点击反馈增强

**当前问题**: 部分按钮使用 `TouchableOpacity` 但 `activeOpacity` 值不统一，有些按钮点击无明显反馈。

**改进方案**:
- 统一 `activeOpacity: 0.7`
- 主要操作按钮（发送、保存）加轻微缩放动画（scale: 1→0.97→1）
- 麦克风按钮录音中状态加脉冲动画（表示"正在录音"）

**预计工时**: 半天

---

### P2 — 视觉细化

#### 6. 聊天气泡重设计

**当前问题**: 用户消息和 AI 消息使用同一种气泡样式，只靠位置区分（左/右），视觉层次不足。

**改进方案**:

```
用户消息（右对齐）:          AI 消息（左对齐）:
┌──────────────┐            ┌──────────────────┐
│ 你好，sakura │            │ 你好！我在呢 (◕ω◕) │
└──────────────┘            └──────────────────┘
  背景: #40C5F1（主色）        背景: #16213e（深色卡片）
  文字: 白色                   文字: 白色
  圆角: 右下角小               圆角: 左下角小
```

- 添加消息时间戳（仅在消息间隔 > 5 分钟时显示，避免密集）
- 系统消息居中显示，灰色小字
- 图片消息支持点击放大

**涉及文件**: `ChatContainer.native.tsx`
**预计工时**: 1 天

---

#### 7. 工具栏按钮状态视觉优化

**当前问题**: 麦克风按钮激活/未激活的视觉差异不够明显，用户有时不确定是否在录音。

**改进方案**:
- 未录音：灰色图标，普通背景
- 录音中：红色图标 + 脉冲光晕动画 + 轻微阴影
- 语音准备中（AI 说话）：青蓝图标 + 静态高亮

**涉及文件**: `Live2DRightToolbar.native.tsx`
**预计工时**: 半天

---

### P3 — 架构整理（长期维护性）

#### 8. 拆分 main.tsx

**当前问题**: `main.tsx` 1700+ 行，包含：连接配置、角色同步、消息处理、UI 渲染、5 个 Modal 的 JSX。

**拆分目标**:

```
app/(tabs)/main.tsx（保留，~400行，只做组装）
  ├── components/modals/CharacterSelectModal.tsx
  ├── components/modals/CharacterSwitchLoadingBanner.tsx
  ├── components/modals/VoiceBlockModal.tsx
  └── hooks/（已有，继续细化）
```

**预计工时**: 2 天（需要仔细处理 props 传递和状态提升）

---

#### 9. 统一 StyleSheet 管理

**当前问题**: `character-manager.tsx` 末尾有 280 行 StyleSheet，与业务逻辑混在同一文件。

**改进方案**: 样式单独存放到 `styles/` 文件，或与组件同名的 `.styles.ts` 文件。

```
character-manager.tsx        → 只含逻辑
character-manager.styles.ts  → StyleSheet
```

**预计工时**: 半天（逐文件迁移）

---

## 排期建议

### 第一阶段（1 周）— 基础设施 + 最高价值体验改进
1. `theme.ts` 设计 Token（P0-1）
2. 角色切换加载重设计（P1-3）
3. Modal 入场动画（P1-4）

### 第二阶段（1 周）— 组件化
4. 公共基础组件抽取（P0-2）
5. 聊天气泡重设计（P2-6）
6. 按钮点击反馈（P1-5）

### 第三阶段（1 周）— 架构整理
7. 工具栏状态视觉（P2-7）
8. 拆分 main.tsx（P3-8）
9. 样式文件分离（P3-9）

---

## 注意事项

- 样式替换（hardcode → theme.ts）可以**边做其他功能边顺手替换**，不用单独排一个任务
- Modal 动画改动需要在 Android 和 iOS 真机上测试，两端的动画性能差异较大
- `main.tsx` 拆分风险较高，建议作为单独 PR，每次只拆一个 Modal
