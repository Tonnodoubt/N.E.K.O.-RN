# 全局 UI 主题适配（亮色 / 暗色）

**文档版本**: v1.0
**更新日期**: 2026-03-08
**适用范围**: React Native 移动端

---

## 1. 功能概述

在已完成「设置面板暗色模式切换按钮」（见 `dark-mode-toggle-in-settings.md`）的基础上，
对以下三个区域的 UI 样式进行全局主题适配，使白天/暗色模式下视觉风格分明：

| 区域 | 文件 | 主要改动 |
|------|------|----------|
| **首页（Home）** | `app/(tabs)/index.tsx` | 新增 `LIGHT`/`DARK` 色板，所有颜色走 `t.xxx` |
| **工具栏浮动按钮 + 设置/Agent 面板** | `packages/project-neko-components/src/Live2DRightToolbar/styles.native.ts` | 静态 `styles` 重构为 `createToolbarStyles(isDark)` 工厂函数 |
| **工具栏组件** | `packages/project-neko-components/src/Live2DRightToolbar/Live2DRightToolbar.native.tsx` | 调用工厂函数，传入当前色彩方案 |
| **API 设置页** | `app/settings.tsx` | 新增 `LIGHT`/`DARK` 色板，完整支持白天模式 |

色彩参照主项目 `theme.css` / `dark-mode.css` 及 `Live2DRightToolbar.css`。

---

## 2. 首页（index.tsx）

### 2.1 色板定义

在组件定义之前声明两个常量对象，代替原先分散的硬编码颜色：

```typescript
// 亮色/暗色主题色板（参照主项目 theme.css 与 dark-mode.css）
const LIGHT = {
  container:       '#e3f4ff',    // --neko-light-bg
  card:            '#f0f8ff',    // --neko-card-bg
  cardBorder:      '#b3e5fc',    // --neko-border
  actionBtn:       '#f0f8ff',
  actionBorder:    '#b3e5fc',
  configBtn:       '#f0f8ff',
  configBtnBorder: '#b3e5fc',
  textPrimary:     '#1a1a2e',
  textSub:         '#555',
  textMuted:       '#888',
  textOffline:     '#999',
  titleColor:      '#40c5f1',    // 主品牌色，亮色下保持不变
  sectionTitle:    '#40c5f1',
  configBtnText:   '#40c5f1',
};

const DARK = {
  container:       '#000',
  card:            'rgba(30, 30, 30, 0.6)',
  cardBorder:      'rgba(255, 255, 255, 0.1)',
  actionBtn:       'rgba(64, 197, 241, 0.1)',
  actionBorder:    'rgba(64, 197, 241, 0.3)',
  configBtn:       'rgba(64, 197, 241, 0.08)',
  configBtnBorder: 'rgba(64, 197, 241, 0.2)',
  textPrimary:     '#fff',
  textSub:         '#888',
  textMuted:       '#666',
  textOffline:     '#555',
  titleColor:      '#40c5f1',
  sectionTitle:    '#40c5f1',
  configBtnText:   '#40c5f1',
};
```

### 2.2 组件内主题切换

```typescript
const colorScheme = useColorScheme();  // 来自 @/hooks/use-color-scheme
const isDark = colorScheme === 'dark';
const t = isDark ? DARK : LIGHT;
```

### 2.3 JSX 变更

所有颜色由静态 `StyleSheet` 移至行内 `style` 数组：

| 元素 | 原写法 | 新写法 |
|------|--------|--------|
| 容器背景 | `styles.container`（无色） | `[styles.container, { backgroundColor: t.container }]` |
| 标题文字 | `styles.title`（含 `color: '#40c5f1'`） | `[styles.title, { color: t.titleColor }]` |
| 区段标题 | `{ color: '#40c5f1' }`（行内） | `{ color: t.sectionTitle }` |
| 卡片背景/边框 | 行内硬编码 | `{ backgroundColor: t.card, borderColor: t.cardBorder }` |
| 按钮文字（手动/扫码配置） | `styles.configButtonText`（含 `color`） | `[styles.configButtonText, { color: t.configBtnText }]` |

