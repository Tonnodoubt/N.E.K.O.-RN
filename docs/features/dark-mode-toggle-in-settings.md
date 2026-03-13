# 在设置面板添加暗色/白天模式切换按钮

**文档版本**: v1.3
**更新日期**: 2026-03-08
**适用范围**: React Native 移动端

## 实施状态总览

| 步骤 | 文件 | 状态 |
|------|------|------|
| 按钮添加 — 类型定义 | `types.ts` | ✅ 已完成 |
| 按钮添加 — Toggle 行配置 | `hooks.ts` | ✅ 已完成 |
| 按钮连线 — 主应用状态与切换逻辑 | `app/(tabs)/main.tsx` | ✅ 已完成 |
| 全局 UI 主题响应（视觉层） | 见 `ui-theme-light-dark-adaptation.md` | ✅ 已完成 |
| 功能2 — 后端主题同步 | 后端 + RN + Web | ⬜ 待实施 |

---

## 1. 功能概述

在工具栏的「设置」面板（Settings Panel）中添加一个主题切换开关，与现有的「自主视觉」（`proactiveVision`）开关保持相同的 UI 风格。

| 功能 | 描述 |
|------|------|
| **状态显示** | Switch 开启 = 暗色模式，关闭 = 白天模式，反映当前实际主题 |
| **即时切换** | 点击后立即调用 `Appearance.setColorScheme()` 切换全局主题 |
| **初始化** | 页面加载时读取系统当前色彩方案作为初始值 |
| **持久化** | 通过 `AsyncStorage` 保存用户偏好，下次启动时恢复 |

---

## 2. 现有架构（参考 proactiveVision）

「自主视觉」开关的完整调用链如下，暗色模式开关遵循完全相同的模式：

```text
types.ts              — 类型定义（Live2DSettingsToggleId + Live2DSettingsState）
    ↓
hooks.ts              — useSettingsToggleRows() 生成开关行配置
    ↓
Live2DRightToolbar    — Switch 渲染（.native.tsx / .tsx）
    ↓
main.tsx              — toolbarSettings 状态 + handleToolbarSettingsChange()
```

---

## 3. 需修改的文件（共 2 个）✅ 已完成

### 3.1 `packages/project-neko-components/src/Live2DRightToolbar/types.ts` ✅

**Step 1**: 在 `Live2DSettingsToggleId` 联合类型中添加 `"darkMode"`

```typescript
// 修改前
export type Live2DSettingsToggleId = "mergeMessages" | "allowInterrupt" | "proactiveChat" | "proactiveVision";

// 修改后
export type Live2DSettingsToggleId = "mergeMessages" | "allowInterrupt" | "proactiveChat" | "proactiveVision" | "darkMode";
```

**Step 2**: 在 `Live2DSettingsState` 接口中添加 `darkMode` 字段

```typescript
// 修改前
export interface Live2DSettingsState {
  mergeMessages: boolean;
  allowInterrupt: boolean;
  proactiveChat: boolean;
  proactiveVision: boolean;
}

// 修改后
export interface Live2DSettingsState {
  mergeMessages: boolean;
  allowInterrupt: boolean;
  proactiveChat: boolean;
  proactiveVision: boolean;
  darkMode: boolean;       // true = 暗色模式，false = 白天模式
}
```

---

### 3.2 `packages/project-neko-components/src/Live2DRightToolbar/hooks.ts` ✅

在 `useSettingsToggleRows()` 的返回数组中，紧跟 `proactiveVision` 之后追加 `darkMode` 行：

