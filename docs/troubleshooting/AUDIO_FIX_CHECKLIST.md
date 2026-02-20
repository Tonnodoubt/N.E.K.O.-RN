# Android 录音修复检查清单 ✅

使用此清单验证修复是否完整实施。

## 代码修改 ✅

- [x] **PCMStreamModule.kt** - 添加权限检查和错误处理
  - [x] 添加 `Manifest.permission.RECORD_AUDIO` 导入
  - [x] 添加 `ContextCompat` 导入
  - [x] 在 `startRecording()` 中检查权限
  - [x] 检查 `bufferSize` 有效性
  - [x] 检查 `AudioRecord.STATE_INITIALIZED`
  - [x] 添加 try-catch 包裹 `startRecording()`
  - [x] 通过 `onError` 事件发送错误

- [x] **audioServiceNative.ts** - 改进错误处理
  - [x] 添加 `errorSub` 监听器
  - [x] 添加 `recordingReject` 错误拒绝器
  - [x] 在 `attachRecordingListeners()` 中监听 `onError`
  - [x] 在 `detachRecordingListeners()` 中清理 `errorSub`
  - [x] 将 `startVoiceSession` 改为 Promise 模式
  - [x] 添加超时和清理逻辑

- [x] **permissions.js** - 增强权限请求
  - [x] 添加友好对话框文本
  - [x] 处理 `NEVER_ASK_AGAIN` 情况
  - [x] 添加跳转设置的选项
  - [x] 添加日志输出

- [x] **app/_layout.tsx** - 添加诊断路由
  - [x] 添加 `audio-debug` 路由

## 新增文件 ✅

- [x] **utils/audioDiagnostics.ts** - 诊断函数
  - [x] `runAudioDiagnostics()` - 完整诊断
  - [x] `isAudioAvailable()` - 快速检查
  - [x] 测试多种采样率
  - [x] 生成详细报告

- [x] **utils/audioPermissionManager.ts** - 权限管理
  - [x] `checkMicrophonePermission()` - 检查权限
  - [x] `requestMicrophonePermission()` - 请求权限
  - [x] `ensureMicrophonePermission()` - 确保权限（带重试）
  - [x] `openAppSettings()` - 打开设置

- [x] **app/audio-debug.tsx** - 诊断页面
  - [x] 可视化诊断界面
  - [x] 运行诊断按钮
  - [x] 快速检查按钮
  - [x] 显示结果和错误信息
  - [x] 提供解决方案提示

- [x] **scripts/test-audio-recording.sh** - 测试脚本
  - [x] 检查设备连接
  - [x] 显示设备信息
  - [x] 检查应用安装状态
  - [x] 检查权限状态
  - [x] 实时日志监控

- [x] **docs/troubleshooting/android-audio-recording-fix.md** - 详细文档
  - [x] 问题描述
  - [x] 根本原因分析
  - [x] 修复内容说明
  - [x] 测试步骤
  - [x] 常见问题解答

- [x] **docs/troubleshooting/AUDIO_FIX_SUMMARY.md** - 总结文档
  - [x] 问题总结
  - [x] 解决方案概览
  - [x] 测试方法
  - [x] 相关文件列表

## 测试验证 ⏳

### 编译测试
- [ ] 运行 `npx expo run:android` 无错误
- [ ] APK 成功安装到设备
- [ ] 应用可正常启动

### 诊断测试
- [ ] 可访问 `/audio-debug` 页面
- [ ] "快速检查" 功能正常
- [ ] "运行完整诊断" 功能正常
- [ ] 诊断结果显示正确

### 权限测试
- [ ] 首次使用语音功能时弹出权限请求
- [ ] 授予权限后语音功能可用
- [ ] 拒绝权限时显示友好提示
- [ ] "不再询问" 时提供跳转设置选项

### 功能测试
- [ ] 文本对话正常工作
- [ ] 语音对话开始时无崩溃
- [ ] 录音正常启动（查看日志）
- [ ] 可正常发送语音
- [ ] 可正常接收语音

### 日志验证
- [ ] 运行 `adb logcat | grep PCMStream`
- [ ] 成功时看到 "✅ 录音已启动"
- [ ] 失败时看到明确的错误信息

## 文档完整性 ✅

- [x] 代码注释清晰
- [x] 函数有 JSDoc/TSDoc 注释
- [x] 诊断页面有使用说明
- [x] 测试脚本有执行说明
- [x] 故障排查文档完整

## 向后兼容性 ✅

- [x] 旧版 `requestMicrophonePermission()` 仍可用
- [x] 新增功能为可选，不影响现有代码
- [x] iOS 平台不受影响

## 性能影响 ✅

- [x] 诊断工具仅在开发/调试时使用
- [x] 权限检查不会显著影响启动时间
- [x] 错误处理不会影响正常流程性能

---

## 最终检查

完成所有项目后，执行以下验证：

```bash
# 1. 编译
npx expo run:android

# 2. 运行测试脚本
./scripts/test-audio-recording.sh

# 3. 在另一个终端监控日志
adb logcat -c && adb logcat | grep PCMStream

# 4. 在应用中：
#    - 访问 /audio-debug 页面
#    - 运行完整诊断
#    - 测试语音功能
```

## 签署确认

开发者: _______________
日期: _______________
测试设备: _______________
Android 版本: _______________
测试结果: [ ] 通过  [ ] 失败
问题说明: _______________
