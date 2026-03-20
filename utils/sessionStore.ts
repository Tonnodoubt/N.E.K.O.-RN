/**
 * 全局 WebSocket 会话状态（纯内存，App 重启自动重置为 false）。
 * main.tsx 在 WebSocket 连接/断开时调用 set()；
 * 其他页面（如 index.tsx）通过 subscribe() 被动监听。
 */
type Listener = (connected: boolean) => void;

let _connected = false;
const _listeners = new Set<Listener>();

export const sessionStore = {
  get isConnected(): boolean {
    return _connected;
  },

  set(connected: boolean): void {
    if (_connected === connected) return;
    _connected = connected;
    _listeners.forEach((l) => { l(connected); });
  },

  subscribe(listener: Listener): () => void {
    _listeners.add(listener);
    return () => _listeners.delete(listener);
  },
};
