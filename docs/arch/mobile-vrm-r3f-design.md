# 移动端 VRM 接入设计（Phase 1: React Three Fiber）

> 目标：在 `N.E.K.O.-RN` 中为手机端引入 **可上线演进** 的 VRM 渲染能力。
>
> 本文档定义第一阶段方案：以 `@react-three/fiber/native` 为基础实现 `react-native-vrm` 包，并保持未来替换为真原生渲染器时的 JS 接口稳定。

---

## 1. 背景

当前仓库的角色渲染链路仍然以 Live2D 为中心：

- `app/(tabs)/main.tsx` 只拉取 `current_live2d_model`
- `hooks/useLive2D.ts` 和 `services/Live2DService.ts` 负责模型资源与状态
- `react-native-live2d` 负责最终渲染与口型同步

与此同时，桌面端 `N.E.K.O.TONG` 已经具备完整的 VRM 能力：

- 后端可返回 `page_config.model_type=live3d` 与 `live3d_sub_type=vrm`
- Web 前端已有 `three.js + @pixiv/three-vrm` 的完整加载、动画、表情与交互链路

因此，移动端首要问题不是“如何显示 3D”，而是：

1. 先把 RN 主页面从“只认 Live2D”升级为“按 avatar 类型分流”
2. 在不破坏当前 Live2D 体验的前提下，引入一套可持续演进的 VRM 宿主层

---

## 2. 设计目标

### 2.1 目标

1. 在 Android / iOS 真机上加载并显示 `.vrm` 模型
2. 与现有角色体系对齐，支持通过服务端角色配置切换 Live2D / VRM
3. 第一阶段就保留后续“替换内部渲染实现”的空间
4. 尽量复用桌面端现有 `three-vrm` 经验与资源格式
5. 保持与当前 `useLive2D` / `Live2DService` 相似的宿主调用方式
6. 为口型同步、动作、表情、拖拽缩放、角色切换预留统一接口

### 2.2 非目标

1. 第一阶段不追求与桌面端 VRM 功能 100% 对齐
2. 第一阶段不直接实现 Kotlin/Swift 版真原生 VRM 渲染器
3. 第一阶段不覆盖 MMD 渲染
4. 第一阶段不做 VRM 编辑器、材质调试器、物理调参 UI

---

## 3. 决策摘要

### 3.1 结论

第一阶段采用以下方案：

- 新增包：`packages/react-native-vrm/`
- 包的首个实现基于：
  - `@react-three/fiber/native`
  - `three`
  - `expo-gl`
  - `@pixiv/three-vrm`
- App 层新增 `VRMService` / `useVRM`
- 主页面引入 `AvatarRenderer` 分流，不再把角色显示写死为 Live2D

### 3.2 为什么不是“先上真原生模块”

直接做 Kotlin / Swift 版 `react-native-vrm` 的问题：

1. 工作量远大于 Live2D，因为不仅要渲染模型，还要补齐 GLTF/VRM 扩展、动画、表情、lookAt、spring bone、资源释放等能力
2. 当前桌面端 VRM 逻辑主要沉淀在 `three-vrm`，直接走真原生意味着大部分能力无法复用
3. 在 RN 端尚未完成 avatar 分流前，直接投入真原生渲染器会放大集成风险

### 3.3 为什么第一阶段选 React Three Fiber

1. 与桌面端 `three-vrm` 技术栈最接近，知识与逻辑可复用
2. 适合先打通“模型能显示、能切换、能说话”的 MVP
3. 未来可以在保持 `react-native-vrm` 包对外接口稳定的前提下，将内部实现替换为真原生渲染器

---

## 4. 总体架构

```mermaid
graph TD
    UI[UI 层: app/(tabs)/main.tsx] --> AR[AvatarRenderer 分流层]
    AR --> L2D[Live2D 分支]
    AR --> VRM[VRM 分支]

    L2D --> UL2D[useLive2D]
    UL2D --> SL2D[Live2DService]
    SL2D --> NL2D[react-native-live2d]

    VRM --> UVRM[useVRM]
    UVRM --> SVRM[VRMService]
    SVRM --> RNVRM[packages/react-native-vrm]
    RNVRM --> R3F[@react-three/fiber/native]
    R3F --> GL[expo-gl]
    RNVRM --> TVRM[@pixiv/three-vrm]

    Audio[PCM 音频振幅] --> Mouth[统一口型控制接口]
    Mouth --> NL2D
    Mouth --> RNVRM
```

