# 分支合并策略

> 评估时间：2026-02-19
> 涉及分支：N.E.K.O 仓库的 `react_rewrite_web` 和 `main`

---

## 1. 当前分支分歧状况

### 1.1 数字概览

| 指标 | 数值 |
|------|------|
| `react_rewrite_web` 领先 `main` 的 commit 数 | **44** |
| `react_rewrite_web` 落后 `main` 的 commit 数 | **73** |
| 涉及变更文件总数 | **284** |
| 总新增行数 | **+42,869** |
| 总删除行数 | **-33,655** |
| 净增行数 | **+9,214** |

### 1.2 按区域分解

| 区域 | 文件数 | 新增 | 删除 | 净增 | 说明 |
|------|--------|------|------|------|------|
| `frontend/`（新 React 前端） | 139 | +20,325 | 0 | +20,325 | **全新目录**，main 上不存在 |
| `frontend/packages/`（共享包） | 115 | +12,001 | 0 | +12,001 | 包含在上行，RN 依赖此部分 |
| Python 后端 | 16 | +772 | -2,005 | -1,233 | 后端精简 + QR 路由新增 |
| `templates/` + `static/`（旧前端） | 70 | +13,422 | -30,431 | -17,009 | **大量重构和删除** |

### 1.3 矛盾焦点

`react_rewrite_web` 对旧前端进行了以下变动：
- **删除**：`static/universal-tutorial-manager.js`（-2,904 行）、`static/achievement_manager.js`（-324 行）、多个 locale 文件（ja/ko/zh-TW，各 ~1,900 行）
- **重构**：`static/js/model_manager.js`（~8,105 行变动）、`static/js/steam_workshop_manager.js`（~8,245 行变动）— CSS/JS 模块分离

但 `main` 在同一时期往这些 **同样的文件** 上新增了大量功能：
- 教程系统（driver.js）
- 情感控制面板
- VRM 交互增强
- GPT-SoVITS 支持
- i18n 扩展（ja/ko/zh-TW）
- Steam 成就系统
- 麦克风增益控制
- 等等 73 个 commit

**核心矛盾**：一边在删/重构旧代码，一边在旧代码上堆新功能。

---

## 2. main 分支上的 73 个新 commit

以下是 `react_rewrite_web` 尚未合入的 `main` 上的全部 commit（按时间倒序）：

