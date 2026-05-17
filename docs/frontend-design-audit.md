# N.E.K.O.-RN 前端设计审计报告

**日期:** 2026-05-12
**评估标准:** frontend-design skill quality gate

---

## 总览

| 维度 | 评分 | 状态 |
|------|------|------|
| 视觉方向 | 5/10 | 有方向感但未明确命名和执行 |
| 设计系统 | 2/10 | 最大短板：token 几乎不存在 |
| 排版 | 4/10 | ThemedText 有但未推广使用 |
| 色彩 | 5/10 | 深色方案一致，但 token 分散 |
| 布局 | 5/10 | 功能正确，缺乏设计野心 |
| 动效 | 3/10 | 只有最基本的 fade-in |
| 工程质量 | 5/10 | 组件拆分好，但文件过大、样式重复 |
| **综合** | **4/10** | 功能齐全但设计系统缺失 |

---

## 问题清单

### P0 — 设计 Token 系统缺失

**现状：** `constants/theme.ts` 只有 6 个颜色 token，没有间距、字号、圆角、阴影系统。

**影响范围：** 全局。任何视觉调整需要改 10+ 个文件。

**具体表现：**
- 4 套独立的 LIGHT/DARK 调色板散落在 `theme.ts`、`index.tsx`、`settings.tsx`、`character-manager.tsx`
- 间距全部硬编码：`paddingHorizontal: 18`、`gap: 10`、`marginTop: 6`
- 字号随机：12/13/15/16/17/18，无层级
- 圆角无规律：22/16/18/20/10/8/6

**修复方案：** 在 `constants/theme.ts` 中扩展完整的 design token 系统。

### P1 — 强调色不统一

**现状：** 同一颜色三种写法：
- `#40c5f1` — dragIndicator, characterModalHeader
- `#44b7fe` — message bubble, send button, floating button, avatar tools
- `#00d9ff` — character-manager accent

**修复方案：** 统一为一个 `accent` token。

### P1 — main.tsx 文件过大

**现状：** 1950 行，违反 800 行上限。渲染、样式、业务逻辑混在一起。

**影响：** 维护困难，样式无法复用。

**修复方案：** 拆分样式到独立文件，提取子组件。

### P2 — ThemedText/ThemedView 未推广

**现状：** 组件已定义，但 `main.tsx` 等核心页面全程直接用 `<Text style={{...}}>`。

**修复方案：** 在核心页面中替换为 ThemedText/ThemedView。

### P2 — 动效不足

**现状：** 只有 MessageBubble 的 FadeIn 和 VoicePrepareOverlay 的脉冲动画。

**缺失：**
- 工具栏面板展开/收起无动画
- Live2D 角色切换无过渡
- 按钮无 press 反馈
- 页面转场无动画

**修复方案：** 逐步补充关键交互的动效。

### P3 — 亮色模式支持不完整

**现状：** 角色管理、设置页面硬编码深色方案，不跟随系统主题。

**修复方案：** 接入 theme token 后统一支持。

### P3 — 工具栏图标路径脆弱

**现状：** `require('../../../../assets/icons/...')` 深层相对路径。

**修复方案：** 使用 alias 或集中导出。

---

## 修复计划

### 第一阶段：设计基础设施（P0）

1. 扩展 `constants/theme.ts`，建立完整的 design token 系统
   - spacing scale (4, 8, 12, 16, 20, 24, 32, 40, 48)
   - fontSize scale (11, 12, 13, 15, 17, 20, 24, 28, 34)
   - borderRadius scale (4, 6, 8, 10, 12, 16, 20, 24, 999)
   - color tokens (accent, success, warning, error, surface, text hierarchy, border)
   - shadow presets (sm, md, lg)
2. 统一强调色为单一 accent token

### 第二阶段：样式迁移（P1-P2）

3. 拆分 `main.tsx` — 提取 styles 到独立文件和子组件
4. 用 design token 替换所有硬编码样式值
5. 在核心页面推广 ThemedText/ThemedView

### 第三阶段：体验提升（P2-P3）

6. 补充工具栏面板动画
7. 补充 Live2D 角色切换过渡
8. 完善亮色模式支持

---

## 设计方向建议

**定位：** Cyber-Companion（赛博陪伴）

**关键词：** 温暖科技、半透明层次、柔光、亲密感

**设计原则：**
- 深色为主，亮色为辅助模式
- 半透明 frosted glass 作为核心视觉语言（聊天面板、工具栏已有雏形）
- 青蓝色 `#44b7fe` 作为品牌强调色
- 圆角 + 柔和阴影传达温暖感
- 动效服务于"角色在陪伴你"的叙事，而非装饰