核心原则：

- **分流发生在 App 层**，不是在某个渲染器内部偷偷判断
- **渲染实现细节封装在 package / service 内部**
- **口型同步、表情、动作等宿主语义尽量抽象成统一接口**

---

## 5. 宿主模型与类型设计

### 5.1 AvatarDescriptor

主页面不应再只维护 `live2dModel`，而应维护统一的 avatar 描述对象。

建议新增：

```ts
export type AvatarKind = 'live2d' | 'vrm';

export interface AvatarDescriptor {
  kind: AvatarKind;
  characterName: string;
  sourceUrl: string;
  itemId?: string;
  animationUrl?: string;
}
```

说明：

- `kind` 用于分流渲染器
- `sourceUrl` 对应模型地址
- `itemId` 作为可选缓存隔离键
- `animationUrl` 预留给 `.vrma`

### 5.2 PageConfig 优先于 current_live2d_model

移动端接入 VRM 后，主页面不能再只依赖 `GET /api/characters/current_live2d_model`。

建议将角色显示主入口切换为：

- `GET /api/config/page_config`

服务端已可返回：

- `model_type`
- `model_path`
- `live3d_sub_type`

RN 端映射规则：

- `model_type=live2d` -> `AvatarKind = live2d`
- `model_type=live3d && live3d_sub_type=vrm` -> `AvatarKind = vrm`
- `model_type=live3d && live3d_sub_type=mmd` -> 暂不支持，回退占位或错误提示

### 5.3 口型同步接口统一

当前 `LipSyncService` 直接写死依赖 `ReactNativeLive2dModule.setMouthValue()`，这会阻塞 VRM 接入。

建议新增统一接口：

```ts
export interface MouthSink {
  setMouthValue(value: number): void;
}
```

对应实现：

- Live2D: 内部调用 `ReactNativeLive2dModule.setMouthValue`
- VRM: 内部把值写到当前 VRM runtime 的口型目标

这样 `LipSyncService` 只关心“把振幅变成嘴巴开合值”，不关心当前渲染器是什么。

---

## 6. 包与文件边界

### 6.1 新增包

新增目录：

```text
packages/react-native-vrm/
├── package.json
├── tsconfig.json
└── src/
    ├── index.ts
    ├── ReactNativeVRMView.tsx
    ├── types.ts
    ├── loader/
    │   ├── loadVRM.ts
    │   └── loadVRMAnimation.ts
    ├── runtime/
    │   ├── VRMRuntime.ts
    │   └── VRMController.ts
    └── scene/
        ├── VRMCanvas.native.tsx
        ├── VRMModel.tsx
        └── DefaultLights.tsx
```

### 6.2 App 侧新增/修改文件

建议新增：

- `services/VRMService.ts`
- `hooks/useVRM.ts`
- `services/api/pageConfig.ts`
- `services/avatarTypes.ts`

建议修改：

- `app/(tabs)/main.tsx`
- `hooks/useLipSync.ts`
- `services/LipSyncService.ts`
- `metro.config.js`
- `package.json`

### 6.3 不立即修改的边界

以下链路第一阶段尽量不动：

- `react-native-live2d` 原生实现
- Live2D 下载与缓存逻辑
- 现有音频链路与 WebSocket 主流程

原则是先做“增量接入”，避免 VRM 方案回头牵连 Live2D 稳定性。

---

## 7. VRM 渲染方案细节

### 7.1 ReactNativeVRMView 的职责

`ReactNativeVRMView` 是包对外的唯一主要视图组件，负责：

1. 创建 `Canvas`
2. 绑定 runtime/controller
3. 处理 source 变化时的加载与清理
4. 暴露低频 props 与高频控制入口

建议 props：

```ts
export interface ReactNativeVRMViewProps {
  modelUri?: string;
  animationUri?: string;
  scale?: number;
  position?: { x: number; y: number };
  autoBlink?: boolean;
  onModelLoaded?: () => void;
  onError?: (error: unknown) => void;
  onTap?: () => void;
}
```

### 7.2 高频控制不走 React props

以下控制不建议通过 React state 每帧更新：

- 嘴巴开合
- 表情权重
- 视线跟随目标

原因：

