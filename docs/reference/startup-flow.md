# N.E.K.O + N.E.K.O.-RN 启动流程（Windows）

本文记录双仓库工作区的日常启动流程：
- 后端：N.E.K.O
- 移动端：N.E.K.O.-RN（Expo/Metro）

## 仓库目录

```
D:\myprojects\N.E.K.O
D:\myprojects\N.E.K.O.-RN
```

## 日常启动（最快路径）

1. 启动后端（N.E.K.O）

```
start_servers.bat
```

手动方式：

```
uv sync
uv run python memory_server.py
uv run python main_server.py
```

2. 启动 Metro（N.E.K.O.-RN）

```
npx expo start --dev-client
```

可用替代：

```
npm start
```

3. 手机打开已安装的 App，它会自动连接 Metro。

## 跨机器（Windows 后端 + Mac Metro + Dev Build）

适用场景：后端在 Windows，Metro 在 Mac，手机为 Dev Build。

启动顺序（推荐）：

1. Windows 启动后端（N.E.K.O）

```
start_servers.bat
```

2. Windows 打开二维码页（后端自带，无需 Web 前端）

```
http://<你的电脑IP>:48911/qr
```

3. Mac 启动 Metro（RN）

```
cd N.E.K.O.-RN
npx expo start --dev-client
```

4. 手机打开 App → 进入 **QR Scanner** → 扫二维码页

5. 回到主界面开始对话（文本/语音/Live2D）

说明：
- Metro 只负责 App 代码热更新
- 二维码只负责“后端地址配置”

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

方式 A：二维码

```
电脑打开 http://<你的电脑IP>:48911/qr
App 内扫码
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