```
122ea3b Fix vrm scale storing and ui-button location logics. Enable VRM camera rotating.
44e7912 Fix issues with Gemini Live vision and international free server.
ba350f2 为音色注册页面添加声音预览功能 (#319)
4659599 Add floating hover effect to persistent expression list items (#318)
ac27503 Add GPT-SoVITS support (#298)
303f894 Merge branch 'main' of https://github.com/Project-N-E-K-O/N.E.K.O
a46bd07 fix micro volume display issue
9a2c2d4 Change layout of microphone setup. Fix it for vrm.
376a22d feat: truncate long text chats and sync rewritten memory (#306)
da65a82 feat: 添加扬声器音量控制功能 (#312)
9b862f6 修复屏幕缩放不同对模型位置和UI大小的影响 (#317)
1577e2d Let the expand icon same as back icon (#316)
3677a96 Fix voice chat state reset issue after session timeout (#315)
d02062c 修复在教程期间请她离开、拖动角色之类的可能造成的问题 (#314)
f65affb feat: Reduce keyword repetition in memory summaries with pronoun substitution (#310)
9b56f37 utilize bilibili-api-python library for bilibili scraping (#309)
799b119 加了两个issue模板 (#311)
bb336ea Add a system tray note to the home tutorial and simplify the tray preview (#303)
df92e16 feat: 为初始角色的默认档案内容值和键名提供i18n (#308)
852f5c3 feat: add sidebar white panel treatment and prevent button text clipping (#305)
851b960 修复角色管理页面和声音克隆界面可以多开的问题 (#304)
6017dae Complete ko translation i18n files (#302)
a50ca60 fix: Reset VRM scene position to origin and update API key management link
27470c2 fix: Update emotion model and adjust tutorial steps for clarity
6bf361e fix: Update emotion model and enhance interaction logic. Update tutorials.
8ce8352 style: Update CSS for a unified transparent, borderless window design
bd95e27 fix: Simplify the tutorial & add tutorial reset function (#300)
1da9ea8 feat: 添加 OpenAI TTS worker 支持
90ad2f5 feat: 添加本地游戏时长管理功能 (#301)
faa6ded Merge branch 'main' of https://github.com/Project-N-E-K-O/N.E.K.O
e4a3c84 feat: Enhance microphone gain control and volume visualization
a1f1a15 feat: 更新主动对话提示词 (#299)
f11f565 feat: Complete tutorial system with driver.js & translations (#297)
a4b67fa 情感映射功能将可以选择多个表情和动作 (#296)
4b3b7d5 修复VRM模式的模型不会自动加载的问题 (#295)
bf39c1e feat: 添加模型出界回弹功能 (#294)
375e2e3 refactor: comment out web search tool configurations
e11b4c6 feat: enhance shutdown handling in main server and cross server logic
9516cff refactor: adjust mouth openness calculation
35ac178 feat: 添加聊天框回弹功能 (#292)
fbd9e4f Slightly adjusted mouth openness.
aa32664 为辅助API添加提示并更新i18n (#291)
bb5b5c3 fix: 修复鼠标跟踪中Ctrl键状态检测和悬停淡出阈值 (#290)
102bf31 修复情感配置按钮为圆角长方形而非胶囊形显得突兀的问题 (#287)
e2c7012 修复了捏脸界面部分UI中文字无法正常显示的问题 (#286)
8fc95ca feat: 增加档案名长度限制和验证 (#285)
ca93888 Merge branch 'main' of https://github.com/Project-N-E-K-O/N.E.K.O
90db56d Revert blank removal and emotion management. Merge consecutive user messages.
aefa0c3 fix: 修复下拉选项未选择时显示第一个文件名的问题 (#284)
140526a fix(vrm-interaction): 修复拖拽时按钮拦截事件的问题 (#282)
069a0e8 角色设置页面重复打开多个窗口 (#279)
8d17451 feat: 更新语言包和界面提示 (#283)
9cde21e fix: resolve Steam achievement timing issues (#276)
a358ec9 feat: 增强模型重载功能 (#273)
6551c52 fullfill the ja i18n (#274)
7f8a327 refactor: update persistent expression handling in Live2DManager
f5b08d6 emotion control page added (#272)
0560bcc fix: 添加模型选择后更新按钮文字的功能 (#271)
8c3f669 feat: enhance mouse tracking for Live2D models
96067cf feat: add localization for motion selection
da8fb6b feat: enhance GeoIP logging and error handling
f6cf884 feat: enhance region detection and API key management for Gemini
d2c893f fix: prevent duplicate window opening on rapid menu clicks (#270)
bc97be7 feat: pause model rendering when entering model management (#269)
4fb7acd feat: update Gemini model configurations and enhance TTS
55ebf56 feat: add glm-4.7-flash model and update proactive chat/vision intervals
03fd294 feat: i18n files fixed & add zh-tw and ja (#268)
756bb46 Fix: 代码格式化和角色切换问题修复 (#267)
9ce5d52 feat: Integrate Gemini Live API for real-time audio and text interactions
```

### 按类别分类

| 类别 | commit 数 | 主要影响区域 |
|------|----------|-------------|
| 旧前端 UI/UX 功能 | ~25 | `static/js/`, `templates/`, `static/css/` |
| i18n 国际化 | ~8 | `static/locales/`, 模板文件 |
| 后端逻辑 | ~15 | `main_logic/`, `main_routers/`, `config/` |
| Live2D / VRM | ~10 | `static/js/model_manager.js`, VRM 相关 |
| 教程系统 | ~5 | `static/universal-tutorial-manager.js`（已被 react_rewrite_web 删除） |
| Steam / 成就 | ~3 | `static/achievement_manager.js`（已被 react_rewrite_web 删除） |
| Bug 修复 | ~7 | 分散 |

---

## 3. react_rewrite_web 的 44 个 commit

