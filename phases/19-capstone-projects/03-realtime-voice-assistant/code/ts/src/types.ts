export type State = "IDLE" | "LISTENING" | "WAITING" | "THINKING" | "SPEAKING";

export type AudioChunk = {
  tMs: number;
  isSpeech: boolean;
  partial: string;
};

export type Tool = { name: string; latencyMs: number; result: string };

export type Metrics = {
  events: string[];
  turnCompleteMs: number;
  firstLlmTokenMs: number;
  firstAudioOutMs: number;
  bargeIns: number;
};

export type SessionOptions = {
  useTool: boolean;
  bargeInAtMs: number | null;
  onEvent?: (line: string) => void;
};

export type SessionSummary = {
  turnCompleteMs: number;
  firstLlmTokenMs: number;
  firstAudioOutMs: number;
  turnLatencyMs: number;
  bargeIns: number;
};
