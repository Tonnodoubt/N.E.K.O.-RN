# Android 录音失败问题修复指南

## 问题描述

APK 安装到手机后，文本对话正常，但语音对话失败。错误信息：

```
❌ 开始录音失败: [Error: Call to function 'PCMStream.startRecording' has been rejected.
→ Caused by: java.lang.IllegalStateException: startRecording() called on an uninitialized AudioRecord.]
```

## 根本原因

`AudioRecord` 对象初始化失败，可能原因：

1. **缺少运行时权限** - Android 6.0+ 需要在运行时请求 `RECORD_AUDIO` 权限
2. **采样率不支持** - 某些设备不支持 48kHz 录音
3. **音频资源冲突** - 其他应用占用了麦克风
4. **原生代码缺少错误处理** - 没有检查 `AudioRecord` 初始化状态

## 已实施的修复

### 1. 原生层增强 (PCMStreamModule.kt)

**文件**: `packages/react-native-pcm-stream/android/src/main/java/expo/modules/pcmstream/PCMStreamModule.kt`

**修改内容**:

- ✅ 添加权限检查（在原生层二次确认）
- ✅ 检查 `bufferSize` 有效性
- ✅ 检查 `AudioRecord` 初始化状态 (`STATE_INITIALIZED`)
- ✅ 添加 try-catch 错误处理
- ✅ 通过 `onError` 事件发送详细错误信息

**关键代码片段**:

```kotlin
// 检查权限
val permissionCheck = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO)
if (permissionCheck != PackageManager.PERMISSION_GRANTED) {
    sendEvent("onError", mapOf(
        "message" to "RECORD_AUDIO permission not granted...",
        "state" to "ERROR"
    ))
    return
}

// 检查 AudioRecord 状态
if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
    sendEvent("onError", mapOf(
        "message" to "AudioRecord initialization failed...",
        "state" to "ERROR"
    ))
    return
}

// 安全启动录音
try {
    audioRecord?.startRecording()
} catch (e: Exception) {
    sendEvent("onError", mapOf(
        "message" to "Failed to start recording: ${e.message}",
        "state" to "ERROR"
    ))
    return
}
```

### 2. JS 层错误处理 (audioServiceNative.ts)

**文件**: `packages/project-neko-audio-service/src/native/audioServiceNative.ts`

**修改内容**:

- ✅ 监听原生 `onError` 事件
- ✅ 将原生错误转换为 Promise rejection
- ✅ 改进 `startVoiceSession` 的错误传播
- ✅ 添加超时和清理逻辑

**关键代码片段**:

```typescript
// 监听原生错误
errorSub = PCMStream.addListener("onError", (event: any) => {
  const message = event?.message || "Unknown native error";
  if (recordingReject) {
    const reject = recordingReject;
    recordingReject = null;
    reject(new Error(message));
  }
});

// Promise 化启动流程
return new Promise<void>((resolve, reject) => {
  recordingReject = reject;
  // ... 启动逻辑
});
```

### 3. 诊断工具

创建了两个诊断文件来帮助调试：

#### 3.1 诊断函数 (`utils/audioDiagnostics.ts`)

**功能**:
- ✅ 检查平台和权限状态
- ✅ 测试多种采样率 (8kHz, 16kHz, 22.05kHz, 44.1kHz, 48kHz)
- ✅ 生成详细诊断报告
- ✅ 提供快速可用性检查

**使用方法**:

```typescript
import { runAudioDiagnostics, isAudioAvailable } from '@/utils/audioDiagnostics';

// 完整诊断
const result = await runAudioDiagnostics();
console.log('支持采样率:', result.supportedSampleRates);

// 快速检查
const available = await isAudioAvailable();
```

#### 3.2 诊断页面 (`app/audio-debug.tsx`)

**访问路径**: 导航到 `/audio-debug`

**功能**:
- ✅ 可视化诊断界面
- ✅ 一键运行完整诊断
- ✅ 显示权限、采样率、错误信息
- ✅ 提供常见问题解决方案

## 测试步骤

### 1. 重新编译 APK

```bash
cd /Users/tongqianqiu/N.E.K.O.-RN
npx expo run:android
```

### 2. 运行诊断

1. 打开应用
2. 导航到 `/audio-debug` 页面
3. 点击"运行完整诊断"
4. 查看结果

### 3. 检查权限

如果权限未授予：

1. 前往 **设置 → 应用 → N.E.K.O. → 权限**
2. 授予"麦克风"权限
3. 重新打开应用

### 4. 查看日志

使用 adb 查看详细日志：

```bash
adb logcat | grep PCMStream
```

应该看到类似输出：

```
✅ 录音已启动 (sampleRate=48000, targetRate=16000)
```

或错误信息：

```
❌ AudioRecord 初始化失败 (state=1)
❌ 麦克风权限未授予
```

## 预期行为

### 成功场景

```
🔬 开始音频诊断...
📋 麦克风权限状态: 已授予 ✅
🎼 测试支持的采样率...
  测试 8000Hz...
  ✅ 8000Hz 支持
  ...
📊 诊断结果:
  平台: android
  权限: 已授予 ✅
  可初始化: 是 ✅
  支持的采样率: 8000, 16000, 44100, 48000 Hz
```

### 失败场景

**权限未授予**:
```
📋 麦克风权限状态: 未授予 ❌
🔐 尝试请求麦克风权限...
❌ 权限被拒绝
```

**初始化失败**:
```
📋 麦克风权限状态: 已授予 ✅
🔴 原生错误: AudioRecord initialization failed
❌ 48000Hz 不支持: AudioRecord initialization failed
```

## 常见问题排查

### Q1: 权限已授予但仍然失败

**可能原因**:
- 其他应用占用麦克风
- 设备不支持 48kHz 采样率

**解决方案**:
- 运行诊断查看支持的采样率
- 重启应用
- 重启手机

### Q2: 诊断显示无支持的采样率

**可能原因**:
- 权限实际未生效（Android 偶发问题）
- 驱动问题

**解决方案**:
- 卸载重装应用
- 检查系统更新
- 尝试其他录音应用验证硬件

### Q3: 文本对话正常但语音失败

**原因**: 文本模式不使用麦克风，只有语音模式需要 `RECORD_AUDIO` 权限

**解决方案**: 运行诊断页面检查麦克风权限和功能

## 后续优化建议

1. **自动降级** - 如果 48kHz 失败，自动尝试 44.1kHz → 16kHz
2. **友好提示** - 在 UI 显示权限请求对话框，引导用户到设置
3. **设备兼容性数据库** - 收集不同设备的采样率支持情况
4. **音频焦点管理** - 正确处理音频焦点，避免冲突

## 相关文件

- `packages/react-native-pcm-stream/android/src/main/java/expo/modules/pcmstream/PCMStreamModule.kt` - 原生录音模块
- `packages/project-neko-audio-service/src/native/audioServiceNative.ts` - JS 录音服务
- `utils/audioDiagnostics.ts` - 诊断工具
- `app/audio-debug.tsx` - 诊断页面
- `utils/permissions.js` - 权限请求工具

## 联系支持

如果问题持续存在，请提供以下信息：

1. 诊断页面截图
2. `adb logcat | grep PCMStream` 输出
3. 设备型号和 Android 版本
4. 是否有其他录音应用可正常工作