```
74b52a1 Merge branch 'main' into react-rewrite
c56f4e4 Merge branch 'main' into react-rewrite
084c1cb fix uv.lock (#262)
d28d426 Merge pull request #261 from noahzaozao/react-rewrite
8d980c9 Merge remote-tracking branch 'neko/main' into react-rewrite
fbd341d Docs/chat text conversation update (#259)
605336f update .cursorrules (#251)
dd8c2a0 [React] refactor(frontend): consolidate TinyEmitter and improve package architecture (#250)
714e345 [react] add collapsible chat panel and improve input layout (#246)
1c63a13 docs(frontend): add spec templates and package docs (#248)
0e8c886 Merge pull request #245 from Project-N-E-K-O/main
1d59b96 Merge pull request #239 from Project-N-E-K-O/main
07de224 [React] add chat screenshot feature (#228)
8e48784 [React] fix(web): load default Live2D model and ensure visible layout (#237)
98a4d01 feat(web): add demo route and fullscreen chat layout (#236)
19b9e01 fix import issues (#235)
a21f97e [React] feat(components): add QrMessageBox component (#234)
75e3ebd [React] add new tool-bar button. (#229)
3917574 [React] feat:add QR code to show backend ip to mobile frontend. (#227)
8bc16fc [React] Feat/audio service package (#225)
16138c9 [React] Feat/webapp realtime ws (#223)
59d4dcf Merge pull request #213 from noahzaozao/feat/request-web-token-storage
8e1aae0 Merge pull request #220 from Project-N-E-K-O/main
5a0d10d [React] Chat System Migration (MessageList & ChatInput Demo) (#207)
46a39f4 feat(webapp): add i18n loading and language switch (#208)
62de483 chore(i18n): add components i18n adapter and align cursor rules (#206)
ae9cd72 chore: load .env and make server bind/ports configurable (#205)
6c7f19b Merge pull request #204 from Project-N-E-K-O/main
c2b4ed0 feat(frontend): add cross-platform realtime (WebSocket) package + web-bridge binding (#203)
45665cf Fix react and rn comments (#200)
de214c8 Merge pull request #196 from noahzaozao/fix/request-cross-platform
00713b6 Update react-rewrite branch to latest
7ccf3b0 Merge branch 'main' into react-rewrite
efad623 Silence request client tests and ignore coverage output (#169)
babe890 feat: add Git line ending config and frontend directory (#164)
0b0f2c5 Merge pull request #162 from Project-N-E-K-O/main
0ed767f Merge pull request #144 from Project-N-E-K-O/main
627b1b1 Merge pull request #129 from Project-N-E-K-O/main
55227a0 Merge pull request #126 from Project-N-E-K-O/main
66c8502 Merge pull request #125 from Project-N-E-K-O/revert-96-main
9695dee Revert "Rebase from main (#96)"
ee417a3 Rebase from main (#96)
0b79e55 Add CORS middleware (#53)
cd8f199 Merge pull request #75 from Project-N-E-K-O/main
bbde5b6 Update to latest version. (0.5.2) (#74)
b4a24f9 Merge pull request #48 from wehos/main
```

核心贡献：
- 新增完整的 `frontend/` 目录（React 前端 + 7 个共享 packages）
- 旧前端 CSS/JS 模块分离重构
- 后端增加 QR 码路由、.env 配置支持

---

## 4. 合并策略：推荐方案

### 4.1 总体方向

```
                  先合入                     再合回
    main ──────────────────► react_rewrite_web ──────────────► main
    (73 个新 commit)          (解决冲突、验证)                  (干净合并)
```

**先把 main 合入 react_rewrite_web**（而非反向），原因：

1. `react_rewrite_web` 是开发分支，在此处解冲突不影响 main 稳定性
2. 可以逐步验证 main 的功能在新架构下正常
3. 一旦验证完毕，反向合并将是 fast-forward 或无冲突

### 4.2 阶段 1：main → react_rewrite_web（冲突解决）

```bash
git checkout react_rewrite_web
git fetch origin
git merge origin/main
# 大量冲突 — 按下方策略处理
```

#### 冲突分区处理策略

| 冲突区域 | 文件数 | 难度 | 处理策略 |
|---------|--------|------|---------|
| `frontend/` | 0 | 无冲突 | main 上不存在，直接保留 |
| Python 后端 | ~10 | 低 | 逐文件 diff，手动合并 |
| `static/js/*.js`（模块化文件） | ~5 | **高** | 见下方详细策略 |
| `static/locales/*.json` | ~5 | 中 | 决定保留还是迁移 |
| `templates/*.html` | ~10 | 中 | 逐文件判断新功能 |
| 其他（.gitignore, config 等） | ~5 | 低 | 简单选择 |

#### `static/js/` 大文件冲突处理

这些文件是冲突重灾区（model_manager.js ~8k 行变动、steam_workshop_manager.js ~8k 行变动）：

**推荐流程**：

1. 先采用 `react_rewrite_web` 的版本（已完成模块分离的代码）
2. 用 `git diff` 找出 main 上新增的功能代码段：
   ```bash
   # 查看 main 上对这些文件做了什么
   git log main --oneline -- static/js/model_manager.js
   git diff <分支分叉点>..main -- static/js/model_manager.js
   ```
3. 逐功能判断是否需要移植：
   - **教程系统** → 如果新架构不需要 driver.js，可跳过
   - **情感控制面板** → 可能需要移植到新 React 组件
   - **VRM 增强** → 如果旧模板仍保留 VRM 页面，需要合入
   - **i18n 新增 key** → 迁移到 `frontend/` 的 i18n 系统