```typescript
export function useSettingsToggleRows(
  settings: Live2DSettingsState,
  t?: TFunction
): ToggleRow[] {
  return useMemo(
    () => [
      {
        id: 'mergeMessages' as const,
        label: tOrDefault(t, 'settings.toggles.mergeMessages', '合并消息'),
        checked: settings.mergeMessages,
      },
      {
        id: 'allowInterrupt' as const,
        label: tOrDefault(t, 'settings.toggles.allowInterrupt', '允许打断'),
        checked: settings.allowInterrupt,
      },
      {
        id: 'proactiveChat' as const,
        label: tOrDefault(t, 'settings.toggles.proactiveChat', '主动搭话'),
        checked: settings.proactiveChat,
      },
      {
        id: 'proactiveVision' as const,
        label: tOrDefault(t, 'settings.toggles.proactiveVision', '自主视觉'),
        checked: settings.proactiveVision,
      },
      // ↓ 新增
      {
        id: 'darkMode' as const,
        label: tOrDefault(t, 'settings.toggles.darkMode', '暗色模式'),
        checked: settings.darkMode,
      },
    ],
    [settings, t]
  );
}
```

> `Live2DRightToolbar.native.tsx` 和 `Live2DRightToolbar.tsx` 均通过 `settingsToggleRows` 渲染，**无需单独修改**，新行会自动出现在 Settings Panel 中。

---

## 4. 需修改的文件（主应用，共 1 个）

> **注意**：本节为「本地存储方案」（主题偏好仅存设备本地）。若需要与网页端同步，以第 10.3 节为准，该节会替代本节的 4.1.3 和 4.1.4。

### 4.1 `app/(tabs)/main.tsx`

#### 4.1.1 导入 `Appearance` 和 `AsyncStorage`

```typescript
import { Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
```

> `AsyncStorage` 需要安装：`npx expo install @react-native-async-storage/async-storage`（若项目尚未安装）

#### 4.1.2 初始化 `toolbarSettings` 时读取系统色彩方案

`useState` 的初始值在组件首次渲染时同步计算，`useColorScheme()` 可直接读取当前系统主题。

```typescript
// 修改前（约 line 253）
const [toolbarSettings, setToolbarSettings] = useState<Live2DSettingsState>({
  mergeMessages: true,
  allowInterrupt: true,
  proactiveChat: false,
  proactiveVision: false,
});

// 修改后
const systemColorScheme = useColorScheme();   // 已在文件顶部导入（hooks/use-color-scheme.ts）
const [toolbarSettings, setToolbarSettings] = useState<Live2DSettingsState>({
  mergeMessages: true,
  allowInterrupt: true,
  proactiveChat: false,
  proactiveVision: false,
  darkMode: systemColorScheme === 'dark',     // 同步读取，无需等待异步
});
```

#### 4.1.3 在 `useEffect` 中从 `AsyncStorage` 覆盖用户手动偏好

若用户曾在 App 内手动切换过主题，以 AsyncStorage 中存储的值为准（覆盖系统默认值）。

```typescript
// 在 useEffect 区域（loadConfig 附近）添加
useEffect(() => {
  AsyncStorage.getItem('neko_dark_mode').then((val) => {
    if (val !== null) {
      // 用户曾手动设置过，覆盖系统主题初始值
      const isDark = val === 'true';
      setToolbarSettings((prev) => ({ ...prev, darkMode: isDark }));
      Appearance.setColorScheme(isDark ? 'dark' : 'light');
    }
    // val === null 表示用户从未手动设置，保留系统主题初始值，不做任何操作
  });
}, []);
```

> 由于 AsyncStorage 读取是异步的，首次渲染会先显示系统主题，读取完成后才可能切换（约 10–50ms）。如果用户偏好与系统主题一致则无感知；不一致时会有轻微闪烁，是 AsyncStorage 方案的固有缺陷，可接受。

#### 4.1.4 在 `handleToolbarSettingsChange` 中处理主题切换

```typescript
// 修改前（约 line 792）
const handleToolbarSettingsChange = useCallback((id: Live2DSettingsToggleId, next: boolean) => {
  setToolbarSettings((prev) => ({ ...prev, [id]: next }));
}, []);

// 修改后
const handleToolbarSettingsChange = useCallback((id: Live2DSettingsToggleId, next: boolean) => {
  setToolbarSettings((prev) => ({ ...prev, [id]: next }));  // 立即更新 Switch 显示状态

  if (id === 'darkMode') {
    Appearance.setColorScheme(next ? 'dark' : 'light');      // 立即切换全局主题
    AsyncStorage.setItem('neko_dark_mode', String(next));    // 异步持久化，fire-and-forget
  }
}, []);
```