1. 高频 props 更新会导致 React 渲染链路抖动
2. 与当前 Live2D “高频控制绕过 React” 的原则不一致

第一阶段建议做法：

- `react-native-vrm` 内部维护 `VRMController`
- `VRMService` 持有 controller 引用
- `setMouthValue()`、`setExpression()`、`playAnimation()` 等直接写 controller

### 7.3 模型加载策略

由于 RN / Expo 环境下 URL 解析、Metro 资源路径和 `GLTFLoader.load()` 的兼容性容易踩坑，第一阶段统一采用：

1. 先把 `.vrm` 下载到缓存目录
2. 通过 `fetch(fileUri)` 读取 `ArrayBuffer`
3. 用 `GLTFLoader.parse()` 解析二进制内容
4. 注册 `VRMLoaderPlugin`

统一规则：

- **首选 parse，不直接依赖 load(url)**
- 避免把 Loader 的远程路径解析行为暴露给 RN 宿主

### 7.4 动画加载策略

第一阶段将 `.vrma` 视为可选能力：

- 无动画时：播放基础 idle 姿态
- 有动画时：
  - 缓存 `.vrma`
  - 使用 `VRMAnimationLoaderPlugin`
  - 由 `AnimationMixer` 驱动

若动画链路阻塞整体接入，可拆为：

- Phase 1A: 只显示静态 VRM
- Phase 1B: 增加 `.vrma`

### 7.5 打光策略

第一阶段不追求桌面端全部灯光参数复现，采用固定默认灯光：

- `ambientLight`
- `directionalLight`
- 可选 `hemisphereLight`

后续再接入角色级 `lighting` 配置。

### 7.6 手势与坐标语义

RN 主页面已经有 Live2D 拖拽/缩放手势逻辑，VRM 第一阶段尽量复用同一套语义：

- `position.x / position.y` 使用归一化坐标
- `scale` 使用统一缩放值

这样可以：

1. 保持 UI 手势代码一致
2. 为后续抽象 `AvatarTransform` 打基础

---

## 8. Service / Hook 设计

### 8.1 VRMService

`VRMService` 的职责与 `Live2DService` 保持一致风格，但底层面向 VRM：

- 下载和缓存 `.vrm`
- 可选下载 `.vrma`
- 管理加载状态
- 维护 transform 状态
- 持有 `VRMController`
- 提供 `setMouthValue` / `setExpression` / `playAnimation`

建议状态：

```ts
interface VRMModelState {
  path?: string;
  animationPath?: string;
  isReady: boolean;
  isLoading: boolean;
  error?: string;
}
```

### 8.2 useVRM

`useVRM` 职责：

1. 管理 `VRMService` 生命周期
2. 将 service 状态桥接到 React
3. 聚合 `vrmProps`
4. 对外暴露控制方法

预期返回：

- `modelState`
- `transformState`
- `vrmProps`
- `loadModel()`
- `unloadModel()`
- `setModelScale()`
- `setModelPosition()`
- `setMouthValue()`
- `playAnimation()`

### 8.3 AvatarRenderer

在 `app/(tabs)/main.tsx` 内新增渲染分流层：

```tsx
if (avatar.kind === 'live2d') {
  return <ReactNativeLive2dView ... />;
}

if (avatar.kind === 'vrm') {
  return <ReactNativeVRMView ... />;
}
```

主页面逻辑不再直接操作 “某个具体模型”，而是操作 “当前 avatar”。

---

## 9. 与现有模块的集成策略

### 9.1 与 Main UI 的集成

主页面建议改动：

1. 将 `live2dModel` state 升级为 `avatarDescriptor`
2. 启动时优先请求 `page_config`
3. 根据 `avatar.kind` 选择 `useLive2D` 或 `useVRM`
4. 将现有手势控制从 `live2d.*` 抽象为当前 avatar 的 transform 控制

### 9.2 与 LipSync 的集成

现状问题：

- `LipSyncService` 直接依赖 Live2D module

建议改为：

1. `LipSyncService` 仅负责振幅到 `mouthValue` 的映射
2. 通过注入 `MouthSink` 输出嘴巴值
3. 页面在 avatar 切换时替换当前 `MouthSink`

### 9.3 与角色切换的集成

角色切换流程建议统一为：

