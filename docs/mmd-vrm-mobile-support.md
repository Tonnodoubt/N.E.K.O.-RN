# MMD/VRM 模型手机端支持方案

**日期：** 2026-05-13（2026-05-14 修订）
**状态：** 调研完成，待 Phase 0 技术验证
**相关项目：** N.E.K.O.-RN (手机端) / N.E.K.O.TONG (主项目)

> **修订说明（2026-05-14）：** 对照仓库实际状态后做了以下校正：
> 1. 修正"主项目已有此方向"对 `app/vrm-poc.tsx` 的误读 —— 该文件目前只是 page_config 预检页，未做任何 R3F 渲染，R3F/three/expo-gl 等依赖在 `package.json` 里**尚未安装**。
> 2. 增补方案 D（react-native-filament）作为 R3F Hard Fail 后的备选路线。
> 3. 重写 Phase 0 通过标准（对齐 `docs/arch/mobile-vrm-r3f-poc.md` 的 Q1~Q4），不再用"FPS/内存/触摸"这种模糊提法。
> 4. 重估 bundle 体积（500KB → 700KB~1MB gzip，含 loader 和 MToon shader 必要模块）。
> 5. 风险评估表降低"主项目代码复用"权重 —— 主项目 `.js` 文件高度依赖 `window.*` 全局和浏览器 import map，应预算为"参考逻辑后重写"而非"TypeScript 化"。

---

## 目录