---

## 5. i18n 适配（可选）

若项目使用 i18n，需在各语言包中添加对应键名：

```typescript
// i18n key: 'settings.toggles.darkMode'
'zh-CN': '暗色模式',
'zh-TW': '深色模式',
'en':    'Dark Mode',
'ja':    'ダークモード',
'ko':    '다크 모드',
```

若不添加 i18n 键，`tOrDefault()` 会使用 `hooks.ts` 中指定的中文 fallback `'暗色模式'`，功能不受影响。

---

## 6. 修改文件汇总

| 文件 | 修改内容 | 行数变化 |
|------|----------|---------|
| `packages/project-neko-components/src/Live2DRightToolbar/types.ts` | `Live2DSettingsToggleId` 加 `"darkMode"`；`Live2DSettingsState` 加 `darkMode: boolean` | +2 行 |
| `packages/project-neko-components/src/Live2DRightToolbar/hooks.ts` | `useSettingsToggleRows` 数组追加 `darkMode` 行 | +5 行 |
| `app/(tabs)/main.tsx` | 初始值 + AsyncStorage 恢复 + `handleToolbarSettingsChange` 处理 | +12 行 |

**无需修改**的文件：

| 文件 | 原因 |
|------|------|
| `Live2DRightToolbar.native.tsx` | `settingsToggleRows` 循环渲染，自动包含新行 |
| `Live2DRightToolbar.tsx` | 同上（Web 端） |
| `constants/theme.ts` | `Colors.light / Colors.dark` 已定义，`Appearance.setColorScheme` 会触发 `useColorScheme` 重新返回新值 |
| `hooks/use-color-scheme.ts` | 直接导出 RN 的 `useColorScheme`，无需修改 |

---

## 7. 实现顺序

1. **Step 1**: 修改 `types.ts`（类型先行，避免 TS 编译错误）
2. **Step 2**: 修改 `hooks.ts`（添加 toggle 行）
3. **Step 3**: 修改 `app/(tabs)/main.tsx`（状态初始化 + 切换逻辑）
4. **Step 4**: 构建/热重载，打开设置面板确认「暗色模式」开关出现在「自主视觉」下方

---

## 8. 验证方案

| 测试项 | 操作 | 预期结果 |
|--------|------|----------|
| **开关显示** | 打开工具栏 → 设置面板 | 「暗色模式」开关出现在「自主视觉」下方 |
| **初始值** | 设备系统主题为暗色时启动 | 开关初始为开启状态 |
| **切换生效** | 点击开关切换 | 全局背景/文字颜色立即切换 |
| **持久化** | 切换后重启 App | 上次设置的主题被恢复 |
| **系统覆盖** | 在 App 内切换后，再改系统主题 | 以 App 内设置为准（`Appearance.setColorScheme` 优先于系统） |

---

## 9. 注意事项

### 9.1 `Appearance.setColorScheme()` 的兼容性

- **iOS 13+ / Android 10+**：原生支持，`useColorScheme()` 立即返回新值
- **旧版系统**：`setColorScheme` 可能无效，颜色变化需要通过 Context 手动传递

### 9.2 Web 端

`settings.tsx`（Web 版 API 设置页）使用固定暗色 CSS（`#1a1a2e` 背景），不依赖 `useColorScheme`。
Web 端的主题切换需额外处理 CSS 变量或 class，**超出本文档范围**。

### 9.3 与系统主题的关系

调用 `Appearance.setColorScheme('dark' | 'light')` 后，RN 的 `useColorScheme()` 会返回强制值，而非系统值。要恢复跟随系统，传入 `null`：

```typescript
Appearance.setColorScheme(null); // 恢复跟随系统
```

---

## 10. 与网页端主题同步

### 10.1 现状分析

| 端 | 主题存储位置 | 持久化方式 |
|----|-------------|-----------|
| **Web 端** | `localStorage['neko-dark-mode']` | 浏览器本地，随浏览器/设备 |
| **RN 端（当前方案）** | `AsyncStorage['neko_dark_mode']` | 设备本地，与 Web 端完全独立 |

