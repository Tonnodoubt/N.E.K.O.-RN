---
description: 编译 Android debug APK，使用 Gradle 本地构建，不启动模拟器
allowed-tools: Read, Bash, Glob
---

# /build-debug-apk — 编译 Debug APK

使用 Gradle 本地编译 Android debug APK。

## 执行流程

### 1. 检查项目配置

确认以下文件存在：
- `android/gradlew` — Gradle wrapper
- `android/app/build.gradle` — 应用构建配置
- `eas.json` — EAS 配置（可选）

### 2. 执行编译

```bash
cd android && ./gradlew assembleDebug --no-daemon
```

### 3. 验证输出

检查 APK 文件是否生成：
- 标准路径：`android/app/build/outputs/apk/debug/app-debug.apk`

### 4. 输出结果

显示：
- APK 文件路径
- 文件大小
- 安装命令示例

## 输出格式

```
✅ Debug APK 编译成功！

路径：android/app/build/outputs/apk/debug/app-debug.apk
大小：XXX MB

安装到设备：
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## 注意事项

- 首次编译可能需要下载依赖，耗时较长
- 确保已安装 Android SDK 和 Gradle
- 如需清理后重新编译，使用 `./gradlew clean` 后再 assembleDebug