#### `static/locales/` 处理

main 新增/扩充了 ja、ko、zh-TW 的 locale 文件，但 react_rewrite_web 删除了它们。

**决策点**：
- 如果 React 前端的 i18n 系统（`frontend/src/web/` 下）已覆盖这些语言 → 不需要恢复
- 如果旧模板页面仍在使用且需要多语言 → 需要恢复
- **建议**：暂时恢复（保持 main 的版本），等 React 前端完全替代旧模板后再删除

### 4.3 阶段 2：验证

合并完冲突后，验证：

```bash
# 后端启动
python main_server.py

# Web 前端构建
cd frontend && npm run build

# 旧模板页面手动测试
# 打开 http://localhost:48911 检查功能
```

验证清单：
```
□  后端正常启动，无导入错误
□  Web 前端能构建成功
□  旧模板页面的核心功能正常（Live2D、对话、设置）
□  新 React 页面正常（如有 demo route）
□  main 上的新功能可用（情感面板、教程、VRM 等）
```

### 4.4 阶段 3：react_rewrite_web → main（干净合并）

```bash
git checkout main
git merge react_rewrite_web
# 此时应无冲突或极少冲突
git push origin main
```

### 4.5 阶段 4：同步 RN 共享包

```bash
cd N.E.K.O.-RN
node scripts/sync-neko-packages.js --verbose
npm install
npm run typecheck    # 如果有 typecheck 脚本
```

---

## 5. 重要：RN 开发与分支合并是并行的

```
时间线 ──────────────────────────────────────────────────►

线路 A (RN 移动端)     [即刻启动]
  │  搭环境 → 真机跑通 → 体验打磨 → 补功能 → 出包
  │
  │  * 使用 main 分支后端
  │  * RN 仓库已有共享 packages
  │  * 不阻塞于分支合并
  │
线路 B (分支合并)       [同步推进]
  │  阶段1: merge main → react_rewrite_web
  │  阶段2: 验证
  │  阶段3: merge react_rewrite_web → main
  │  阶段4: 重新同步 RN packages (此时 RN 获得最新包)
  │
  ▼
两线汇合：main 统一 + RN packages 更新
```

**关键认识**：RN 项目的 6 个共享包已经在 RN 仓库中，通过 npm workspace 本地引用。RN 连接的是后端 WebSocket，协议在 main 和 react_rewrite_web 之间基本一致。因此 **RN 开发不被分支合并阻塞**。

合并完成后做一次 `sync:neko-packages` 即可让 RN 获得最新版本的共享包。

---

## 6. 风险与缓解

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| static/js 合并冲突解不干净 | 高 | 旧前端功能丢失 | 保留 main 版本为备份分支，逐功能移植 |
| 合并后旧前端 JS 运行时报错 | 中 | 用户体验受损 | 浏览器控制台逐页面测试 |
| Python 后端合并引入 import 错误 | 低 | 服务启动失败 | 合并后立即 `python main_server.py` 验证 |
| 共享包同步后 RN 类型错误 | 中 | RN 构建失败 | 同步后执行 `npm run typecheck` |
| RN 端功能依赖新版包接口 | 低 | 功能回退 | overlay 机制保留 RN 特有改动 |

---

## 7. 备选方案

### 方案 B：Cherry-pick

不做完整 merge，而是从 main 挑选需要的 commit 到 react_rewrite_web。

**优点**：精确控制，避免不需要的改动
**缺点**：73 个 commit 逐个审查，容易遗漏依赖关系
**适用**：如果只需要 main 上的部分功能

### 方案 C：完整替换

放弃 main 上的旧前端改动，react_rewrite_web 强制覆盖。

**优点**：最简单
**缺点**：丢失 73 个 commit 中的所有旧前端功能
**适用**：如果决定完全放弃旧前端（所有功能已在 React 前端中重写）

### 方案 D：双分支并存

不合并，main 保持旧架构，react_rewrite_web 独立演进。

**优点**：零风险
**缺点**：长期维护两套前端，分裂加剧
**适用**：不推荐

---

## 相关文档

- [跨项目集成架构](./cross-project-integration.md) — 两仓库协作全貌
- [RN 项目现状评估](./rn-current-status.md) — RN 端完成度详表
- [RN 移动端开发指南](./rn-development-guide.md) — 从搭环境到出包的完整步骤
- [上游 packages 同步指南](../guides/upstream-sync.md) — 同步流程与 overlay
