# N.E.K.O.-RN Design System

**设计语言：Cyber-Companion（赛博陪伴）**
**版本：** 1.0
**日期：** 2026-05-13

---

## 1. 设计语言

### 定位

N.E.K.O. 是一个 AI 角色陪伴应用。Live2D 角色是视觉焦点，UI 的存在意义是为角色服务而不是与角色竞争注意力。

### 设计原则

| 原则 | 含义 | 实践方式 |
|------|------|----------|
| 深色为主 | 海军蓝底色让 Live2D 角色和内容"浮"在前面 | `colors.page = #1A1A2E` |
| 单一强调色 | 只用一种青蓝色，统一所有可交互元素 | `colors.accent = #44B7FE` |
| 玻璃有意图 | 毛玻璃面板用于聊天和工具栏，不滥用 | `GlassPanel` 组件 |
| 柔和深度 | 用阴影代替硬边框，元素"浮起"而非"框住" | `shadowCard` / `shadowFloating` |
| 动效有目的 | 过渡动画服务于"角色在陪伴你"的叙事 | `duration.*` tokens |

### 视觉关键词

温暖科技 · 半透明层次 · 柔光 · 圆润 · 亲密感

---

## 2. 设计 Token

所有 token 定义在 `constants/tokens/` 下，通过 `useTheme()` 访问。

### 2.1 颜色

```typescript
// 从 useTheme() 获取
const { colors } = useTheme();
```

| Token | 深色值 | 浅色值 | 用途 |
|-------|--------|--------|------|
| `accent` | `#44B7FE` | `#44B7FE` | 主强调色（按钮、高亮、链接） |
| `accentMuted` | `#0D6E92` | `#0D6E92` | 深色强调变体（章节标题） |
| `accentSoft` | `rgba(68,183,254,0.10)` | `rgba(68,183,254,0.10)` | 浅色强调背景 |
| `success` | `#52C41A` | `#52C41A` | 成功/连接中 |
| `warning` | `#FAAD14` | `#FAAD14` | 警告/重连中 |
| `error` | `#FF4D4F` | `#FF4D4F` | 错误/断开/删除 |
| `page` | `#1A1A2E` | `#E3F4FF` | 最底层背景 |
| `elevated` | `#16213E` | `#F0F8FF` | 卡片/面板/输入框背景 |
| `surfaceGlass` | `rgba(25,25,35,0.97)` | `rgba(245,245,250,0.92)` | 毛玻璃面板 |
| `textPrimary` | `#FFFFFF` | `#1A1A2E` | 标题/正文 |
| `textSecondary` | `#AAAAAA` | `#555555` | 标签/辅助文字 |
| `textMuted` | `#666666` | `#888888` | 占位符/禁用文字 |
| `textOnAccent` | `#1A1A2E` | `#1A1A2E` | 强调色上的文字 |
| `border` | `rgba(255,255,255,0.10)` | `#B3E5FC` | 默认边框 |
| `borderStrong` | `rgba(255,255,255,0.20)` | `rgba(68,183,254,0.20)` | 强调边框 |
| `separator` | `rgba(255,255,255,0.08)` | `rgba(0,0,0,0.06)` | 分隔线/浅色背景 |
| `overlay` | `rgba(0,0,0,0.6)` | `rgba(0,0,0,0.5)` | 模态遮罩 |

### 2.2 排版

| Variant | fontSize | lineHeight | fontWeight | 用途 |
|---------|----------|------------|------------|------|
| `caption` | 11 | 15 | regular | 徽章、极小标签 |
| `footnote` | 13 | 18 | regular | 状态行、时间戳、辅助信息 |
| `body` | 15 | 22 | regular | 正文默认 |
| `callout` | 16 | 24 | regular | 稍强调文本、按钮标签 |
| `headline` | 18 | 24 | bold | 模态标题、区块标题 |
| `title` | 22 | 28 | bold | 大标题 |
| `largeTitle` | 32 | 38 | bold | 页面主标题 |

```typescript
// ThemedText 用法
<ThemedText variant="body">正文内容</ThemedText>
<ThemedText variant="headline">标题</ThemedText>

// 或直接用 token
<Text style={{ fontSize: theme.fontSize.body, color: theme.colors.textPrimary }}>...</Text>
```

### 2.3 间距（4px 网格）

| Token | 值 | 用途 |
|-------|---|------|
| `xs` | 4 | 紧凑内边距、图标微调 |
| `sm` | 8 | 项目间隙、小内边距 |
| `md` | 12 | 标准项目间隙 |
| `lg` | 16 | 卡片/区块内边距 |
| `xl` | 20 | 面板内边距 |
| `xxl` | 24 | 区块边距 |
| `xxxl` | 32 | 大区块间距 |
| `xxxxl` | 40 | 标题下方间距 |

### 2.4 圆角

