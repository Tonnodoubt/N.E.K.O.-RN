/**
 * Chat 组件导出
 *
 * Metro Bundler 根据平台自动选择：
 * - Web: ChatContainer.tsx
 * - Android/iOS: ChatContainer.native.tsx
 */

export { default as ChatContainer } from "./ChatContainer";
export { default as MessageList } from "./MessageList";
export { getMessageText, getMessageImage, getMessageBlocks } from "./types";
export * from "./types";
export * from "./hooks";