`StyleSheet.create` 中仅保留布局/尺寸/字号等结构属性，不包含颜色。

---

## 3. 工具栏样式（styles.native.ts）

### 3.1 改动原因

原文件使用 `export const styles = StyleSheet.create({...})`，颜色全部硬编码，无法区分亮/暗模式。
参照主项目 `Live2DRightToolbar.css` 与 `theme.css` 中的配色规则，重构为工厂函数。

### 3.2 重构方案

将静态导出改为参数化工厂函数：

```typescript
// 修改前
export const styles = StyleSheet.create({ ... });

// 修改后
export function createToolbarStyles(isDark: boolean) {
  // 按主项目规范计算动态色值
  const btnBg       = isDark ? 'rgba(35, 35, 35, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  const btnBorder   = isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)';
  const panelBg     = isDark ? 'rgba(25, 25, 35, 0.97)' : 'rgba(255, 255, 255, 0.98)';
  const panelBorder = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(179, 229, 252, 0.8)';
  const titleColor  = isDark ? '#f0f0f0' : '#1a1a2e';
  const labelColor  = isDark ? '#e0e0e0' : '#333';
  // ... 其余色值

  return StyleSheet.create({ /* 与原结构完全一致，颜色改为变量 */ });
}
```

### 3.3 色值对照表（参照主项目）

| 元素 | 亮色 | 暗色 | 主项目原值 |
|------|------|------|-----------|
| 按钮背景 | `rgba(255,255,255,0.9)` | `rgba(35,35,35,0.85)` | Web: `rgba(255,255,255,0.65)` |
| 按钮边框 | `rgba(0,0,0,0.06)` | `rgba(255,255,255,0.12)` | Web: `rgba(255,255,255,0.18)` |
| 面板背景 | `rgba(255,255,255,0.98)` | `rgba(25,25,35,0.97)` | Web: `rgba(255,255,255,0.65)` / `rgba(30,30,30,0.82)` |
| 面板边框 | `rgba(179,229,252,0.8)` | `rgba(255,255,255,0.1)` | Web: `rgba(255,255,255,0.18)` |
| 面板标题 | `#1a1a2e` | `#f0f0f0` | Web: `#333` / `#f0f0f0` |
| Toggle 标签 | `#333` | `#e0e0e0` | Web: `#333` / `#f0f0f0` |
| 行背景 | `rgba(0,0,0,0.03)` | `rgba(255,255,255,0.05)` | Web: `rgba(68,183,254,0.08)` on hover |
| 分隔线 | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.1)` | Web: `rgba(0,0,0,0.1)` |
| 遮罩层 | `rgba(0,0,0,0.4)` | `rgba(0,0,0,0.6)` | — |

> **注意**：RN 无 `backdrop-filter`，面板背景透明度设高于 Web 端以保证可读性。

---

## 4. 工具栏组件（Live2DRightToolbar.native.tsx）

### 4.1 导入变更

```typescript
// 修改前
import { styles } from './styles.native';

// 修改后
import { createToolbarStyles } from './styles.native';
```

同时在 react-native 导入中追加 `useColorScheme`：

```typescript
import {
  View, TouchableOpacity, Image, Modal, ScrollView,
  Switch, Text, TouchableWithoutFeedback,
  useColorScheme,   // ← 新增
} from 'react-native';
```

### 4.2 组件内调用

在组件函数体顶部（紧接 `useT()` 之后）：

```typescript
const colorScheme = useColorScheme();
const styles = createToolbarStyles(colorScheme === 'dark');
```

其余 JSX 代码无需修改，`styles` 变量命名不变，自动使用主题色。

---

## 5. API 设置页（settings.tsx）

### 5.1 色板定义

```typescript
import { useColorScheme } from '@/hooks/use-color-scheme';