| Token | 值 | 用途 |
|-------|---|------|
| `xs` | 4 | 小标签、状态点 |
| `sm` | 8 | 输入框、按钮、小卡片 |
| `md` | 12 | 标准卡片、面板 |
| `lg` | 16 | 模态、操作按钮、气泡 |
| `xl` | 22 | 聊天面板顶部 |
| `xxl` | 24 | 浮动按钮（48x48 圆形） |
| `full` | 9999 | 药丸形状 |

### 2.5 阴影

```typescript
// 用法
<View style={theme.shadowCard}>...</View>
<View style={theme.shadowFloating}>...</View>
```

| 预设 | 用途 | 特点 |
|------|------|------|
| `shadowCard` | 卡片/面板浮起 | elevation 3 |
| `shadowFloating` | 浮动按钮 | 带 accent 色辉光，elevation 8 |
| `shadowModal` | 模态面板 | elevation 10 |
| `shadowBubble` | 聊天气泡 | 轻微浮起，elevation 1 |

### 2.6 动画时长

| Token | 值 | 用途 |
|-------|---|------|
| `instant` | 150ms | 淡入、微交互 |
| `fast` | 200ms | 按钮反馈、切换 |
| `normal` | 300ms | 面板展开/收起 |
| `slow` | 500ms | 页面转场 |

---

## 3. 组件

### 3.1 ThemedText

```typescript
import { ThemedText } from '@/components/themed-text';

// 7 种变体
<ThemedText variant="caption">小标签</ThemedText>
<ThemedText variant="footnote">辅助信息</ThemedText>
<ThemedText variant="body">正文（默认）</ThemedText>
<ThemedText variant="callout">稍强调</ThemedText>
<ThemedText variant="headline">标题</ThemedText>
<ThemedText variant="title">大标题</ThemedText>
<ThemedText variant="largeTitle">页面标题</ThemedText>

// 兼容旧 API
<ThemedText type="default">...</ThemedText>
<ThemedText lightColor="#333" darkColor="#fff">...</ThemedText>
```

### 3.2 ThemedView

```typescript
import { ThemedView } from '@/components/themed-view';

// 默认背景色为 theme.colors.page
<ThemedView>...</ThemedView>
```

### 3.3 GlassPanel

```typescript
import GlassPanel from '@/components/GlassPanel';

// 封装 expo-blur，自动回退到半透明 View
<GlassPanel intensity={40} tint="light" style={{ borderRadius: 22 }}>
  ...
</GlassPanel>
```

---

## 4. 使用模式

### 4.1 页面标准写法

```typescript
import { useTheme } from '@/constants/ThemeContext';

export default function MyScreen() {
  const theme = useTheme();
  const cc = theme.colors; // 常用简写

  return (
    <SafeAreaView style={[s.container, { backgroundColor: cc.page }]}>
      <Text style={[s.title, { color: cc.textPrimary }]}>标题</Text>
      <View style={[s.card, { backgroundColor: cc.elevated, borderColor: cc.border }]}>
        <TouchableOpacity style={[s.btn, { backgroundColor: cc.accent }]}>
          <Text style={[s.btnText, { color: cc.textOnAccent }]}>按钮</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// StyleSheet 只保留结构属性，颜色通过 inline style 传入
const s = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 22, fontWeight: 'bold' },
  card: { borderRadius: 12, padding: 16, borderWidth: 1 },
  btn: { borderRadius: 8, padding: 16, alignItems: 'center' },
  btnText: { fontSize: 16, fontWeight: 'bold' },
});
```

### 4.2 状态颜色

```typescript
const statusColor = isConnected ? cc.success : cc.error;
const statusColor = isConnecting ? cc.warning : cc.success;
```

### 4.3 不做什么

- 不要在 `StyleSheet.create` 中放颜色值 — 颜色必须通过 inline style 使用 theme token
- 不要硬编码 `#44b7fe` / `#40c5f1` / `#00d9ff` — 统一用 `cc.accent`
- 不要自定义 LIGHT/DARK 对象 — 用 `useTheme()`
- 不要把文件写到超过 800 行 — 拆组件或拆样式文件

---

## 5. 文件结构

```
constants/
  tokens/
    colors.ts        # 颜色定义
    spacing.ts       # 间距系统
    typography.ts    # 排版系统
    borderRadius.ts  # 圆角系统
    shadows.ts       # 阴影预设
    durations.ts     # 动画时长
    index.ts         # 统一导出
  theme.ts           # Theme 类型 + 浅色/深色主题
  ThemeContext.tsx   # ThemeProvider + useTheme()
  presets.ts         # 共享样式预设函数

components/
  themed-text.tsx    # 排版组件（7 种变体）
  themed-view.tsx    # 主题背景容器
  GlassPanel.tsx     # 毛玻璃面板
```
