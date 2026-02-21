# 快速开发流程指南

> 使用 Expo 开发构建，一次编译，热更新开发

---

## 流程说明

```
┌─────────────────────────────────────────────────────────┐
│                    开发流程                              │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  首次或修改原生代码后：                                   │
│  ┌─────────────┐                                        │
│  │ 编译开发版   │ ──→ 安装到手机 ──→ 一次性 (5-10分钟)    │
│  │ APK         │                                        │
│  └─────────────┘                                        │
│                                                         │
│  日常开发（改 JS/TS 代码）：                              │
│  ┌─────────────┐                                        │
│  │ 启动开发    │ ──→ 手机扫码 ──→ 热更新 (秒级)          │
│  │ 服务器      │                                        │
│  └─────────────┘                                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 首次设置

### 1. 编译开发版 APK

```bash
cd f:/myprojects/N.E.K.O.-RN

# 方式 A：云端构建（推荐，稳定）
npx eas build --profile development --platform android

# 方式 B：本地构建（更快，但需要环境）
npx expo run:android
```

构建完成后下载 APK 安装到手机。

### 2. 启动开发服务器

```bash
npx expo start --dev-client
```

### 3. 手机连接

- 确保手机和电脑在同一 WiFi
- 打开手机上的 N.E.K.O 开发版应用
- 扫码或手动输入地址连接

---

## 日常开发

```bash
# 1. 启动开发服务器
npx expo start --dev-client

# 2. 手机打开应用，自动连接

# 3. 修改代码，保存后自动热更新

# 4. 快捷键
#    r - 重载应用
#    m - 打开开发菜单
#    j - 打开调试器
```

---

## 何时需要重新编译

只有修改以下内容才需要重新编译：

| 需要重新编译 | 不需要重新编译 |
|-------------|---------------|
| 原生模块代码 | TS/JS 代码 |
| android/ 目录 | app/ 目录 |
| ios/ 目录 | packages/ 目录 |
| app.json 配置 | 样式文件 |
| 添加新依赖 | 组件代码 |

---

## 常用命令

```bash
# 启动开发服务器
npx expo start --dev-client

# 云端构建开发版
npx eas build --profile development --platform android

# 本地构建
npx expo run:android

# 清理缓存
npx expo start --dev-client --clear

# 查看构建状态
npx eas build:list
```

---

## 故障排查

### 手机连接不上

1. 确保手机和电脑在同一 WiFi
2. 检查防火墙是否阻止 8081 端口
3. 尝试用 USB 连接：`npx expo start --dev-client --tunnel`

### 热更新不生效

1. 按 `r` 手动重载
2. 清理缓存：`npx expo start --dev-client --clear`
3. 重启开发服务器

### 构建失败

1. 检查 EAS 账户登录：`npx eas whoami`
2. 查看构建日志：`npx eas build:view [BUILD_ID]`

---

**最后更新**: 2026-02-21
