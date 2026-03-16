# N.E.K.O. React Native 多语言支持 (i18n) 实现方案

## 目录
- [概述](#概述)
- [当前状态分析](#当前状态分析)
- [技术选型](#技术选型)
- [实现架构](#实现架构)
- [目录结构](#目录结构)
- [翻译键组织](#翻译键组织)
- [实现步骤](#实现步骤)
- [迁移清单](#迁移清单)
- [注意事项](#注意事项)

---

## 概述

本文档详细说明 N.E.K.O. React Native 应用实现多语言支持（i18n）的方案。

### 目标
- 支持 6 种语言：中文（简体/繁体）、英语、日语、韩语、俄语
- 与桌面端共享翻译资源
- 提供用户友好的语言切换界面
- 支持运行时动态切换语言
- 保持类型安全

---

## 当前状态分析

### 桌面端实现
- **库**: i18next
- **语言包位置**: `c:\Users\ALEXGREENO\myprojects\N.E.K.O\static\locales\`
- **支持语言**: zh-CN, zh-TW, en, ja, ko, ru
- **初始化**: [i18n-i18next.js](c:\Users\ALEXGREENO\myprojects\N.E.K.O\static\i18n-i18next.js:1)

### 移动端当前状态
| 项目 | 状态 | 说明 |
|------|------|------|
| i18n 框架 | 🟡 部分实现 | [i18n.tsx](c:\Users\ALEXGREENO\myprojects\N.E.K.O.-RN\packages\project-neko-components\src\i18n.tsx:1) 定义了 Provider 和 hook |
| 翻译文件 | 🔴 无 | 没有 locales 目录和 JSON 文件 |
| i18n 库 | 🔴 无 | 没有安装 i18next 或其他 i18n 库 |
| 语言切换 UI | 🔴 无 | 设置界面没有语言选项 |
| 硬编码文本 | 🔴 严重 | 所有界面文本都是硬编码的中文字符串 |

---

## 技术选型

### 推荐方案: i18next + react-i18next

**理由**:
1. ✅ 与桌面端使用相同的技术栈，便于维护
2. ✅ React Native 生态成熟，社区支持好
3. ✅ 支持命名空间、插值、复数等高级功能
4. ✅ 有 TypeScript 类型定义
5. ✅ 支持懒加载语言包
6. ✅ 有丰富的插件生态

### 安装依赖
```bash
npm install i18next react-i18next
npm install --save-dev @types/i18next
```

---

## 实现架构

### 核心组件

```
┌─────────────────────────────────────────────────────┐
│              App (Root Layout)                  │
│  ┌─────────────────────────────────────────────┐  │
│  │     I18nextProvider (Context)            │  │
│  │  ┌─────────────────────────────────────┐  │  │
│  │  │   SafeArea / Tab Navigator          │  │  │
│  │  │  ┌─────────────────────────────┐   │  │  │
│  │  │  │   Screen Components       │   │  │  │
│  │  │  │   (useTranslation)      │   │  │  │
│  │  │  └─────────────────────────────┘   │  │  │
│  │  └─────────────────────────────────────┘  │  │
│  └─────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

### 数据流

```
用户点击语言切换
    ↓
changeLanguage('en')
    ↓
i18next 更新资源
    ↓
Context 更新
    ↓
useTranslation() 返回新的 t 函数
    ↓
组件重新渲染
```

---

## 目录结构

```
N.E.K.O.-RN/
├── i18n/
│   ├── index.ts                 # i18n 配置和初始化
│   ├── config.ts               # i18next 配置对象
│   └── locales/               # 翻译文件目录
│       ├── zh-CN.json         # 简体中文
│       ├── zh-TW.json         # 繁体中文
│       ├── en.json            # 英语
│       ├── ja.json            # 日语
│       ├── ko.json            # 韩语
│       └── ru.json            # 俄语
├── app/
│   ├── _layout.tsx           # 添加 I18nextProvider
│   └── ...
├── packages/
│   └── project-neko-components/
│       └── src/
│           └── i18n.tsx      # 保留（提供兼容层）
└── package.json               # 添加 i18next 依赖
```

---

## 翻译键组织

### 按功能模块划分

```typescript
// i18n/locales/zh-CN.json
{
  "common": {
    "load": "加载",
    "save": "保存",
    "cancel": "取消",
    "confirm": "确认",
    "ok": "确定",
    "delete": "删除",
    "edit": "编辑",
    "loading": "加载中...",
    "error": "错误",
    "success": "成功",
    "close": "关闭",
    "back": "返回",
    "retry": "重试"
  },

  "home": {
    "title": "Project N.E.K.O.",
    "shortcuts": "快捷功能",
    "apiSettings": "API 设置",
    "characterManager": "角色管理",
    "serverConnection": "服务器连接",
    "status": {
      "online": "就绪",
      "offline": "未连接",
      "configured": "已配置，等待连接…",
      "unconfigured": "扫码或手动配置以连接"
    },
    "actions": {
      "manualConfig": "手动配置",
      "qrConfig": "扫码配置",
      "currentRole": "角色"
    }
  },

  "main": {
    "chat": {
      "title": "对话",
      "placeholder": "输入消息...",
      "send": "发送",
      "collapse": "收起",
      "expand": "展开"
    },
    "agent": {
      "enabled": "Agent 模式已开启",
      "disabled": "Agent 模式已关闭",
      "connecting": "Agent 服务器连接中...",
      "offline": "Agent 服务器未启动",
      "unavailable": "功能不可用"
    },
    "character": {
      "switching": "切换角色中...",
      "loading": "加载模型中...",
      "switched": "已切换到 {{name}}",
      "switchError": "角色切换失败"
    },
    "voice": {
      "start": "开始语音",
      "stop": "停止语音",
      "preparing": "准备中...",
      "ready": "就绪"
    },
    "debug": {
      "title": "调试信息",
      "toggle": "显示/隐藏"
    }
  },

  "settings": {
    "title": "设置",
    "sections": {
      "api": "API 配置",
      "provider": "提供商选择",
      "p2p": "P2P 配置",
      "language": "语言"
    },
    "language": {
      "title": "语言设置",
      "select": "选择语言",
      "languages": {
        "zh-CN": "简体中文",
        "zh-TW": "繁体中文",
        "en": "English",
        "ja": "日本語",
        "ko": "한국어",
        "ru": "Русский"
      },
      "restartRequired": "更改语言后需要重启应用"
    },
    "actions": {
      "save": "保存配置",
      "saving": "保存中...",
      "saved": "配置已保存",
      "refresh": "刷新配置"
    }
  },

  "connection": {
    "status": {
      "connected": "已连接",
      "disconnected": "未连接",
      "reconnecting": "重新连接中..."
    },
    "errors": {
      "timeout": "连接超时",
      "refused": "连接被拒绝",
      "networkError": "网络错误"
    }
  },

  "toast": {
    "connectionRestored": "已恢复连接",
    "switchedCharacter": "已切换到 {{name}}",
    "settingsSaved": "设置已保存",
    "errorOccurred": "发生错误: {{error}}"
  }
}
```

### TypeScript 类型定义

```typescript
// i18n/types.ts
export type TranslationNamespace =
  | 'common'
  | 'home'
  | 'main'
  | 'settings'
  | 'connection'
  | 'toast';

export interface TranslationResources {
  [key: string]: string | TranslationResources;
}

export interface LanguageResources {
  [language: string]: {
    translation: TranslationResources;
  };
}
```

---

## 实现步骤

### 步骤 1: 安装依赖
```bash
cd c:\Users\ALEXGREENO\myprojects\N.E.K.O.-RN
npm install i18next react-i18next
npm install --save-dev @types/i18next
```

### 步骤 2: 创建 i18n 目录结构

```bash
mkdir -p i18n/locales
```

### 步骤 3: 复制并适配桌面端语言包

从桌面端复制语言包并根据移动端需求调整：
- 保留移动端需要的翻译键
- 删除桌面端特定功能的翻译（如 Steam Workshop）
- 添加移动端特定的翻译

### 步骤 4: 创建 i18n 配置文件

```typescript
// i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 导入语言包
import zhCN from './locales/zh-CN.json';
import zhTW from './locales/zh-TW.json';
import en from './locales/en.json';
import ja from './locales/ja.json';
import ko from './locales/ko.json';
import ru from './locales/ru.json';

const LANGUAGE_STORAGE_KEY = 'neko_language';

// 支持的语言列表
export const SUPPORTED_LANGUAGES = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁体中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'ru', name: 'Русский' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

// 获取系统语言
export function getSystemLanguage(): string {
  const deviceLocales = getLocales();
  const deviceLanguage = deviceLocales[0]?.languageCode || 'zh-CN';

  // 映射系统语言到支持的语言
  const langMap: Record<string, string> = {
    'zh': 'zh-CN',
    'en': 'en',
    'ja': 'ja',
    'ko': 'ko',
    'ru': 'ru',
  };

  return langMap[deviceLanguage] || 'zh-CN';
}

// 从存储获取语言
export async function getStoredLanguage(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

// 保存语言设置
export async function setStoredLanguage(language: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  } catch (e) {
    console.error('Failed to save language:', e);
  }
}

// 获取初始语言
export async function getInitialLanguage(): Promise<string> {
  const stored = await getStoredLanguage();
  if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) {
    return stored;
  }
  return getSystemLanguage();
}

// i18n 配置
export const i18nConfig = {
  resources: {
    'zh-CN': { translation: zhCN },
    'zh-TW': { translation: zhTW },
    'en': { translation: en },
    'ja': { translation: ja },
    'ko': { translation: ko },
    'ru': { translation: ru },
  },
  fallbackLng: 'zh-CN',
  interpolation: {
    escapeValue: false,
  },
  react: {
    useSuspense: false,
  },
};

// 初始化 i18n
export async function initI18n(): Promise<void> {
  const initialLanguage = await getInitialLanguage();

  await i18n
    .use(initReactI18next)
    .init({
      ...i18nConfig,
      lng: initialLanguage,
    });

  // 设置 RTL（如果需要）
  I18nManager.allowRTL(false);
}

// 切换语言
export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language);
  await setStoredLanguage(language);

  // 对于 RTL 语言可能需要重启应用
  // const isRTL = language === 'ar' || language === 'he';
  // if (I18nManager.isRTL !== isRTL) {
  //   RNRestart.Restart();
  // }
}

// 导出 i18n 实例
export default i18n;
```

### 步骤 5: 创建 i18n 入口文件

```typescript
// i18n/index.ts
export { initI18n, changeLanguage, getInitialLanguage, SUPPORTED_LANGUAGES, getSystemLanguage } from './config';
export type { SupportedLanguage } from './config';
export { default as i18n } from './config';
```

### 步骤 6: 在 App 中初始化 i18n

```typescript
// app/_layout.tsx
import { useEffect } from 'react';
import { I18nextProvider } from 'react-i18next';
import { initI18n } from '@/i18n';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    // ... 字体加载
  });

  useEffect(() => {
    async function prepare() {
      try {
        await initI18n();
      } catch (e) {
        console.warn('Failed to initialize i18n:', e);
      }
    }
    prepare();
  }, []);

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) {
    return null;
  }

  return (
    <I18nextProvider i18n={i18n}>
      {/* 原有的布局内容 */}
    </I18nextProvider>
  );
}
```

### 步骤 7: 更新现有组件使用翻译

```typescript
// 示例: app/(tabs)/index.tsx
import { useTranslation } from 'react-i18next';

export default function HomeScreen() {
  const { t } = useTranslation();

  return (
    <View>
      <Text>{t('home.title')}</Text>
      <Text>{t('home.shortcuts')}</Text>
      <Text>{t('home.apiSettings')}</Text>
    </View>
  );
}
```

### 步骤 8: 在设置界面添加语言选择器

```typescript
// app/settings.tsx
import { useTranslation } from 'react-i18next';
import { changeLanguage, SUPPORTED_LANGUAGES } from '@/i18n';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;

  const handleLanguageChange = async (langCode: string) => {
    await changeLanguage(langCode as any);
    // 可选：显示需要重启的提示
  };

  return (
    <View>
      <Text>{t('settings.language.title')}</Text>
      <ScrollView>
        {SUPPORTED_LANGUAGES.map(lang => (
          <TouchableOpacity
            key={lang.code}
            onPress={() => handleLanguageChange(lang.code)}
            style={[
              styles.languageOption,
              currentLanguage === lang.code && styles.selected
            ]}
          >
            <Text style={styles.languageName}>
              {t(`settings.language.languages.${lang.code}`)}
            </Text>
            {currentLanguage === lang.code && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}
```

---

## 迁移清单

### 第一阶段: 基础设施
- [ ] 安装 i18next 和 react-i18next
- [ ] 创建 i18n 目录结构
- [ ] 实现 i18n 配置和初始化
- [ ] 创建基础翻译文件（至少 zh-CN 和 en）
- [ ] 在 App 布局中集成 I18nextProvider

### 第二阶段: 核心页面翻译
- [ ] app/(tabs)/index.tsx - 首页
- [ ] app/(tabs)/main.tsx - 主界面
- [ ] app/settings.tsx - 设置页面
- [ ] app/qr-scanner.tsx - 二维码扫描
- [ ] app/server-config.tsx - 服务器配置
- [ ] app/character-manager.tsx - 角色管理

### 第三阶段: 组件翻译
- [ ] packages/project-neko-components/src/chat/ - 聊天组件
- [ ] packages/project-neko-components/src/Live2DRightToolbar/ - 工具栏
- [ ] components/ - 其他组件

### 第四阶段: 其他语言
- [ ] 创建 zh-TW.json（繁体中文）
- [ ] 创建 ja.json（日语）
- [ ] 创建 ko.json（韩语）
- [ ] 创建 ru.json（俄语）

### 第五阶段: 优化和测试
- [ ] 添加语言切换动画
- [ ] 处理缺失翻译的回退
- [ ] 测试所有语言显示效果
- [ ] 检查文本溢出问题
- [ ] 验证 RTL 语言支持（如需要）

---

## 注意事项

### 1. 与现有 i18n.tsx 的兼容性

现有的 `packages/project-neko-components/src/i18n.tsx` 提供了一个兼容层：
```typescript
export function useT(): TFunction {
  const ctxT = useContext(I18nContext);
  if (ctxT) return ctxT;
  const wt = getWindowT();
  if (wt) return wt;
  return (key: string) => key;
}
```

迁移后可以保留这个文件作为过渡，或者直接替换为 react-i18next 的 `useTranslation`。

### 2. 翻译键命名规范

- 使用小写字母和连字符：`my-key-name`
- 按功能模块分组：`home.title`, `settings.api.save`
- 避免过深的嵌套（不超过 3 层）
- 使用描述性名称：`settings.language.select` 而不是 `settings.lang.sel`

### 3. 插值和动态内容

```typescript
// 翻译文件
{
  "message": "欢迎, {{name}}!",
  "count": "您有 {{count}} 条消息"
}

// 组件使用
<Text>{t('message', { name: 'User' })}</Text>
<Text>{t('count', { count: 5 })}</Text>
```

### 4. 复数处理

```typescript
// 翻译文件
{
  "items": "item",
  "items_plural": "items"
}

// 组件使用
<Text>{t('items', { count })}</Text>
```

### 5. 文本长度差异

不同语言的文本长度可能差异很大：
- 中文字符紧凑，英文可能长 2-3 倍
- 德语、俄语可能更长
- 使用 `flex: 1` 和自适应布局
- 为文本溢出提供 `numberOfLines={2}` 和 `ellipsizeMode='tail'`

### 6. 图片和图标中的文本

- 避免使用包含文字的图片
- 使用 SVG 图标 + 文本组合
- 如果必须使用文字图片，为每种语言准备版本

### 7. 日期、数字、货币

使用 `Intl` API 进行格式化：
```typescript
new Intl.DateTimeFormat(language).format(date);
new Intl.NumberFormat(language).format(number);
```

### 8. 持久化语言设置

确保语言设置在应用重启后保持：
```typescript
AsyncStorage.setItem('neko_language', language);
```

---

## 参考资料

- [i18next 官方文档](https://www.i18next.com/)
- [react-i18next 文档](https://react.i18next.com/)
- [桌面端 i18n 实现](c:\Users\ALEXGREENO\myprojects\N.E.K.O\static\i18n-i18next.js:1)
- [桌面端语言包](c:\Users\ALEXGREENO\myprojects\N.E.K.O\static\locales\)

---

## 附录: 快速参考

### 常用 i18next API

```typescript
import { useTranslation } from 'react-i18next';

const { t, i18n } = useTranslation();

// 翻译
t('key')
t('namespace:key')
t('key', { param: 'value' })

// 获取当前语言
i18n.language

// 切换语言
i18n.changeLanguage('en')

// 获取支持的语言列表
i18n.languages
```

### 命名空间使用

如果需要分离大型翻译文件：
```typescript
import { useTranslation } from 'react-i18next';

const { t } = useTranslation('home');
t('title'); // 对应 home:title
```

---

**文档版本**: 1.0
**创建日期**: 2026-03-16
**作者**: N.E.K.O. Team
