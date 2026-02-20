# Android 录音问题修复总结

## 问题

**症状**: APK 安装后，文本对话正常，但语音对话失败

**错误**:
```
java.lang.IllegalStateException: startRecording() called on an uninitialized AudioRecord.
```

## 解决方案

### 1. 原生层修复 ✅

**文件**: `packages/react-native-pcm-stream/android/src/main/java/expo/modules/pcmstream/PCMStreamModule.kt`

**修改**:
- 添加权限检查
- 检查 AudioRecord 初始化状态
- 添加错误处理和事件发送
- 防止在未初始化时调用 startRecording()

### 2. JS 层增强 ✅

**文件**: `packages/project-neko-audio-service/src/native/audioServiceNative.ts`

**修改**:
- 监听原生 onError 事件
- 将错误转换为 Promise rejection
- 改进错误传播和用户提示

### 3. 诊断工具 ✅

**新增文件**:
- `utils/audioDiagnostics.ts` - 诊断函数库
- `app/audio-debug.tsx` - 可视化诊断页面
- `utils/audioPermissionManager.ts` - 权限管理工具
- `scripts/test-audio-recording.sh` - 命令行测试脚本

### 4. 权限处理增强 ✅

**文件**: `utils/permissions.js`

**修改**:
- 添加友好的权限请求对话框
- 处理"不再询问"情况
- 提供跳转到设置的选项

## 测试步骤

### 方法 1: 使用诊断页面

```bash
# 1. 重新编译
npx expo run:android

# 2. 打开应用，导航到 /audio-debug 页面
# 3. 点击"运行完整诊断"
# 4. 查看结果
```

### 方法 2: 使用测试脚本

```bash
# 1. 连接 Android 设备
# 2. 运行测试脚本
./scripts/test-audio-recording.sh

# 3. 在应用中测试语音功能
# 4. 观察脚本输出的日志
```

### 方法 3: 手动测试

```bash
# 1. 编译并安装
npx expo run:android

# 2. 查看日志
adb logcat -c
adb logcat | grep PCMStream

# 3. 在应用中点击语音按钮
# 4. 观察日志输出
```

## 预期日志输出

### 成功 ✅

```
✅ 录音已启动 (sampleRate=48000, targetRate=16000)
```

### 失败 ❌

```
❌ 麦克风权限未授予
# 或
❌ AudioRecord 初始化失败 (state=1)
# 或
❌ 无法获取有效的缓冲区大小 (sampleRate=48000)
```

## 常见问题

### Q: 权限已授予但仍失败？

**A**:
1. 运行诊断页面查看支持的采样率
2. 重启应用
3. 重启手机
4. 检查是否有其他应用占用麦克风

### Q: 如何手动授予权限？

**A**:
```bash
# 方法 1: 使用 adb
adb shell pm grant com.tiyuchong.nekorn android.permission.RECORD_AUDIO

# 方法 2: 系统设置
设置 → 应用 → N.E.K.O. → 权限 → 麦克风
```

### Q: 如何访问诊断页面？

**A**: 在应用中导航到 `/audio-debug` 路由

## 后续改进

- [ ] 自动降级到支持的采样率
- [ ] 添加音频焦点管理
- [ ] 收集设备兼容性数据
- [ ] 添加更多诊断指标

## 相关文件

### 修改的文件
- `packages/react-native-pcm-stream/android/src/main/java/expo/modules/pcmstream/PCMStreamModule.kt`
- `packages/project-neko-audio-service/src/native/audioServiceNative.ts`
- `utils/permissions.js`
- `app/_layout.tsx`

### 新增的文件
- `utils/audioDiagnostics.ts`
- `utils/audioPermissionManager.ts`
- `app/audio-debug.tsx`
- `scripts/test-audio-recording.sh`
- `docs/troubleshooting/android-audio-recording-fix.md`

## 联系支持

如问题持续，请提供：

1. 诊断页面截图
2. `adb logcat | grep PCMStream` 输出
3. 设备型号和 Android 版本
4. 其他录音应用是否正常工作
