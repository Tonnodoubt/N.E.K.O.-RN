# RN 移动端开发指南

> 本文档是从零搭建开发环境到出可用 App 的完整操作手册。
> 适用于换电脑、新成员加入等场景。

---

## 目录

1. [前置条件](#1-前置条件)
2. [环境搭建](#2-环境搭建)
3. [启动后端](#3-启动后端)
4. [启动 RN 开发服务器](#4-启动-rn-开发服务器)
5. [连接后端](#5-连接后端)
6. [核心链路验证清单](#6-核心链路验证清单)
7. [开发优先级路线图](#7-开发优先级路线图)
8. [常见问题排查](#8-常见问题排查)
9. [构建发布](#9-构建发布)

---

## 1. 前置条件

### 1.1 必需软件

| 软件 | 版本要求 | 用途 |
|------|---------|------|
| Node.js | >= 18 | RN 开发 |
| npm | >= 9 | 包管理 |
| Python | >= 3.11 | N.E.K.O 后端 |
| Git | 最新 | 代码管理 |
| Android Studio | 最新 | Android 构建（需安装 SDK 和模拟器） |
| JDK | 17 | Android 构建必需 |
| Xcode | 15+（仅 macOS） | iOS 构建 |

### 1.2 仓库克隆

两个仓库需要放在 **同级目录** 下（同步脚本依赖相对路径 `../N.E.K.O/`）：

```bash
# 父目录结构
myprojects/
├── N.E.K.O/          # 后端 + Web 前端
└── N.E.K.O.-RN/      # React Native 移动端
```

```bash
cd /你的项目目录/
git clone <N.E.K.O仓库地址> N.E.K.O
git clone <N.E.K.O-RN仓库地址> N.E.K.O.-RN

# N.E.K.O 切到 main 分支（作为后端运行）
cd N.E.K.O
git checkout main

# N.E.K.O.-RN 使用 RN 分支
cd ../N.E.K.O.-RN
git checkout RN
```

### 1.3 初始化 Git Submodule

RN 项目有两个原生模块是 git submodule，必须初始化：

```bash
cd N.E.K.O.-RN
git submodule update --init --recursive
```

确认以下目录有内容（不是空目录）：
- `packages/react-native-live2d/`
- `packages/react-native-pcm-stream/`

---

## 2. 环境搭建

### 2.1 安装 RN 依赖

```bash
cd N.E.K.O.-RN
npm install
```

### 2.2 安装 Python 后端依赖

```bash
cd N.E.K.O
pip install -r requirements.txt
# 或者如果使用 uv:
uv sync
```

### 2.3 Android 环境配置

参考 [Android 平台运行指南](../platforms/android.md) 和 [macOS Android 环境搭建](../guides/android-env-macos.md)。

关键环境变量（Windows 示例）：

```bash
# 添加到系统环境变量
ANDROID_HOME=C:\Users\你的用户名\AppData\Local\Android\Sdk
JAVA_HOME=C:\Program Files\Java\jdk-17

# PATH 中需要包含
%ANDROID_HOME%\platform-tools
%ANDROID_HOME%\emulator
```

验证：

```bash
adb --version          # 应能输出版本号
java -version          # 应显示 JDK 17
emulator -list-avds    # 列出可用模拟器
```

### 2.4 生成原生项目（必需步骤）

因为使用了自定义原生模块（react-native-live2d、react-native-pcm-stream），**不能** 使用 Expo Go。必须生成原生项目并编译 development build：

```bash
cd N.E.K.O.-RN

# 生成 Android/iOS 原生项目
npx expo prebuild

# 或者只生成 Android
npx expo prebuild --platform android

# 或者清空后重新生成
npx expo prebuild --clean
```

生成后会出现 `android/` 和/或 `ios/` 目录。

---

## 3. 启动后端

```bash
cd N.E.K.O
git checkout main
python main_server.py
```

**默认端口**：`48911`（FastAPI 服务器）

启动成功后确认：
- 终端显示 `Uvicorn running on http://0.0.0.0:48911`
- 浏览器访问 `http://localhost:48911` 能看到 N.E.K.O Web 界面

### 获取局域网 IP

手机需要通过局域网 IP 连接电脑后端：

```bash
# Windows
ipconfig
# 找到 IPv4 地址，例如 192.168.1.100

# macOS / Linux
ifconfig | grep "inet "
```

验证手机能访问：在手机浏览器中打开 `http://192.168.x.x:48911/api/config/page_config`，应返回 JSON。

### Windows 防火墙

如果手机无法访问，需要放行端口：

```powershell
# PowerShell（管理员权限）
New-NetFirewallRule -DisplayName "NEKO Backend" -Direction Inbound -Protocol TCP -LocalPort 48911 -Action Allow
```

---

## 4. 启动 RN 开发服务器

### 4.1 方式 A：编译到 Android 真机/模拟器

```bash
cd N.E.K.O.-RN

# 确保手机 USB 调试已开启，或模拟器已启动
adb devices    # 应能看到设备

# 编译并安装到设备
npx expo run:android
```

首次编译需要下载 Gradle 依赖，耗时较长。

### 4.2 方式 B：编译到 iOS（需 Mac）

```bash
cd N.E.K.O.-RN

# 安装 CocoaPods 依赖
cd ios && pod install && cd ..

# 编译并安装到模拟器
npx expo run:ios
```

### 4.3 方式 C：仅开发服务器（设备上已有 Dev Build）

如果设备上已安装过 development build，可以只启动 Metro bundler：

```bash
cd N.E.K.O.-RN
npx expo start --dev-client
```

然后在设备上打开已安装的 App，它会自动连接 Metro 服务器。

---

## 5. 连接后端

App 启动后，需要配置后端连接地址。

### 5.1 方式 A：QR 扫码（推荐）

1. 电脑浏览器打开 `http://localhost:48911/getipqrcode`
2. 在 App 的首页（Home tab）点击进入 **QR Scanner**
3. 扫描屏幕上的二维码
4. 连接信息自动保存到 AsyncStorage

### 5.2 方式 B：手动输入

在 QR Scanner 页面也支持手动输入，格式：

```
192.168.x.x:48911?name=角色名
```

### 5.3 方式 C：环境变量（CI / 固定环境）

创建 `.env` 文件在 RN 项目根目录：

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:48911
```

### 配置存储

连接配置通过 `AsyncStorage` 持久化，App 重启后不需要重新配置。

**配置查看/清除**：在 App 首页（Home tab）可以看到当前保存的配置信息。

---

## 6. 核心链路验证清单

连接成功后，切换到 **Main UI tab**，按以下顺序逐一验证：

### 第一轮：基础功能

```
□  1. Live2D 模型加载 — 主界面应显示 Live2D 角色
       如果模型未出现，检查:
       - 后端 /api/config/page_config 返回的 model_path 是否有效
       - 网络是否可达（模型文件从后端下载）
       - 控制台是否有 Live2D 相关错误日志

□  2. 聊天面板 — 点击聊天按钮（右侧工具栏），面板应展开
       - 能看到消息列表区域
       - 底部有文本输入框

□  3. 文本对话 — 在输入框输入文字发送
       - 消息出现在聊天列表
       - 收到 AI 回复（文本）
       - AI 回复同时有语音播放

□  4. Live2D 动画 — AI 回复时
       - 角色播放"开心"动作
       - 嘴型随语音同步
       - 回复结束后恢复中立状态
```

### 第二轮：语音功能

```
□  5. 麦克风权限 — 点击麦克风按钮
       - 系统弹出麦克风权限请求
       - 授权后录音指示器亮起

□  6. 语音输入 — 对着手机说话
       - 工具栏显示输入音量指示
       - WebSocket 发送 stream_data 消息

□  7. 语音回复 — AI 处理后
       - 收到文本回复 + 语音播放
       - 播放时嘴型同步

□  8. 打断测试 — AI 正在说话时开始说话
       - AI 语音应停止
       - Live2D 切换到倾听姿态
       - 等用户说完后 AI 重新回复
```

### 第三轮：稳定性

```
□  9. 断线恢复 — 临时关闭后端再重启
       - App 应尝试自动重连
       - 重连成功后功能恢复

□  10. 后台切换 — 切到其他 App 再回来
        - WebSocket 是否保持连接
        - 如断开是否自动重连

□  11. 长时间对话 — 连续对话 5+ 轮
        - 消息历史正确显示
        - 无内存泄漏迹象（App 不卡顿）
        - 音频播放持续正常
```

---

## 7. 开发优先级路线图

核心链路验证通过后，按以下优先级推进新功能：

### P0 — 真机体验打磨（最高优先级）

这些决定了 App 是否"能用"：

#### 7.1 音频延迟调优

**目标**：从说话到收到回复的端到端延迟可接受（< 3 秒体感）

**排查点**：
- PCM buffer 大小（影响录音延迟）
- WebSocket 消息序列化开销
- 后端 AI 处理延迟（不可控，但需知道基线）

**相关文件**：
- `services/AudioService.ts` — 录音配置
- `packages/project-neko-audio-service/src/native/audioServiceNative.ts` — 原生音频参数

#### 7.2 WebSocket 断线恢复

**目标**：手机切后台、切网络后能自动恢复

**排查点**：
- App 进后台时 WebSocket 是否被系统杀死
- 重连逻辑是否在 App 回前台时触发
- 重连后是否需要重新 `start_session`

**相关文件**：
- `services/wsService.ts` — 重连配置（当前：3s 间隔，5 次上限）
- `app/(tabs)/main.tsx` — 页面 focus 生命周期已有处理

#### 7.3 Live2D 模型下载与缓存

**目标**：首次加载模型后缓存到本地，后续秒开

**排查点**：
- 模型文件从 `http://后端/static/` 或 `/user_live2d/` 下载
- 本地缓存目录和策略
- 缓存失效机制

**相关文件**：
- `services/Live2DService.ts` — 模型下载管道
- `utils/live2dDownloader.ts` — 下载工具

#### 7.4 权限处理

**目标**：权限拒绝时有友好提示

**排查点**：
- 麦克风权限拒绝后的 UI 反馈
- 相机权限（QR 扫码页面）

**相关文件**：
- `utils/permissions.js` / `permissions.web.js`

---

### P1 — 缺失功能补全

#### 7.5 角色切换

**需求**：用户能浏览和切换 AI 角色

**后端支持**：
- `GET /api/characters/` — 角色列表
- `POST /api/characters/current_catgirl` — 切换当前角色
- `GET /api/characters/catgirl/{name}/voice_mode_status` — 语音可用性

**实现方案**：
1. 新建页面 `app/characters.tsx`
2. 调用角色列表 API 展示
3. 切换后重新建立 WebSocket 连接（URL 中角色名变化）

**工作量估算**：新建 1 个页面 + 1 个 hook

#### 7.6 纯文本对话模式

**需求**：不用麦克风，纯打字聊天

**现状**：
- WebSocket 协议已支持 `input_type: "text"`
- ChatContainer 已有文本输入
- `app/(tabs)/main.tsx` 中有 `textSessionManager` 相关逻辑

**排查**：验证 text session 的 start/send/end 流程在真机上工作

#### 7.7 相机/图片发送

**需求**：拍照或选图发给 AI

**实现步骤**：
1. 安装依赖：`npx expo install expo-image-picker`
2. 解除 `ChatContainer.native.tsx:289` 附近的注释代码
3. 处理图片 → Base64 编码 → WebSocket 或 REST 发送

---

### P2 — 体验增强

#### 7.8 后台音频播放

**需求**：AI 说话时切后台不中断

**方案**：配置 `expo-av` 或原生模块的后台音频能力

#### 7.9 深色模式

**现状**：框架已有（`hooks/use-color-scheme.ts`、`constants/theme.ts`）

**工作**：确保所有组件的样式跟随主题切换

#### 7.10 启动引导页

**需求**：首次使用时引导用户连接后端

**方案**：检测 AsyncStorage 无配置 → 自动跳转 QR Scanner

---

## 8. 常见问题排查

### 8.1 编译失败

**症状**：`npx expo run:android` 报错

**排查**：
```bash
# 检查 JDK 版本
java -version    # 需要 17

# 检查 Android SDK
echo $ANDROID_HOME
ls $ANDROID_HOME/platforms/    # 应有 android-34 或更高

# 清理重建
cd android && ./gradlew clean && cd ..
npx expo prebuild --clean
npx expo run:android
```

### 8.2 手机连不上后端

**排查步骤**：
1. 确认手机和电脑在同一 WiFi
2. 在手机浏览器访问 `http://电脑IP:48911/api/config/page_config`
3. 如果访问不了，检查电脑防火墙
4. 确认后端没绑定在 `127.0.0.1`（应该是 `0.0.0.0`）

### 8.3 Live2D 模型不显示

**排查步骤**：
1. 检查后端 `/api/config/page_config` 返回的 `model_path`
2. 在手机浏览器尝试访问 `http://电脑IP:48911/static/{model_path}/model3.json`
3. 检查 RN 控制台日志中 Live2DService 的错误输出
4. 确认 `react-native-live2d` submodule 已正确初始化

### 8.4 没有声音

**排查步骤**：
1. 检查手机音量（媒体音量，非铃声音量）
2. 检查 RN 控制台中 AudioService 的日志
3. 用 `app/audio-test.tsx` 或 `app/pcmstream-test.tsx` 测试页面独立验证
4. 确认 `react-native-pcm-stream` submodule 已正确初始化

### 8.5 Metro Bundler 连接问题

**症状**：设备上 App 白屏或 "Unable to load script"

```bash
# 确认 Metro 在运行
npx expo start --dev-client

# Android 端口转发（USB 连接时）
adb reverse tcp:8081 tcp:8081

# 或者指定 Metro 地址
npx expo start --dev-client --host lan
```

### 8.6 Submodule 问题

**症状**：`packages/react-native-live2d/` 或 `packages/react-native-pcm-stream/` 为空目录

```bash
git submodule update --init --recursive

# 如果还是空的，手动克隆
git submodule sync
git submodule update --force --recursive
```

---

## 9. 构建发布

### 9.1 本地 APK 构建

```bash
cd N.E.K.O.-RN

# Debug APK
cd android && ./gradlew assembleDebug && cd ..
# 输出: android/app/build/outputs/apk/debug/app-debug.apk

# Release APK（需要签名配置）
cd android && ./gradlew assembleRelease && cd ..
```

### 9.2 EAS Build（云端构建）

项目已配置 `eas.json`：

```bash
# 安装 EAS CLI
npm install -g eas-cli

# 登录 Expo 账号
eas login

# 云端构建 Android
eas build --platform android --profile preview

# 云端构建 iOS
eas build --platform ios --profile preview
```

### 9.3 发布到内测

```bash
# Android: 生成 AAB 上传 Google Play Console
eas build --platform android --profile production

# iOS: 上传到 TestFlight
eas build --platform ios --profile production
eas submit --platform ios
```

---

## 相关文档

- [RN 项目现状评估](./rn-current-status.md) — 功能完成度详表
- [跨项目集成架构](./cross-project-integration.md) — 两仓库协作机制
- [分支合并策略](./branch-merge-strategy.md) — react_rewrite_web 与 main 的合并规划
- [Android 平台运行指南](../platforms/android.md) — Android 环境详细配置
- [WebSocket 协议规范](../specs/websocket.md) — 消息格式定义
- [上游 packages 同步指南](../guides/upstream-sync.md) — 共享包同步流程