当前两端**不共享**主题状态。在手机上切换为暗色，浏览器端不会联动，反之亦然。

---

### 10.2 同步可行性

**可以同步**。两端共享同一个后端，通过后端做中转是最简单且最稳定的方案。

现有后端 `/api/config/preferences` 只处理 Live2D/VRM 模型位置、缩放等数据（有严格格式校验），**不能直接复用**。

---

### 10.3 推荐方案：后端新增 `/api/config/theme` 端点（最小改动）

> 选择本节方案后，**第 4.1.3 节**（AsyncStorage useEffect）和**第 4.1.4 节**的 `handleToolbarSettingsChange` 均以本节代码为准，不再需要 `AsyncStorage` 依赖。

#### Step 1：后端新增端点（`main_routers/config_router.py`）

在文件末尾追加，读写 `ui_settings.json`：

```python
import json, os

# ui_settings.json 路径与 user_preferences.json 同目录
_UI_SETTINGS_FILE = str(_config_manager.get_config_path('ui_settings.json'))

def _load_ui_settings() -> dict:
    try:
        if os.path.exists(_UI_SETTINGS_FILE):
            with open(_UI_SETTINGS_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception:
        pass
    return {}

def _save_ui_settings(data: dict) -> bool:
    try:
        _config_manager.ensure_config_directory()
        with open(_UI_SETTINGS_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception:
        return False


@router.get("/theme")
async def get_theme():
    """获取 UI 主题偏好（darkMode 等）"""
    settings = _load_ui_settings()
    return {"success": True, "darkMode": settings.get("darkMode", False)}


@router.post("/theme")
async def save_theme(request: Request):
    """保存 UI 主题偏好"""
    try:
        data = await request.json()
        settings = _load_ui_settings()
        if "darkMode" in data:
            settings["darkMode"] = bool(data["darkMode"])
        if _save_ui_settings(settings):
            return {"success": True}
        return {"success": False, "error": "保存失败"}
    except Exception as e:
        return {"success": False, "error": str(e)}
```

#### Step 2：RN 端改用后端 API（替换第 4.1.3 + 4.1.4 节）

**`services/api/config.ts`** — 在 `createConfigApiClient` 中追加两个方法：

```typescript
/** GET /api/config/theme */
async getTheme(): Promise<{ darkMode: boolean }> {
  return client.get('/config/theme');
},

/** POST /api/config/theme */
async saveTheme(darkMode: boolean): Promise<ApiResponse> {
  return client.post('/config/theme', { darkMode });
},
```

**`app/(tabs)/main.tsx`** — 替代第 4.1.3 和 4.1.4 节的代码：

```typescript
// 替代 4.1.3 的 AsyncStorage useEffect
// 启动时从后端读取，覆盖系统主题初始值
useEffect(() => {
  const client = createConfigApiClient(`http://${config.host}:${config.port}`);
  client.getTheme().then(({ darkMode }) => {
    setToolbarSettings((prev) => ({ ...prev, darkMode }));
    Appearance.setColorScheme(darkMode ? 'dark' : 'light');
  }).catch(() => {
    // 后端不可达时保留 4.1.2 中的系统主题初始值，不阻塞启动
  });
}, [config.host, config.port]);