```text
切换角色
 -> GET /api/config/page_config
 -> 构建 AvatarDescriptor
 -> 若 kind 变化，先卸载旧 renderer
 -> 再加载新 renderer
 -> 重建 MouthSink / 动画控制器绑定
```

### 9.4 与缓存的集成

缓存目录建议：

```text
{Paths.cache}/vrm/{cacheKey}/model.vrm
{Paths.cache}/vrm/{cacheKey}/idle.vrma
```

`cacheKey` 第一阶段建议使用：

- `itemId` 存在时用 `itemId`
- 否则用 `sourceUrl` 的稳定 hash

---

## 10. 分阶段实施计划

### Phase 0：架构准备

1. 新增 `pageConfig` API client
2. 引入 `AvatarDescriptor`
3. 主页面改为按 avatar 分流
4. 抽出 `MouthSink`

### Phase 1：R3F VRM MVP

1. 新增 `packages/react-native-vrm/`
2. 实现 `ReactNativeVRMView`
3. 实现 `VRMService` / `useVRM`
4. 打通模型加载、显示、卸载
5. 复用现有手势做拖拽缩放

验收标准：

1. 能加载并显示 VRM
2. 角色切换时 Live2D / VRM 可正确切换
3. 模型卸载后不会残留 GL 资源或双重渲染

### Phase 2：交互补全

1. 接入口型同步
2. 接入基础表情控制
3. 接入可选 `.vrma`
4. 增加默认 lookAt / cursor follow

### Phase 3：增强与替换准备

1. 接入角色级 lighting
2. 统一 transform 偏好持久化
3. 为未来真原生 `react-native-vrm` 保持接口稳定

---

## 11. 风险与缓解

### 风险 1：Expo GL 与真机兼容性

问题：

- 模拟器和真机表现差异可能很大
- iOS / Android 驱动差异会导致纹理、精度、性能问题

缓解：

- MVP 阶段只把“真机可用”作为主验收标准
- 每次迭代优先在 Android 真机验证

### 风险 2：内存占用高

问题：

- VRM 模型通常比 Live2D 更重
- 角色切换时若清理不彻底，容易出现显存/内存上涨

缓解：

- 强制在切换角色前执行 dispose
- Service 层显式区分 `unload` 与 `destroy`
- 将“切角色 20 次无明显泄漏”列为验收项

### 风险 3：Loader 资源路径不稳定

问题：

- RN 环境对 `GLTFLoader.load(url)` 的支持路径与浏览器不同

缓解：

- 第一阶段统一使用缓存文件 + `parse(ArrayBuffer)` 方案

### 风险 4：口型同步回归

问题：

- 现有口型同步链路绑定 Live2D，改造不当会影响现有功能

缓解：

- 先引入 `MouthSink` 抽象
- Live2D 继续走旧实现，VRM 仅新增实现

---

## 12. 需要修改的清单

第一批建议按以下顺序实施：

1. `services/api/pageConfig.ts`
2. `services/avatarTypes.ts`
3. `services/LipSyncService.ts`
4. `hooks/useLipSync.ts`
5. `packages/react-native-vrm/`
6. `services/VRMService.ts`
7. `hooks/useVRM.ts`
8. `app/(tabs)/main.tsx`
9. `metro.config.js`
10. `package.json`

---

## 13. 依赖建议

第一阶段建议依赖：

- `@react-three/fiber`
- `three`
- `@pixiv/three-vrm`
- `expo-gl`
- `expo-asset`

可选依赖：

- `@react-three/drei`
- `three-stdlib`

原则：

- MVP 先减少依赖数量
- 能自己封装的小能力，不急着引入重型 helper 包

---

## 14. 外部参考

- React Three Fiber React Native: https://r3f.docs.pmnd.rs/getting-started/installation
- Expo GLView: https://docs.expo.dev/versions/latest/sdk/gl-view/
- `@pixiv/three-vrm`: https://github.com/pixiv/three-vrm

---

## 15. 最终建议

从工程演进角度，推荐路线不是“R3F 和原生二选一”，而是：

1. **先以 R3F 实现 `react-native-vrm` 包**
2. **在 App 层建立稳定的 avatar / mouth / transform 抽象**
3. **等 VRM 在移动端被证明是核心能力后，再把 `react-native-vrm` 内核替换为真原生实现**

这样可以在最短时间内拿到可运行结果，同时不给未来的原生化封死路径。