const LIGHT = {
  container:          '#e3f4ff',
  header:             '#f0f8ff',
  headerBorder:       '#b3e5fc',
  card:               '#f0f8ff',
  input:              '#fff',
  inputBorder:        '#b3e5fc',
  textPrimary:        '#1a1a2e',
  textLabel:          '#555',
  sectionTitle:       '#0d6e92',
  accent:             '#40c5f1',
  accentText:         '#1a1a2e',
  pickerOptionBg:     '#f0f8ff',
  pickerOptionBorder: '#b3e5fc',
  infoSeparator:      '#b3e5fc',
  infoLabel:          '#555',
  infoValue:          '#1a1a2e',
  inputText:          '#1a1a2e',
  placeholder:        '#999',
  loadingText:        '#1a1a2e',
};

const DARK = {
  container:          '#1a1a2e',    // 保留原始暗色
  header:             '#1a1a2e',
  headerBorder:       '#333',
  card:               '#16213e',
  input:              '#1a1a2e',
  inputBorder:        '#333',
  textPrimary:        '#fff',
  textLabel:          '#aaa',
  sectionTitle:       '#fff',
  accent:             '#00d9ff',
  accentText:         '#1a1a2e',
  pickerOptionBg:     '#1a1a2e',
  pickerOptionBorder: '#333',
  infoSeparator:      '#333',
  infoLabel:          '#888',
  infoValue:          '#fff',
  inputText:          '#fff',
  placeholder:        '#666',
  loadingText:        '#fff',
};
```

### 5.2 组件内主题切换

```typescript
const colorScheme = useColorScheme();
const isDark = colorScheme === 'dark';
const t = isDark ? DARK : LIGHT;
```

### 5.3 StyleSheet 原则

`StyleSheet.create` 中**仅保留结构/布局**属性（`flex`、`padding`、`borderRadius`、`fontSize` 等）。
所有颜色通过行内 `style` 注入，例如：

```tsx
<SafeAreaView style={[styles.container, { backgroundColor: t.container }]}>
<View style={[styles.header, { backgroundColor: t.header, borderBottomColor: t.headerBorder }]}>
<View style={[styles.card, { backgroundColor: t.card }]}>
<TextInput style={[styles.input, { backgroundColor: t.input, borderColor: t.inputBorder, color: t.inputText }]} />
```

---

## 6. 修改文件汇总

| 文件 | 修改内容 |
|------|----------|
| `app/(tabs)/index.tsx` | 新增 `LIGHT`/`DARK` 色板；所有颜色走 `t.xxx`；`configButtonText` 颜色移至行内 |
| `packages/project-neko-components/src/Live2DRightToolbar/styles.native.ts` | 静态 `styles` → `createToolbarStyles(isDark)` 工厂函数；按钮/面板完整亮暗色支持 |
| `packages/project-neko-components/src/Live2DRightToolbar/Live2DRightToolbar.native.tsx` | 追加 `useColorScheme` 导入；组件内调用 `createToolbarStyles` |
| `app/settings.tsx` | 新增 `LIGHT`/`DARK` 色板；追加 `useColorScheme` 导入；全页面亮色模式支持 |

---

## 7. 注意事项

### 7.1 StyleSheet.create 在工厂函数中的性能

`createToolbarStyles(isDark)` 在每次渲染时被调用，会重复执行 `StyleSheet.create`。
由于工具栏颜色仅在切换主题时改变，性能影响可忽略不计（`StyleSheet.create` 本身有内部缓存机制）。
若未来有性能需求，可改用 `useMemo`：

```typescript
const styles = useMemo(() => createToolbarStyles(isDark), [isDark]);
```

### 7.2 主题切换时机

`Appearance.setColorScheme('dark' | 'light')` 触发后，`useColorScheme()` 立即返回新值，
所有使用该 hook 的组件自动重渲染，无需额外状态管理。

### 7.3 与「设置面板切换按钮」的关系

本文档的 UI 适配是视觉层改动，「设置面板切换按钮」（见 `dark-mode-toggle-in-settings.md`）
是控制层改动。两者配合工作：
- 切换按钮调用 `Appearance.setColorScheme()` 改变全局色彩方案
- 本文档的色板响应 `useColorScheme()` 的返回值，自动切换对应颜色

---

## 8. 更新记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.0 | 2026-03-08 | 初始版本：首页、工具栏样式、工具栏组件、设置页的亮暗色适配 |
