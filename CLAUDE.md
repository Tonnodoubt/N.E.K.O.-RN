# N.E.K.O.-RN

## Build

```bash
# 编译 debug APK（唯一方式，不要用 expo run:android）
cd android && ./gradlew assembleDebug
```

APK 输出：`android/app/build/outputs/apk/debug/app-debug.apk`

## 项目结构

- `app/` — Expo Router 页面
- `components/` — 通用 UI 组件
- `services/` — 业务服务层
- `hooks/` — React hooks
- `packages/` — 原生模块（react-native-pcm-stream, react-native-live2d 等）
- `android/` — Android 原生工程
- `i18n/` — 国际化

## 关键约定

- 嘴形同步：JS 层做平滑（LipSyncService），Kotlin 层做时间对齐（PCMStreamPlayer 按 playbackHeadPosition 取振幅）
- 修改 Kotlin 原生代码后需要 `./gradlew assembleDebug` 重新编译，Metro 热更新不生效
