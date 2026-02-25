# 快速开发流程

> 一次编译，日常热更新。改 TS/JS 代码保存即生效，无需重新构建 APK。

---

## 流程概览

```
首次 / 修改原生代码后：
  prebuild → gradlew assembleDebug → adb install   （约 5-10 分钟）

日常改 TS/JS：
  npm start → 手机扫码 → 保存即热更新              （秒级）
```

---

## 首次设置

### 1. 生成原生工程

```bash
npx expo prebuild --platform android --clean
npm install
```

### 2. 本地编译 APK

```bash
cd android
./gradlew assembleDebug
cd ..
```

APK 路径：`android/app/build/outputs/apk/debug/app-debug.apk`

### 3. 安装到手机

```bash
bash scripts/install-apk.sh
```

或直接用 adb：

```bash
adb install android/app/build/outputs/apk/debug/app-debug.apk
```

### 4. 启动开发服务器

```bash
npm start
```

手机打开 N.E.K.O. App，扫码连接，之后改代码保存自动热更新。

---

## 日常开发

```bash
npm start          # 启动开发服务器
# r  → 重载应用
# m  → 打开开发菜单
# j  → 打开调试器
```

---

## 何时需要重新编译 APK

| 需要重新编译 | 不需要 |
|-------------|--------|
| 修改 `android/` Kotlin 代码 | 修改 `app/`、`components/`、`hooks/` |
| 修改 `packages/react-native-*`（原生模块） | 修改 `packages/project-neko-*`（纯 JS 包） |
| `package.json` 新增原生依赖 | 修改 `services/`、`utils/`、样式文件 |
| 修改 `app.config.ts` | - |

重新编译：

```bash
cd android && ./gradlew assembleDebug && cd ..
bash scripts/install-apk.sh
```

---

## 常用命令速查

```bash
# 日常启动
npm start

# 清缓存启动
npx expo start --dev-client --clear

# 本地编译 APK
cd android && ./gradlew assembleDebug && cd ..

# 编译 + 安装
cd android && ./gradlew assembleDebug && cd .. && bash scripts/install-apk.sh

# 完整重建（清缓存 + 重编 + 装机，遇到奇怪问题用这个）
bash scripts/force-rebuild.sh

# 类型检查
npm run typecheck
```

---

## 故障排查

### 手机连不上开发服务器

1. 确保手机和电脑在同一 WiFi
2. 检查防火墙是否放通 8081 端口
3. 用 tunnel 模式：`npx expo start --dev-client --tunnel`

### 热更新不生效

1. 按 `r` 手动重载
2. 清缓存：`npx expo start --dev-client --clear`

### Gradle 编译报错

先检查 JDK 版本（必须是 17）：

```bash
java -version
```

再检查 Android SDK 环境变量：

```bash
echo $ANDROID_SDK_ROOT   # 应输出 /Users/你的用户名/Library/Android/sdk
```

如果环境变量没有，参考 [android-env-macos.md](./android-env-macos.md) 配置。

---

**最后更新**：2026-02-24
