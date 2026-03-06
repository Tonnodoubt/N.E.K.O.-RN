# N.E.K.O + N.E.K.O.-RN 启动流程（Windows）

本文记录双仓库工作区的日常启动流程：
- 后端：N.E.K.O
- 移动端：N.E.K.O.-RN（Expo/Metro）

## 仓库目录

```
D:\myprojects\N.E.K.O
D:\myprojects\N.E.K.O.-RN
```

## 日常启动（Mac 单机，当前主流程）

适用场景：后端和 Metro 都在同一台 Mac，手机为 Dev Build。

1. 启动后端（N.E.K.O）

```
uv run python main_server.py
```

2. 启动 Metro（N.E.K.O.-RN）

```
npx expo start --dev-client -c
```

3. 手机打开 App → 扫 Metro 终端里的 QR → App 加载完成

4. **电脑浏览器打开**（不需要知道局域网 IP，localhost 就够）

```
http://localhost:48911/qr
```

5. 用**手机系统相机**扫页面上的二维码 → 识别 `nekorn://` deep link → 直接跳主界面并写入后端配置

说明：
- Metro 只负责加载 JS bundle（Dev Build 专属）
- `/qr` 页面的二维码只负责”后端地址配置”，两者独立互不干扰
- `/qr` 页面不建立 WebSocket，Web 前端不会抢占会话
- `localhost:48911/qr` 中展示的二维码内嵌的是真实局域网 IP，手机扫到的是正确地址

## 跨机器（Windows 后端 + Mac Metro + Dev Build）

适用场景：后端在 Windows，Metro 在 Mac，手机为 Dev Build。

启动顺序（推荐）：

1. Windows 启动后端（N.E.K.O）

```
start_servers.bat
```

2. Windows 浏览器打开二维码页

```
http://localhost:48911/qr
```

3. Mac 启动 Metro（RN）

```
cd N.E.K.O.-RN
npx expo start --dev-client -c
```

4. 手机打开 App → 扫 Metro 终端里的 QR → App 加载完成

5. 用**手机系统相机**扫 Windows 屏幕上的二维码 → 直接跳主界面并写入配置

说明：
- Metro 只负责 App 代码热更新
- 二维码只负责”后端地址配置”

## 首次环境准备（每台机器只做一次）

1. 后端依赖

```
Python 3.11
uv sync
```

2. RN 依赖

```
Node 20.19+ 或 22.12+
git submodule update --init --recursive
npm install
```

3. 构建 Dev Client（因为使用了原生模块，必须）

```
npx expo prebuild --clean
npx expo run:android
```

## 手机连接后端（手机 -> 电脑）

方式 A：系统相机扫码（推荐）

```
电脑浏览器打开 http://localhost:48911/qr
手机系统相机扫页面二维码 → 识别 nekorn:// deep link → 直接跳主界面
```

方式 B：手动输入

```
192.168.x.x:48911?name=角色名
```

方式 C：环境变量

```
在 N.E.K.O.-RN/.env 中添加
EXPO_PUBLIC_API_BASE_URL=http://192.168.x.x:48911
```

## 快速检查

- 主服务器默认端口：48911
- 记忆服务器默认端口：48912
- 手机无法访问时：检查局域网 IP 与防火墙
- 仅 USB 直连：adb reverse tcp:48911 tcp:48911
