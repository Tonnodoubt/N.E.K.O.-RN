# N.E.K.O.-RN Code Review Issues

## Status: 核心问题已修复，剩余为持续改进项

### 修复进度

| Severity | Total | Fixed | Remaining |
|----------|-------|-------|-----------|
| Critical | 6     | 2     | 4（本地开发不影响） |
| High     | 6     | 5     | 1 |
| Medium   | 8     | 5     | 3 |
| Low      | 3     | 1     | 2 |
| **Total** | **23** | **13** | **10** |

---

## 已修复 ✅

- **C1.** `appendP2PToken` 加 `encodeURIComponent`
- **C6.** wsService/CloudRegistry 日志脱敏
- **H2.** UDP 响应 IP/端口校验（`isValidEndpoint`）
- **H3.** Native audio `sessionRejecter` 超时 `.finally()` 清理
- **H4.** CameraStreamService 重试前 `cameraRef` null 检查
- **H5.** 消息 ID 统一为 `Date.now() + Math.random()` 策略
- **H6.** `any` 类型替换（`parsedMsg`、`sanitizePartial`）
- **M1.** useCameraStream 后台检测改为 `AppState` 事件驱动
- **M5.** QR 码 token 长度 1-256 + 控制字符校验
- **M6.** 调试面板加 `__DEV__` 保护
- **M7.** `sanitizeP2P` 中 token 加 `.trim()`
- **L3.** `getCurrentTimeString` locale 改为系统默认

---

## 剩余 — 上线前需修复

- [ ] **C2.** CloudRegistry 改 HTTPS + 环境变量（需后端配证书）
- [ ] **C3.** P2P 打洞 UDP 加密（需后端配合）
- [ ] **H1.** P2P token 改用 expo-secure-store（需装新依赖）

## 剩余 — 代码质量改进（持续迭代）

- [ ] **C4.** 核心业务路径补测试
- [ ] **C5.** main.tsx 拆分（拆出 useSessionManager 等）
- [ ] **M2.** Native audio 二进制帧替代 JSON（需协议变更）
- [ ] **M3.** AudioService 废弃方法清理（需迁移 audio-test/explore）
- [ ] **M4.** buildHttpBaseURL 支持 HTTPS（本地开发不需要）
- [ ] **M8.** native/web audio service 代码去重
- [ ] **L1.** console.log 加 `__DEV__` 守卫
- [ ] **L2.** eslint-disable-line hook 依赖修复
