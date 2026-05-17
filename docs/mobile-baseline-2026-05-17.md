# Mobile Baseline - 2026-05-17

This document pins the current mobile-focused baseline across backend, desktop tray entry, and RN.

Scope: mobile connection only. Do not use this baseline to reason about unrelated desktop sync work.

## Baseline Matrix

| Part | Path | Branch | Commit | Status |
| --- | --- | --- | --- | --- |
| Backend | `/Users/tongqianqiu/N.E.K.O.TONG-mobile-backend` | `mobile-backend` | `ff81a6e6 feat(mobile): restore LAN proxy backend` | Clean |
| PC tray | `/Users/tongqianqiu/N.E.K.O.-PC-mobile-connect` | `mobile-connect` | `89416f1 feat(mobile): add tray QR connect window` | Clean |
| RN app | `/Users/tongqianqiu/N.E.K.O.-RN` | `rn-alignment` | `7cd9d7c feat(mobile): consolidate RN app shell` | App commit clean; see notes below |
| Live2D native package | `/Users/tongqianqiu/N.E.K.O.-RN/packages/react-native-live2d` | `main` | `1964596 test: allow empty expo module tests` | Committed; branch is ahead/behind upstream |
| PCM native package | `/Users/tongqianqiu/N.E.K.O.-RN/packages/react-native-pcm-stream` | `mobile-rn-support` | `46be383 test: allow empty expo module tests` | Commit clean; generated Android files remain untracked |

## Backend

The backend baseline restores the mobile LAN proxy path on top of latest `main` at the time of recovery.

Included:

- `LAN_PROXY_PORT`, default `48920`
- Launcher-managed `LAN Proxy` process
- `GET /p2p-info`
- `GET /lanproxyqrcode`
- `POST /pairing/register`
- `GET|POST /pairing/resolve`
- `lan_proxy.py`, `udp_server.py`, `stun_client.py`, `cloud_registry_client.py`
- Local LAN mode defaults for cloud registry and STUN

Verified:

- `uv run python -m py_compile ...` passed
- Related backend tests passed: `16 passed`
- Temporary port smoke passed:
  - Main health on `50911`
  - LAN Proxy health on `50920`
  - `/p2p-info` returned `200`
  - `/lanproxyqrcode` returned `200`
  - `pairing_supported: true`

Default run check:

```bash
cd /Users/tongqianqiu/N.E.K.O.TONG-mobile-backend
NEKO_ENABLE_CLOUD_REGISTRY=false NEKO_ENABLE_STUN=false uv run python launcher.py
```

Expected local endpoints:

```bash
curl -sf http://127.0.0.1:48911/health
curl -sf http://127.0.0.1:48911/p2p-info
curl -I http://127.0.0.1:48911/lanproxyqrcode
curl -sf http://127.0.0.1:48920/health
```

## PC Tray

The PC baseline is a clean mobile-only worktree split from the mixed original PC worktree.

Included:

- Tray item: `mobileConnect`
- Mobile connect window data URL
- Main-process IPC:
  - `get-mobile-connect-data`
  - `set-mobile-connect-takeover`
- Backend requests:
  - `/p2p-info`
  - `/lanproxyqrcode`
- Desktop yield/takeover bridge for the main window

Verified:

- `node --test test/main-composition-contract.test.js test/storage-window-display-contract.test.js` passed
  - `15` passed
  - `6` skipped because the sibling backend repo was unavailable in that checkout
- Module load check passed:

```bash
node -e "require('./src/main/mobile-connect-window-data-url'); require('./src/main/hotkey-manager'); require('./src/main/tray-menu'); console.log('ok')"
```

Default run check:

```bash
cd /Users/tongqianqiu/N.E.K.O.-PC-mobile-connect
npm start
```

Expected manual check:

- Open tray menu
- Open Mobile Connect
- Confirm QR code appears
- Toggle phone takeover if the desktop main window is available

## RN App

The RN baseline consolidates the mobile shell and native-facing app structure.

Included:

- Mobile-first app shell
- QR scanner route cleanup
- Server config and settings screens aligned to the mobile flow
- Native chat components only
- Live2D stage and mobile control components
- Character switch/selection overlays
- Theme, font, and token system
- Design and mobile support docs
- Submodule pointer updates for:
  - `packages/react-native-live2d`
  - `packages/react-native-pcm-stream`

Verified:

```bash
cd /Users/tongqianqiu/N.E.K.O.-RN
npm run type-check
npm run test
npm run lint
cd android && JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME=/Users/tongqianqiu/Library/Android/sdk ./gradlew assembleDebug --no-daemon
```

Results:

- Type check passed
- Workspace tests passed
- Lint passed with `0` errors
- Lint still reports existing formatting/import warnings
- Android debug APK build passed
  - APK: `/Users/tongqianqiu/N.E.K.O.-RN/android/app/build/outputs/apk/debug/app-debug.apk`
  - Size: `215M`
  - SHA-256: `eae3a7745485422f78c6322850174e725b25e10c57af3eb92988f73b2e0b700b`

Current RN working tree notes:

- `.agents/`, `AGENTS.md`, and `CLAUDE.md` are untracked and intentionally not committed.
- `packages/react-native-pcm-stream` contains untracked Android/generated files and `app.json`; these were intentionally not committed.
- No `.env` files were modified or committed.

## Not Pushed

None of these commits have been pushed.

Pushing later requires an explicit decision about submodule remotes:

- `react-native-live2d` is ahead of and behind its upstream `main`.
- `react-native-pcm-stream` uses local branch `mobile-rn-support`.

## Artifact And Runtime Check - 2026-05-17

Second-step checks are complete.

RN artifact:

- `./gradlew assembleDebug --no-daemon` passed.
- APK: `/Users/tongqianqiu/N.E.K.O.-RN/android/app/build/outputs/apk/debug/app-debug.apk`
- Size: `215M`
- SHA-256: `eae3a7745485422f78c6322850174e725b25e10c57af3eb92988f73b2e0b700b`
- Gradle reported existing deprecation warnings and the existing Expo `NODE_ENV` warning.

Backend runtime smoke:

- Default main port `48911` was occupied during the check, so the isolated smoke used main `50911` and LAN proxy `50920`.
- Main `/health`: passed.
- LAN proxy `/health`: passed.
- Main `/p2p-info`: `200`.
- LAN proxy `/p2p-info`: `200`.
- `/lanproxyqrcode`: `200`, `2110` bytes.
- QR payload confirmed:
  - `lan_ip: 192.168.1.8`
  - `port: 50920`
  - `character: test`
  - token present
  - `pairing_supported: true`
  - direct URL uses the same LAN proxy port.

PC runtime smoke:

- `/Users/tongqianqiu/N.E.K.O.-PC-mobile-connect` was started with `npm start` for about 30 seconds.
- Startup produced useful Electron/app output and no failure pattern was detected.
- The test harness terminated the app after the timeout; the final renderer/GPU termination lines are from that controlled shutdown.
- `npm install` was required in the new PC worktree to restore `node_modules`; `package-lock.json` was restored afterward and the PC worktree remained clean.
- Runtime log: `/tmp/neko-pc-mobile-connect-start.log`.

## Next Step

Continue from the verified baseline:

1. Run an end-to-end three-device check on the real LAN.
2. Decide whether to push the three baseline branches and the RN native package branches.
