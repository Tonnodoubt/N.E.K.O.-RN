import PCMStream from "react-native-pcm-stream";
import { TinyEmitter } from "@project_neko/common";
import { SpeechInterruptController } from "../protocol";
import type { AudioService, AudioServiceEvents, AudioServiceState, NekoWsIncomingJson, RealtimeClientLike } from "../types";

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  if (!ms || ms <= 0) return p;
  let timer: any = null;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

export function createNativeAudioService(args: {
  client: RealtimeClientLike;
  /**
   * 录音：原生采样率（默认 48000），并由 native module 重采样到 targetRate（默认 16000）
   */
  recordSampleRate?: number;
  recordFrameSize?: number;
  recordTargetRate?: number;
  /**
   * 播放：PCM 采样率（默认 48000）
   */
  playbackSampleRate?: number;
}): AudioService & { on: TinyEmitter<AudioServiceEvents>["on"]; getState: () => AudioServiceState } {
  const emitter = new TinyEmitter<AudioServiceEvents>();
  const interrupt = new SpeechInterruptController();

  let state: AudioServiceState = "idle";
  const setState = (next: AudioServiceState) => {
    if (state === next) return;
    state = next;
    emitter.emit("state", { state: next });
  };

  let offs: (() => void)[] = [];
  let audioFrameSub: { remove: () => void } | null = null;
  let ampSub: { remove: () => void } | null = null;
  let playbackStopSub: { remove: () => void } | null = null;
  let errorSub: { remove: () => void } | null = null;

  let sessionResolver: (() => void) | null = null;
  let recordingReject: ((error: Error) => void) | null = null;

  const attachRecordingListeners = () => {
    if (audioFrameSub) return;

    // 🔥 监听原生层错误
    errorSub = PCMStream.addListener("onError", (event: any) => {
      const message = event?.message || "Unknown native error";
      console.error("❌ Native PCMStream error:", message);
      if (recordingReject) {
        const reject = recordingReject;
        recordingReject = null;
        reject(new Error(message));
      }
    });

    audioFrameSub = PCMStream.addListener("onAudioFrame", (event: any) => {
      const pcm: Uint8Array | undefined = event?.pcm;
      if (!pcm) return;

      // 与旧版协议一致：stream_data + input_type=audio + data 为 number[]
      try {
        const int16 = new Int16Array(pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength));
        args.client.sendJson({
          action: "stream_data",
          data: Array.from(int16 as any),
          input_type: "audio",
        });
      } catch (_e) {
        // ignore
      }
    });

    ampSub = PCMStream.addListener("onAmplitudeUpdate", (event: any) => {
      const amp = typeof event?.amplitude === "number" ? event.amplitude : 0;
      emitter.emit("inputAmplitude", { amplitude: Math.max(0, Math.min(1, amp)) });
    });

    playbackStopSub = PCMStream.addListener("onPlaybackStop", () => {
      // 播放完成：输出 0，方便口型收嘴
      emitter.emit("outputAmplitude", { amplitude: 0 });
    });
  };

  const detachRecordingListeners = () => {
    try {
      audioFrameSub?.remove();
    } catch (_e) {}
    try {
      ampSub?.remove();
    } catch (_e) {}
    try {
      playbackStopSub?.remove();
    } catch (_e) {}
    try {
      errorSub?.remove();
    } catch (_e) {}
    audioFrameSub = null;
    ampSub = null;
    playbackStopSub = null;
    errorSub = null;
  };

  const handleIncomingJson = (json: NekoWsIncomingJson) => {
    if (!json || typeof json !== "object") return;
    if ((json as any).type === "session_started") {
      if (sessionResolver) {
        const r = sessionResolver;
        sessionResolver = null;
        r();
      }
      return;
    }
    if ((json as any).type === "user_activity") {
      interrupt.onUserActivity((json as any).interrupted_speech_id);
      stopPlayback();
      return;
    }
    if ((json as any).type === "audio_chunk") {
      interrupt.onAudioChunk((json as any).speech_id);
      return;
    }
  };

  const handleIncomingBinary = (data: unknown) => {
    if (interrupt.getSkipNextBinary()) return;

    // Native 侧优先假设服务端下发 PCM16（ArrayBuffer/Uint8Array）
    try {
      const playbackSampleRate = args.playbackSampleRate ?? 48000;
      PCMStream.initPlayer(playbackSampleRate);

      if (data instanceof ArrayBuffer) {
        PCMStream.playPCMChunk(new Uint8Array(data));
        return;
      }
      if (data instanceof Uint8Array) {
        PCMStream.playPCMChunk(data);
        return;
      }
      const anyData: any = data as any;
      if (anyData && anyData.buffer instanceof ArrayBuffer && typeof anyData.byteLength === "number") {
        PCMStream.playPCMChunk(new Uint8Array(anyData.buffer, anyData.byteOffset || 0, anyData.byteLength));
      }
    } catch (_e) {
      // ignore
    }
  };

  const attach = () => {
    if (offs.length) return;
    setState("ready");

    offs = [
      args.client.on("json", ({ json }) => handleIncomingJson(json as any)),
      args.client.on("binary", ({ data }) => handleIncomingBinary(data)),
    ];
  };

  const detach = () => {
    for (const off of offs) {
      try {
        off();
      } catch (_e) {}
    }
    offs = [];
    sessionResolver = null;
    interrupt.reset();
    detachRecordingListeners();
    try {
      PCMStream.stopRecording();
    } catch (_e) {}
    try {
      PCMStream.stopPlayback();
    } catch (_e) {}
    setState("idle");
  };

  const waitSessionStarted = (timeoutMs: number) => {
    return withTimeout(
      new Promise<void>((resolve) => {
        sessionResolver = resolve;
      }),
      timeoutMs,
      `Session start timeout after ${timeoutMs}ms`
    );
  };

  const startVoiceSession: AudioService["startVoiceSession"] = async (opts) => {
    attach();
    setState("starting");

    const timeoutMs = opts?.timeoutMs ?? 10_000;
    attachRecordingListeners();

    return new Promise<void>((resolve, reject) => {
      // 设置录音错误拒绝器
      recordingReject = reject;

      const cleanup = () => {
        recordingReject = null;
      };

      // 超时处理
      const timeoutId = setTimeout(() => {
        cleanup();
        const error = new Error(`Session start timeout after ${timeoutMs}ms`);
        setState("error");
        reject(error);
      }, timeoutMs);

      // 会话启动成功回调
      const sessionP = waitSessionStarted(timeoutMs);

      sessionP.then(() => {
        clearTimeout(timeoutId);
        cleanup();

        try {
          // 🔥 修复：让 PCMStream.startRecording 的错误通过 Promise 捕获
          // 原生层会通过 onError 事件发送错误，我们在 attachRecordingListeners 中处理
          PCMStream.startRecording(
            args.recordSampleRate ?? 48000,
            args.recordFrameSize ?? 1536,
            args.recordTargetRate ?? 16000
          );

          setState("recording");
          resolve();
        } catch (e) {
          cleanup();
          setState("error");
          reject(e);
        }
      }).catch((error) => {
        clearTimeout(timeoutId);
        cleanup();
        setState("error");
        reject(error);
      });

      // 发送启动会话请求
      try {
        args.client.sendJson({ action: "start_session", input_type: "audio" });
      } catch (e) {
        clearTimeout(timeoutId);
        cleanup();
        setState("error");
        reject(e);
      }
    });
  };

  const stopVoiceSession: AudioService["stopVoiceSession"] = async () => {
    setState("stopping");
    try {
      PCMStream.stopRecording();
    } catch (_e) {}
    try {
      args.client.sendJson({ action: "pause_session" });
    } catch (_e) {}
    setState("ready");
  };

  const stopPlayback: AudioService["stopPlayback"] = () => {
    try {
      PCMStream.stopPlayback();
    } catch (_e) {}
    emitter.emit("outputAmplitude", { amplitude: 0 });
  };

  return {
    attach,
    detach,
    startVoiceSession,
    stopVoiceSession,
    stopPlayback,
    on: emitter.on.bind(emitter),
    getState: () => state,
  };
}