// 替代 4.1.4 的 handleToolbarSettingsChange
const handleToolbarSettingsChange = useCallback((id: Live2DSettingsToggleId, next: boolean) => {
  setToolbarSettings((prev) => ({ ...prev, [id]: next }));  // 立即更新 Switch 显示状态

  if (id === 'darkMode') {
    Appearance.setColorScheme(next ? 'dark' : 'light');      // 立即切换全局主题
    const client = createConfigApiClient(`http://${config.host}:${config.port}`);
    client.saveTheme(next);                                   // 异步同步到后端，fire-and-forget
  }
}, [config.host, config.port]);
```

#### Step 3：Web 端读取后端主题（`static/theme-manager.js`）

`theme-manager.js` 中 `init()` 原本是同步 IIFE，需要改为异步以支持后端读取。优先级：**后端 API → localStorage → 系统偏好**。

修改 `init()` 函数，在最早应用主题之前先尝试从后端获取：

```javascript
// 在 IIFE 内定义异步读取函数
async function fetchThemeFromBackend() {
  try {
    const res = await fetch('/api/config/theme');
    if (res.ok) {
      const data = await res.json();
      if (data.success && typeof data.darkMode === 'boolean') {
        return data.darkMode;
      }
    }
  } catch (_) {}
  return null; // 失败时返回 null，降级到 localStorage
}

// 修改 init()：改为 async，并在 localStorage 读取之前插入后端读取
// 注意：为避免主题闪烁（FOUC），需在 HTML <head> 中的 <script> 内
// 用同步 localStorage 先应用一次默认主题，再由后端结果覆盖
async function init() {
  // 1. 同步：先从 localStorage 快速应用（防止闪烁）
  const localVal = localStorage.getItem('neko-dark-mode');
  if (localVal !== null) {
    window.nekoTheme.apply(localVal === 'true');
  }

  // 2. 异步：从后端读取权威值并覆盖
  const backendDark = await fetchThemeFromBackend();
  if (backendDark !== null) {
    window.nekoTheme.apply(backendDark);
    localStorage.setItem('neko-dark-mode', String(backendDark)); // 同步 localStorage
  } else if (localVal === null) {
    // 3. 后端无值且 localStorage 无记录：fallback 到系统偏好
    const sysDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    window.nekoTheme.apply(sysDark);
  }
}
```

Web 端切换主题时同步写入后端（在 `nekoTheme.applyAnimated()` 内，`localStorage.setItem` 旁追加）：

```javascript
fetch('/api/config/theme', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ darkMode: isDark }),
}).catch(() => {}); // fire-and-forget
```

---

### 10.4 同步后数据流

```text
RN 端切换暗色模式
    ↓
POST /api/config/theme { darkMode: true }
    ↓
后端写入 ui_settings.json
    ↓
Web 端刷新（或下次打开）
    ↓
GET /api/config/theme → darkMode: true
    ↓
document.documentElement.setAttribute('data-theme', 'dark')
```

---

### 10.5 各方案对比

| 方案 | 改动量 | 跨端同步 | 离线可用 |
|------|--------|---------|---------|
| **纯本地（原方案）** | 最小，3 文件 | ❌ 各自独立 | ✅ |
| **后端 API 同步（推荐）** | 中，后端 +1 端点，前端各 +5 行 | ✅ RN ↔ Web | ⚠️ 后端不可达时 fallback 系统主题 |
| 复用现有 `/api/config/core_api` | 无需新端点 | ✅ | ⚠️ 混入 API 密钥语义不清晰，不推荐 |

---

### 10.6 修改文件汇总（含同步方案）

| 文件 | 改动内容 |
|------|---------|
| `main_routers/config_router.py` | 追加 `GET/POST /api/config/theme` 端点 |
| `services/api/config.ts` | 追加 `getTheme()` / `saveTheme()` 方法 |
| `app/(tabs)/main.tsx` | 改用 API 读写，删除 AsyncStorage 依赖 |
| `static/theme-manager.js` | `init()` 增加后端读取；切换时写入后端 |

---

## 11. 更新记录

| 版本 | 日期 | 更新内容 |
|------|------|----------|
| v1.3 | 2026-03-09 | 修正：main.tsx 实施状态更新为 ✅；方案对比表列对齐；两处无语言标签的围栏代码块补 text 标签 |
| v1.2 | 2026-03-08 | 修正第 4 节：补充两方案互斥说明、AsyncStorage 闪烁说明；修正第 10.3 节：补充 Web 端完整 init() 改造方式及 FOUC 处理 |
| v1.1 | 2026-03-07 | 新增第 10 节：与网页端主题同步方案 |
| v1.0 | 2026-03-07 | 初始版本 |
