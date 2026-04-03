declare module "react-native-pcm-stream" {
  export type PlaybackState = "IDLE" | "PLAYING" | "PAUSED" | "COMPLETED";

  export type PlaybackStats = {
    state: PlaybackState;
    isPlaying: boolean;
    totalDuration: number;
    playedDuration: number;
    remainingDuration: number;
    progress: number;
  };

  export type OnErrorEventPayload = {
    message?: string | null;
    state?: string;
  };

  export type OnAudioFrameEventPayload = {
    pcm: Uint8Array;
    ts?: number;
    seq?: number;
  };

  export type OnPlaybackStartEventPayload = {
    state: string;
  };

  export type OnPlaybackStopEventPayload = {
    state: string;
    totalDuration: number;
    playedDuration: number;
  };

  export type OnPlaybackPausedEventPayload = {
    state: string;
  };

  export type OnPlaybackResumedEventPayload = {
    state: string;
  };

  export type OnPlaybackProgressEventPayload = {
    playedDuration: number;
    totalDuration: number;
    progress: number;
    remainingDuration: number;
  };

  export type OnAmplitudeUpdateEventPayload = {
    amplitude: number;
  };

  export type PCMStreamModuleEvents = {
    onError?: (params: OnErrorEventPayload) => void;
    onPlaybackStart?: (params: OnPlaybackStartEventPayload) => void;
    onPlaybackStop?: (params: OnPlaybackStopEventPayload) => void;
    onPlaybackPaused?: (params: OnPlaybackPausedEventPayload) => void;
    onPlaybackResumed?: (params: OnPlaybackResumedEventPayload) => void;
    onPlaybackProgress?: (params: OnPlaybackProgressEventPayload) => void;
    onAmplitudeUpdate?: (params: OnAmplitudeUpdateEventPayload) => void;
    onAudioFrame?: (params: OnAudioFrameEventPayload) => void;
  };

  export type PCMStreamModuleSpec = {
    hello(): string;
    initPlayer(sampleRate?: number): void;
    playPCMChunk(chunk: Uint8Array): void;
    stopPlayback(): void;

    getPlaybackState(): PlaybackState;
    isPlaying(): boolean;
    getTotalDuration(): number;
    getPlayedDuration(): number;
    getRemainingDuration(): number;
    getProgress(): number;
    getPlaybackStats(): PlaybackStats;

    startRecording(sampleRate?: number, frameSize?: number, targetRate?: number): void;
    stopRecording(): void;

    addListener<E extends keyof PCMStreamModuleEvents>(
      eventName: E,
      listener: NonNullable<PCMStreamModuleEvents[E]>
    ): { remove: () => void };
  };

  const PCMStream: PCMStreamModuleSpec;
  export default PCMStream;
}