1. [背景](#1-背景)
2. [主项目 MMD/VRM 架构分析](#2-主项目-mmdvrm-架构分析)
3. [手机端现有 Live2D 架构](#3-手机端现有-live2d-架构)
4. [可行方案对比](#4-可行方案对比)
5. [推荐方案：R3F + expo-gl](#5-推荐方案r3f--expo-gl)
6. [架构设计](#6-架构设计)
7. [实施计划](#7-实施计划)
8. [文件清单](#8-文件清单)
9. [风险评估](#9-风险评估)
10. [后端 API 现状](#10-后端-api-现状)

---

## 1. 背景

### 1.1 当前状况

| | 主项目 (N.E.K.O.TONG) | 手机端 (N.E.K.O.-RN) |
|---|---|---|
| **平台** | Web (Python FastAPI + 浏览器前端) | iOS + Android (React Native / Expo) |
| **支持格式** | Live2D / VRM / MMD | **仅 Live2D** |
| **渲染引擎** | three.js (WebGL) | Cubism SDK native `.aar` (OpenGL ES) |
| **口型同步** | Web Audio API `AnalyserNode` FFT | `PCMStream` 振幅事件 |

### 1.2 目标

让手机端 N.E.K.O.-RN 支持 MMD 和 VRM 模型加载、渲染、动画和口型同步，与现有 Live2D 并存。

---

## 2. 主项目 MMD/VRM 架构分析

### 2.1 文件结构

主项目目录：`<N.E.K.O.TONG_ROOT>/`

```text
N.E.K.O.TONG/
├── static/
│   ├── libs/                          # 三方库
│   │   ├── three.module.js            # three.js 自定义构建
│   │   ├── three-vrm.module.min.js    # @pixiv/three-vrm
│   │   ├── three-vrm-animation.module.js
│   │   ├── three-mmd.module.js        # @moeru/three-mmd
│   │   ├── three-mmd-physics-ammo.module.js
│   │   └── ammojs-typed.module.js     # Ammo.js WASM
│   │
│   ├── mmd-init.js                    # MMD 模块动态加载器
│   ├── mmd-core.js                    # three.js Scene/Renderer/Camera + MMDLoader
│   ├── mmd-manager.js                 # MMDManager 总控类
│   ├── mmd-animation.js              # VMD 动画：双槽 crossfade、IK/Grant、LipSync
│   ├── mmd-expression.js             # Morph 表情映射
│   ├── mmd-interaction.js            # Raycasting 点击/拖动
│   ├── mmd-cursor-follow.js          # 头部视线跟踪
│   ├── mmd-ui-buttons.js
│   ├── mmd-ui-debug.js
│   │
│   ├── vrm-init.js                    # VRM 模块动态加载器
│   ├── vrm-core.js                    # three.js Scene + GLTFLoader + VRMLoaderPlugin
│   ├── vrm-manager.js                 # VRMManager 总控类
│   ├── vrm-animation.js              # VRMA 动画 + LipSync
│   ├── vrm-expression.js             # BlendShape 表情映射
│   ├── vrm-interaction.js            # Raycasting 交互
│   ├── vrm-cursor-follow.js          # 视线跟踪
│   ├── vrm-orientation.js            # 模型朝向
│   └── vrm-ui-buttons.js
│
├── main_routers/
│   ├── mmd_router.py                  # /api/model/mmd/* 上传/列表/删除
│   └── vrm_router.py                  # /api/model/vrm/* 上传/列表/删除
│
├── frontend/react-neko-chat/          # React 聊天前端
│   └── src/App.tsx                    # 通过 window.mmdManager/vrmManager 控制模型
│
└── templates/index.html               # import map 加载所有模块
```

### 2.2 MMD 和 VRM 各自的技术栈

| | MMD | VRM |
|---|---|---|
| **模型格式** | PMX / PMD | VRM 0.x / 1.0 (基于 glTF) |
| **加载器** | `@moeru/three-mmd` `MMDLoader` | `@pixiv/three-vrm` `VRMLoaderPlugin` + `GLTFLoader` |
| **动画格式** | VMD | VRMA |
| **表情系统** | Morph targets (あ/い/う/え/お 等) | Blend shape clips (预设表情 + viseme) |
| **物理** | Ammo.js 刚体物理 (头发/布料) | 无 (VRM 使用 SpringBone) |
| **视觉特效** | `OutlineEffect` 赛璐璐描边 | MToon 材质 |
| **IK 解算** | `CCDIKSolver` | 内置于 VRM 规范 |
| **材质** | 标准 MeshPhong/Toon 材质 | MToon (PBR-based) |

### 2.3 MMD 模型加载流程

```text
用户选择模型
  ↓
MMDLoadingOverlay 显示阶段进度 (engine → settings → model → physics → idle → done)
  ↓
MMDCore.loadModel(url)
  ↓
MMDLoader.load(pmxUrl, onLoad, onProgress, onError)
  ↓
返回 { mesh, iks, grants, physics }
  ↓
添加到 scene → 材质后处理 → 物理初始化 (Ammo.js) → 加载待机 VMD
```

### 2.4 VRM 模型加载流程

```text
用户选择模型
  ↓
VRMCore.loadModel(url)
  ↓
GLTFLoader + VRMLoaderPlugin 注册为 glTF 解析插件
  ↓
解析完成，检测 glTF extensions：VRMC_vrm (1.0) / VRM (0.x)
  ↓
VRM 0.x: 调用 VRMUtils.rotateVRM0() 修正朝向
  ↓
初始化表达式管理器 + lookAt 约束
```

### 2.5 LipSync (口型同步)

**分析流水线（MMD 和 VRM 共用）：**

```text
AudioContext.createAnalyser()
  fftSize = 256
  smoothingTimeConstant = 0.8
  ↓
getLipSyncValue(): ByteFrequencyData → 语音频段能量 (85Hz~6500Hz) → 归一化 0~1
  ↓
┌─ MMD: 映射到 morph targets (あ/い/う/え/お)
└─ VRM: 映射到 viseme blend shapes (aa/ih/ou/ee/oh)
```

### 2.6 关键设计特点

- **完全独立的双引擎架构**：MMD 和 VRM 各有自己的 Scene/Renderer/Camera/Canvas，代码零耦合
- **Import Map 加载**：使用浏览器原生 ES module import map，无打包工具
- **动态 script 注入**：子模块通过 `mmd-init.js`/`vrm-init.js` 动态创建 `<script>` 标签加载
- **全局单例**：`window.mmdManager`、`window.vrmManager` 暴露给聊天前端

---

## 3. 手机端现有 Live2D 架构

### 3.1 三层架构

```text
┌─────────────────────────────────────────────────┐
│  App Layer (React)                               │
│  main.tsx → useLive2D() → Live2DStage.tsx       │
├─────────────────────────────────────────────────┤
│  Service Layer (TypeScript)                      │
│  services/Live2DService.ts                       │
│  - 模型下载 (expo-file-system)                   │
│  - 路径缓存                                      │
│  - 状态聚合 (ViewProps)                          │
├─────────────────────────────────────────────────┤
│  Cross-Platform Core                             │
│  packages/project-neko-live2d-service/           │
│  - service.ts: createLive2DService() 状态机      │
│  - types.ts: Live2DAdapter 接口                  │
│  - manager.ts: createLive2DManager()             │
├─────────────────────────────────────────────────┤
│  Native Package                                  │
│  packages/react-native-live2d/                   │
│  - Android: GLSurfaceView + Cubism SDK .aar      │
│  - iOS: Cubism Core native                       │
└─────────────────────────────────────────────────┘
```

### 3.2 关键文件

| 文件 | 作用 |
|------|------|
| `components/Live2DStage.tsx` | GestureDetector 手势 + 原生 View |
| `services/Live2DService.ts` | RN 适配器：下载模型 + 调用核心状态机 |
| `hooks/useLive2D.ts` | React hook：管理 Live2DService 生命周期 |
| `packages/project-neko-live2d-service/src/service.ts` | 跨平台状态机：idle→loading→ready |
| `packages/react-native-live2d/.../ReactNativeLive2dView.kt` | Android GLSurfaceView + Cubism SDK |
| `utils/live2dDownloader.ts` | 下载 model3.json + moc3/textures/motions |
| `services/LipSyncService.ts` | 振幅→口型值→`ReactNativeLive2dModule.setMouthValue()` |

### 3.3 LipSync 数据流

```text
PCMStream 'onAmplitudeUpdate'
  ↓
LipSyncService.handleAmplitudeUpdate()
  noise gate (0.008) → curve (^0.55) → attack (25ms) / release (90ms)
  ↓
ReactNativeLive2dModule.setMouthValue(value)  ← 直接原生调用，跳过 React render
```

---

## 4. 可行方案对比

### 方案 A：expo-gl + React Three Fiber (R3F) ✅ 推荐

| 优点 | 缺点 |
|------|------|
| expo-gl 社区最成熟的 RN 3D 方案 | three.js bundle 增大约 500KB (gzip ~150KB) |
| R3F 封装了 GL context、渲染循环、生命周期 | 部分 WebGL 扩展在移动端可能不支持 |
| 可直接复用主项目的 MMD/VRM 加载逻辑 | 真机性能需要实际验证 |
| 声明式 React API，与现有代码风格一致 | |
| iOS/Android 统一方案 | |

### 方案 B：WebView 嵌入

| 优点 | 缺点 |
|------|------|
| 实现最简单 | 性能不可控 |
| 可直接复用主项目全部代码 | 触摸事件穿透复杂 |
| | LipSync 通信延迟高 |
| | 无法与原生手势系统集成 |

### 方案 C：纯原生 OpenGL ES 实现

| 优点 | 缺点 |
|------|------|
| 性能最优 | 开发量巨大（需重写 PMX parser、VRM loader、物理引擎） |
| Bundle 体积小 | 代码复用率接近零 |
| | 不可接受的时间成本 |

### 方案 D：react-native-filament（备选）

> 2025 年起 Margelo 推出的 RN 3D 引擎，基于 Google Filament（PBR 渲染引擎），原生 C++ 实现，glTF 一等公民。

| 优点 | 缺点 |
|------|------|
| 性能远高于 expo-gl + three.js | 较新，社区案例少 |
| 原生 glTF / VRM 路径，无 GL bridge 开销 | VRM 扩展（MToon、SpringBone）需自己适配 |
| 不依赖 Hermes 对 three.js 的兼容性 | 与主项目 three.js 代码完全不可复用，需重写 |
| iOS / Android 一致 | 包体积净增约 8~12MB（含 .so） |

**定位：** 不是首选，但作为 **R3F Hard Fail 后的退路**。在 Phase 0 阶段应当并行做一次半天量级的可行性调研（确认 VRM 加载路径是否畅通），避免主路线失败后才开始找替代方案。

---

## 5. 推荐方案：R3F + expo-gl

### 5.1 核心依赖

| 包 | 用途 |
|---|------|
| `expo-gl` | 在 React Native 中创建 WebGL context |
| `three` | 3D 渲染引擎 |
| `@react-three/fiber/native` | three.js 的 React 渲染器，React Native 版本 |
| `@pixiv/three-vrm` | VRM 模型加载（glTF plugin） |
| `@moeru/three-mmd` | MMD 模型加载（后续 Phase 6） |

### 5.2 为什么选 R3F 而非 raw three.js

- **声明式**：`<Canvas>` 一行即可替代手动初始化 GL context + scene + camera + renderer + animation loop
- **生命周期安全**：组件卸载时自动 dispose GL 资源，避免内存泄漏
- **Suspense 支持**：模型异步加载与 React.Suspense 无缝集成
- **RN 社区默认选择**：当前 RN 上做 three.js 渲染的开源项目几乎都走这条路

> ⚠️ 早期版本曾把 `app/vrm-poc.tsx:207` 列为"主项目已有此方向"的证据，但该文件目前只是 page_config 预检页，第 207 行只是 UI 文案里的"下一步引入 `@react-three/fiber/native`"提示，并未实际 import。**该路线尚未被现有代码证实可行，结论待 Phase 0 真机验证。**

### 5.4 Bundle 体积重新估计

| 模块 | gzip 体积（实测量级） |
|------|----------------------|
| three.js 核心 | ~150 KB |
| three/examples（GLTFLoader、CCDIKSolver、OutlineEffect、MMDLoader 等） | ~200 KB |
| @pixiv/three-vrm（含 MToon、SpringBone） | ~100 KB |
| @react-three/fiber + reconciler | ~80 KB |
| **VRM 路径合计** | **≈ 500 KB gzip** |
| **MMD 路径再追加（含 Ammo.js WASM）** | **+400 KB～1 MB** |

按需动态 `import()` 可把首屏成本压到约 300 KB gzip，但实际首次加载体验下降仍需评估。原文档"~150 KB gzip"是只算 three.js 核心，未计 loader 与 VRM 扩展，应当修正。

### 5.3 与现有架构的关系

沿用 Live2D 的三层模式，新增并列的 MMD/VRM 管线：

```text
                          main.tsx
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         useLive2D()    useVRM()     useMMD() (后续)
              │              │              │
     Live2DService.ts  VRMService.ts  MMDService.ts
              │              │              │
  react-native-live2d   react-native-mmd-vrm (共用)
        (Cubism)        (expo-gl + three.js)
```

MMD 和 VRM 共用一个 native package，因为它们都通过 expo-gl 在 three.js 上运行。只有模型加载器和动画系统不同。

---

## 6. 架构设计

### 6.1 组件树

```tsx
// app/(tabs)/main.tsx
<View>
  <ModelStage modelType={modelType}>
    {/* modelType === 'live2d' → */}
    <Live2DStage props={live2dProps}>
      <ReactNativeLive2dView ... />
    </Live2DStage>

    {/* modelType === 'vrm' → */}
    <VRMStage>
      <Canvas>                           {/* R3F */}
        <ambientLight />
        <directionalLight />
        <Suspense fallback={<LoadingFallback />}>
          <VRMModel path={vrmPath} />    {/* @pixiv/three-vrm */}
        </Suspense>
      </Canvas>
    </VRMStage>
  </ModelStage>

  {/* 聊天 UI overlay (不变) */}
  <ChatContainer />
  <Live2DRightToolbar />
</View>
```

### 6.2 R3F 的 `<Canvas>` 替代原生 View

与 Live2D 不同，VRM/MMD 的渲染不需要自定义原生 View。R3F 的 `<Canvas>` 内部使用 expo-gl 创建 GL context，然后在其上运行 three.js。这意味着：

- 实际的渲染逻辑（scene、camera、模型、动画）全部在 JS 侧，由 Metro 打包
- `three.js`、`@pixiv/three-vrm` 是普通的 npm 依赖
- 不需要在 Kotlin/Swift 侧写渲染代码

### 6.3 手势处理

MMD/VRM 的手势与 Live2D 有所不同：

| 操作 | Live2D | MMD/VRM |
|------|--------|---------|
| 单指点击 | 触发 Cubism tap motion | Raycasting 检测 mesh → 播放互动动画 |
| 单指拖动 | 位移模型 | 平移/旋转模型 |
| 双指捏合 | 缩放 | 缩放 |
| 双指旋转 | 无 | Orbit 旋转相机 |

`VRMStage.tsx` 需要在 Canvas 上层处理手势，通过 R3F 的 `useThree()` 或 imperative ref 操作相机和模型。

### 6.4 LipSync 集成

```text
PCMStream 'onAmplitudeUpdate'
  ↓
LipSyncService.handleAmplitudeUpdate()
  noise gate → curve → attack/release
  ↓
  ├─ modelType === 'live2d' → ReactNativeLive2dModule.setMouthValue(value)
  └─ modelType === 'vrm'    → VRM blend shapes:
                               aa (张嘴)  = value * 0.8
                               ih (咧嘴)  = value * 0.3
                               ou (嘟嘴)  = value * 0.15
                               ee (微笑)  = value * 0.1
                               oh (圆嘴)  = value * 0.1
```

---

## 7. 实施计划

### Phase 0：技术验证（当前阶段）

**目标**：验证 expo-gl + R3F + @pixiv/three-vrm 在真机上可用。详细验证方案见 [`docs/arch/mobile-vrm-r3f-poc.md`](./arch/mobile-vrm-r3f-poc.md)。

**前置事实：** 目前仓库中相关依赖**全部未安装**，`app/vrm-poc.tsx` 仅为 page_config 预检页。Phase 0 实际上从零开始。

**Phase 0a：环境与依赖（0.5 天）**

1. 安装：`expo-gl`、`expo-asset`、`three`、`@react-three/fiber`、`@pixiv/three-vrm`
2. 验证 Hermes 下 `import * as THREE from 'three'` 能否正常起进程（最常见的早期阻塞点）
3. 验证 Metro 能否正确处理 `.vrm` / `.vrma` 作为 asset（可能需要在 `metro.config.js` 注册 `assetExts`）

**Phase 0b：四个关键问题（2~3 天）**

回答下列 4 个 Yes/No 问题，任一为 No 则进入"备选评估"流程：

| # | 问题 | 验证方式 |
|---|------|---------|
| Q1 | `@react-three/fiber/native` 的 `<Canvas>` 能否在真机稳定起屏？ | 最小场景：单色立方体旋转，Android + iOS 各跑 5 分钟 |
| Q2 | `.vrm` 能否被 `GLTFLoader.parse(ArrayBuffer)` + `VRMLoaderPlugin` 解析？ | 用 `expo-file-system` 读取本地 `.vrm` 转 ArrayBuffer 后 parse |
| Q3 | 加载后能否在 Android 真机上稳定显示（出图 + 纹理正常 + 朝向正确）？ | 不要求动画/表情/口型，只看视觉 |
| Q4 | 页面退出 / 重复加载 5 次后，GL 资源是否被正确释放？ | Android Studio Memory Profiler / Xcode Instruments 监控 |

**Phase 0c：性能与 shader 兼容性（1 天）**

文档原本"真机测试 FPS、内存、触摸事件"过于模糊，明确为：

1. Android 中端机（骁龙 7 系或同等）单角色 30FPS 以上、frame time < 33ms
2. MToon 材质能否在 expo-gl 的 GL ES 2.0 上下文上正确渲染（描边 / toon shading 不丢）
3. 连续切换角色 5 次，Java/JS 堆增长不超过 50MB

**通过标准（必须全部满足）**

- Q1~Q4 全部 Yes
- Phase 0c 三项达标
- iOS / Android 两端都过

**Soft Fail（可补救）**

- 模型朝向 / 缩放异常（可通过 `VRMUtils.rotateVRM0()` 或手动 transform 修正）
- 性能勉强达标但热加载缓慢
- 切换角色有少量残留（dispose 逻辑可优化）

**Hard Fail（停止 R3F 路线，转向方案 D Filament）**

- `<Canvas>` 无法稳定起屏
- `GLTFLoader.parse()` 在 RN 中解析 `.vrm` 失败
- 真机频繁崩溃 / GL context lost
- 资源释放明显失控（5 次切换后 OOM）

**Phase 0 并行任务：** Filament 路线的半天调研（验证 `react-native-filament` 是否能加载 `.vrm`、glTF 扩展兼容性、对 MToon 的支持情况），避免 R3F Hard Fail 后才开始找退路。

### Phase 1：Native 包 `react-native-mmd-vrm`

创建 `packages/react-native-mmd-vrm/`（骨架参照 `react-native-live2d`）：

```text
packages/react-native-mmd-vrm/
├── package.json
├── expo-module.config.json
├── src/
│   ├── index.ts
│   ├── ReactNativeMMDVRM.types.ts
│   ├── ReactNativeMMDVRMView.tsx
│   └── ReactNativeMMDVRMModule.ts
├── android/
│   └── src/main/java/expo/modules/mmdvrm/
│       ├── ReactNativeMMDVRMModule.kt
│       └── ReactNativeMMDVRMView.kt
└── ios/
    ├── ReactNativeMMDVRM.podspec
    ├── ReactNativeMMDVRMView.swift
    └── ReactNativeMMDVRMModule.swift
```

如果 R3F `<Canvas>` 直接可用，此包可极简化。

### Phase 2：VRM Service 层

创建 `services/VRMService.ts`（参照 `services/Live2DService.ts`）：

- `downloadVRMModel(modelName)` → expo-file-system 下载 `.vrm`
- `loadVRMModel(localPath)` → `@pixiv/three-vrm` 解析
- 状态机：`idle → loading → ready → error`

创建 `components/VRMStage.tsx`、`hooks/useVRM.ts`、`utils/vrmDownloader.ts`。

### Phase 3：动画和表情

从主项目 `.js` 文件迁移并 TypeScript 化：

| 主项目源 | 目标 |
|----------|------|
| `vrm-expression.js` | `packages/project-neko-mmd-vrm-service/src/vrm/expression.ts` |
| `vrm-animation.js` | `packages/project-neko-mmd-vrm-service/src/vrm/animation.ts` |
| `vrm-interaction.js` | `packages/project-neko-mmd-vrm-service/src/vrm/interaction.ts` |
| `vrm-cursor-follow.js` | `packages/project-neko-mmd-vrm-service/src/vrm/lookat.ts` |

### Phase 4：LipSync 集成

扩展 `services/LipSyncService.ts`——增加 VRM viseme blend shape 口型控制路径。

### Phase 5：模型路由和 UI 集成

修改 `app/(tabs)/main.tsx`：

- 读取 `pageConfig.model_type` 和 `live3d_sub_type`
- 根据类型选择 `useLive2D` 或 `useVRM`
- `ModelStage.tsx` 路由到正确的 Stage
- 角色切换时释放旧模型资源

### Phase 6：MMD 支持（后续）

等 VRM 链路完全跑通后：

- 引入 `@moeru/three-mmd`
- PMX/PMD 加载 + VMD 动画
- Ammo.js 物理（移动端可能禁用或降级）

---

## 8. 文件清单

### 新建文件

| 文件 | 用途 |
|------|------|
| `packages/react-native-mmd-vrm/` | Native package |
| `packages/project-neko-mmd-vrm-service/` | 跨平台核心 |
| `services/VRMService.ts` | RN 适配器 |
| `hooks/useVRM.ts` | VRM 生命周期 hook |
| `components/VRMStage.tsx` | R3F Canvas + VRM 渲染 + 手势 |
| `components/ModelStage.tsx` | 模型类型路由器 |
| `utils/vrmDownloader.ts` | .vrm / .vrma 下载 |

### 修改文件

| 文件 | 修改内容 |
|------|---------|
| `app/(tabs)/main.tsx` | model_type 路由 |
| `services/LipSyncService.ts` | VRM blend shape 口型 |
| `package.json` | 新增依赖 |

---

## 9. 风险评估

> 修订后整体风险水位上调一档。原表对"主项目代码复用"过于乐观，对 Hermes / expo-gl shader 兼容性过于轻描淡写。

| 风险 | 严重度 | 概率 | 缓解措施 |
|------|--------|------|---------|
| Hermes 下 three.js / @pixiv/three-vrm 兼容性问题（Function.prototype.toString、TypedArray、动态 shader 字符串拼接） | **高** | **中高** | Phase 0a 第一时间验证。**注意 RN 0.81 + Expo 54 切回 JSC 已非简单 flag，不能默认作为退路。** Hard Fail 时直接转方案 D |
| expo-gl 上 MToon / OutlineEffect 自定义 shader 不能正确渲染 | **高** | 中 | Phase 0c 单独验证。降级：去掉 MToon 改用普通 toon 材质（视觉风格会变） |
| expo-gl + R3F 真机性能不足（中端机 < 30FPS） | **高** | 中 | Phase 0c 跑通过门槛；降级路径：降低 pixelRatio、关闭抗锯齿；Hard Fail 时转方案 D |
| three.js + 扩展 bundle 体积膨胀（实测约 500KB gzip） | 中 | **高** | 按需动态 `import()`、VRM/MMD 分包、首屏只加载 Live2D |
| 主项目 `.js` 代码迁移成本被低估（依赖 `window.*` 全局、import map、动态 `<script>` 注入） | **中高** | **高** | 重新估时：按"参考逻辑后重写"而非"TypeScript 化"。`vrm-animation.js` / `vrm-expression.js` 这类预算翻倍 |
| iOS / Android expo-gl 行为差异（纹理格式、扩展支持） | 中 | 中 | Phase 0 双平台同时测；记录差异点 |
| 重复加载 / 角色切换后 GL 资源未释放（OOM） | 中 | 中 | Phase 0b Q4 必须通过；建立 dispose 检查 case |
| Ammo.js WASM 在移动端性能差 | 中 | 高 | MMD 阶段（Phase 6）直接禁用物理；只渲染骨骼动画 |
| PMX 纹理路径解析 / 编码问题 | 低 | 中 | 路径重写逻辑，复用主项目处理 |
| 动画循环与 React 渲染同步 | 低 | 低 | R3F 已处理；imperative ref 通信 |
| `react-native-filament` 备选路线本身的可行性未知 | 中 | 中 | Phase 0 并行做半天调研，不要等 R3F 失败才开始 |

---

## 10. 后端 API 现状

后端**已经支持** MMD/VRM 模型管理，手机端可直接复用：

### Page Config API

`services/api/pageConfig.ts`：
```typescript
interface PageConfigResponse {
  model_type: string;        // 'live2d' | 'live3d' | ...
  live3d_sub_type?: string;  // 'vrm' | ...
  model_path?: string;
  // ...
}
```

### Characters API

`services/api/characters.ts`：
```typescript
interface Character {
  model_type?: 'live2d' | 'vrm';
  vrm?: string;            // VRM 模型文件名
  vrm_animation?: string;  // VRMA 动画文件名
  // ...
}
```

### MMD/VRM API Routers (主项目)

| 路由 | 功能 |
|------|------|
| `/api/model/mmd/upload` | 上传 PMX/PMD + 纹理 ZIP |
| `/api/model/mmd/list` | 列出 MMD 模型 |
| `/api/model/mmd/delete` | 删除 MMD 模型 |
| `/api/model/mmd/emotion_mapping` | MMD 表情映射配置 |
| `/api/model/vrm/upload` | 上传 VRM 文件 |
| `/api/model/vrm/list` | 列出 VRM 模型 |
| `/api/model/vrm/delete` | 删除 VRM 模型 |
| `/api/model/vrm/emotion_mapping/{name}` | VRM 表情映射配置 |

这些 API 在手机端对接时可直接使用，无需后端改动。
