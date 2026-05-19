/**
 * WS message types for N.E.K.O.-RN ↔ Backend communication.
 *
 * This file is the single source of truth for the wire contract
 * between the RN client and the N.E.K.O backend (main_server port 48911).
 *
 * Backend reference: main_routers/websocket_router.py, main_logic/core.py
 */

// ─── Client → Backend (actions) ───────────────────────────────────

export interface StartSessionAction {
  action: 'start_session';
  input_type: 'text' | 'audio' | 'camera';
  audio_format?: string;
  new_session?: boolean;
  language?: string;
}

export interface StreamDataAction {
  action: 'stream_data';
  input_type: 'text' | 'audio' | 'camera';
  data: string;
  clientMessageId?: string;
}

export interface EndSessionAction {
  action: 'end_session';
}

export interface PauseSessionAction {
  action: 'pause_session';
}

export interface PingAction {
  action: 'ping';
}

export type ClientAction =
  | StartSessionAction
  | StreamDataAction
  | EndSessionAction
  | PauseSessionAction
  | PingAction;

// ─── Backend → Client (message types) ─────────────────────────────

export interface GeminiResponseMessage {
  type: 'gemini_response';
  text: string;
  isNewMessage: boolean;
  turn_id?: string;
  request_id?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionStartedMessage {
  type: 'session_started';
  input_mode: string;
}

export interface SessionPreparingMessage {
  type: 'session_preparing';
  input_mode: string;
}

export interface SessionFailedMessage {
  type: 'session_failed';
  input_mode: string;
}

export interface SessionEndedByServerMessage {
  type: 'session_ended_by_server';
  input_mode: string;
}

export interface StatusMessage {
  type: 'status';
  message: string;
}

export interface SystemMessage {
  type: 'system';
  data: string;
}

export interface UserActivityMessage {
  type: 'user_activity';
}

export interface UserTranscriptMessage {
  type: 'user_transcript';
  text: string;
}

export interface CatgirlSwitchedMessage {
  type: 'catgirl_switched';
  new_catgirl: string;
  old_catgirl?: string;
}

export interface ResponseDiscardedMessage {
  type: 'response_discarded';
  turn_id?: string;
  request_id?: string;
}

export interface RequestScreenshotMessage {
  type: 'request_screenshot';
}

export interface AudioChunkMessage {
  type: 'audio_chunk';
  speech_id: string;
}

export type ServerMessage =
  | GeminiResponseMessage
  | SessionStartedMessage
  | SessionPreparingMessage
  | SessionFailedMessage
  | SessionEndedByServerMessage
  | StatusMessage
  | SystemMessage
  | UserActivityMessage
  | UserTranscriptMessage
  | CatgirlSwitchedMessage
  | ResponseDiscardedMessage
  | RequestScreenshotMessage
  | AudioChunkMessage;
