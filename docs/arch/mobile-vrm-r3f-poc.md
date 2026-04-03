# 移动端 VRM PoC（R3F 路线）

> 这不是“确定要做”的实现文档，而是**最小验证文件**。
>
> 目标只有一个：尽快判断 `@react-three/fiber/native + expo-gl + @pixiv/three-vrm` 在 `N.E.K.O.-RN` 里到底是不是一条真实可行的路。

---

## 1. 为什么先做 PoC

之前对“手机端 VRM 很难支持”的判断并没有错：

1. RN 端没有浏览器那种现成 WebGL 运行环境
2. `@pixiv/three-vrm` 的主使用场景是浏览器 / Three.js，不是 React Native
3. Expo / 真机 / GL 上下文 / 模型内存释放都可能成为阻塞点

所以在真正新增 `react-native-vrm` 包之前，必须先做一个 **只验证关键假设** 的 PoC。

---

## 2. PoC 只回答 4 个问题

### Q1. `@react-three/fiber/native` 能否在当前项目里正常起一个 `Canvas`

如果不能，R3F 路线直接终止。

### Q2. `.vrm` 文件能否在 RN 环境里被 `GLTFLoader.parse()` + `VRMLoaderPlugin` 正确解析

如果不能，说明 `three-vrm` 与 RN/Expo 的核心组合存在阻塞。

### Q3. 模型加载后能否在 Android 真机上稳定显示

这里不要求动画、表情、口型，只看：

1. 能否出图
2. 纹理是否正常
3. 模型方向是否大致正确

### Q4. 页面退出 / 角色切换后，GL 资源能否被释放

如果不能，后续继续深投的风险极高。

---

## 3. PoC 范围

### 包含

1. `Canvas` 起屏
2. `.vrm` 二进制下载与本地缓存
3. `GLTFLoader.parse(ArrayBuffer)`
4. `VRMLoaderPlugin` 注册
5. 模型显示
6. 页面卸载时的 dispose

### 不包含

1. `.vrma` 动画
2. 表情系统
3. 口型同步
4. lookAt / cursor follow
5. 打光参数持久化
6. 和主页面 `main.tsx` 的正式集成

---

## 4. 本次已生成的 PoC 文件

### 4.1 预检页面

- [vrm-poc.tsx](/Users/tongqianqiu/N.E.K.O.-RN/app/vrm-poc.tsx)

作用：

1. 请求 `/api/config/page_config`
2. 验证当前角色是不是 `live3d/vrm`
3. 验证 `model_path` 是否存在
4. 提供后续 R3F 真机验证前的统一入口

注意：

- 这个页面当前**不做渲染**
- 它只是 PoC 的“前置条件检查器”

### 4.2 page_config 客户端

- [pageConfig.ts](/Users/tongqianqiu/N.E.K.O.-RN/services/api/pageConfig.ts)

作用：

1. 为后续 `AvatarRenderer` 分流复用同一入口
2. 让 PoC 不再依赖 `current_live2d_model`

---

## 5. 通过标准

### Pass

满足以下全部条件：

1. Android 真机能显示 VRM
2. 切出页面后无明显崩溃或 GL context 错误
3. 连续进入/退出 5 次没有明显内存异常
4. 同一模型重复加载 5 次没有明显残留

### Soft Fail

以下情况视为“路线可疑，但还可以局部补救”：

1. 能起画布，但模型方向或缩放异常
2. 能加载模型，但性能较差
3. 首次加载成功，第二次切换角色有残留

### Hard Fail

以下任一项成立，就不建议继续深投 R3F 路线：

1. `Canvas` 无法稳定在真机启动
2. `GLTFLoader.parse()` 无法在 RN 中解析 `.vrm`
3. 真机上频繁崩溃
4. 资源释放明显失控

---

## 6. 后续建议的最小实现顺序

### Step 1

安装依赖并验证最小 `Canvas`：

- `@react-three/fiber`
- `three`
- `expo-gl`
- `expo-asset`
- `@pixiv/three-vrm`

### Step 2

新增最小测试页：

- 只加载一个固定 `.vrm`
- 不接角色切换
- 不接主页面

### Step 3

把加载方式定死为：

1. 下载到缓存目录
2. 读取 `ArrayBuffer`
3. `GLTFLoader.parse()`

不要一开始就依赖 `loader.load(url)`。

### Step 4

验证 dispose：

1. 离开页面
2. 返回页面
3. 重复 5 次

记录：

- 是否崩溃
- 是否黑屏
- 是否出现第二个模型叠加

---

## 7. 结果记录模板

建议每次 PoC 后按下面格式补记录：

```md
日期：
设备：
系统版本：
模型：

Q1 Canvas:
- 结果：
- 备注：

Q2 VRM parse:
- 结果：
- 备注：

Q3 真机显示:
- 结果：
- 备注：

Q4 资源释放:
- 结果：
- 备注：

结论：
- 继续 / 暂停 / 放弃 R3F 路线
```

---

## 8. 当前结论

截至本文件创建时：

1. **服务端与角色配置链路具备进入 VRM PoC 的前提**
2. **RN 真机渲染链路尚未验证**
3. **“R3F 路线可行”目前只能算假设，不是结论**

这就是本 PoC 文件存在的意义。
