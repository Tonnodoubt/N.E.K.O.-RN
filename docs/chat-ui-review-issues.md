# Chat UI Migration - Code Review Issues

## Phase: 6-Phase Chat UI Migration (2026-05-12)

### Overview

将主项目 `react-neko-chat` 的聊天 UI 移植到 RN 项目。涉及 10 个文件（7 修改 + 3 新建）。

### Review Stats

| Severity | Found | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 2 | 2 | 0 |
| HIGH | 10 | 8 | 2 |
| MEDIUM | 8 | 0 | 8 |
| LOW | 8 | 0 | 8 |

---

## CRITICAL — 已修复

- [x] **C1.** SmartTextBlock 流式动画每次 token 都重放（FadeInUp + 不稳定 key）
  - Fix: 简化为单 Markdown + streaming cursor
  - File: `SmartTextBlock.native.tsx`

- [x] **C2.** `isStreaming` 是死代码 — 类型中无此字段，convertExternalMessage 也不设置
  - Fix: ExternalChatMessage 加 isStreaming，convertExternalMessage 传递
  - Files: `types.ts`, `ChatContainer.native.tsx`

---

## HIGH — 已修复

- [x] **H1.** Debug console.log 残留 ChatContainer（每条消息 log image 长度）
- [x] **H2.** Debug console.log 残留 useChatMessages（log base64 长度）
- [x] **H3.** 键盘处理被删除 — iOS 键盘弹起不滚到底
- [x] **H4.** 所有样式内联 → StyleSheet.create()
- [x] **H5.** styles.native.ts 死代码文件 → 删除
- [x] **H6.** Avatar emoji → Ionicons（避免 iOS 渲染方块）
- [x] **H7.** Web convertExternalMessage 不处理 image → 同步逻辑
- [x] **H8.** Linking.openURL 无验证 → 限制 http/https

---

## HIGH — 待修复

- [ ] **H9.** 发送图片无大小限制（12MB base64 可能超 WS 帧限制）
  - Fix: expo-image-manipulator 压缩到 1280px / quality 0.5
  - File: `app/(tabs)/main.tsx`

- [ ] **H10.** 两个同名 ChatMessage 类型（hooks 层 vs 组件层）
  - Fix: 重命名为 HookChatMessage vs ChatMessage
  - Files: `hooks/useChatMessages.ts`, `types.ts`

---

## MEDIUM — 待改进

- [ ] **M1.** ButtonBlock onPress 空函数（等 action protocol 定义）
- [ ] **M2.** GlassPanel 名不副实（无 blur，等 rebuild app）
- [ ] **M3.** ensureDataURI 重复定义（提取到 utils.ts）
- [ ] **M4.** onMessageUpdated 在 setMessages updater 内调用
- [ ] **M5.** FlatList 流式更新过度 auto-scroll（需 debounce）
- [ ] **M6.** expo-haptics magic number（应 import enum）
- [ ] **M7.** paddingBottom: 20 硬编码（应用 useSafeAreaInsets）
- [ ] **M8.** Modal TouchableWithoutFeedback 嵌套穿透风险

---

## LOW — 可选优化

- [ ] **L1.** getMessageText 纯图片消息返回空字符串
- [ ] **L2.** getMessageImage 只返回第一张图
- [ ] **L3.** ChatMessage union 允许 content+image 都 undefined
- [ ] **L4.** renderBlock switch 缺 exhaustiveness guard
- [ ] **L5.** Image 组件缺 accessibilityLabel
- [ ] **L6.** Link/Button 缺 accessibilityRole
- [ ] **L7.** MessageList 空状态无 ListEmptyComponent
- [ ] **L8.** index.ts 缺文件末尾换行
