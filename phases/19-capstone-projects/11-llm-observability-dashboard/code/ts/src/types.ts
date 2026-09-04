export type GenAIOperation = "chat" | "text_completion" | "embeddings";

export type GenAISpan = {
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  start_time_unix_nano: number;
  end_time_unix_nano: number;
  status: "OK" | "ERROR";
  attributes: {
    "gen_ai.system": string;
    "gen_ai.request.model": string;
    "gen_ai.operation.name": GenAIOperation;
    "gen_ai.usage.input_tokens"?: number;
    "gen_ai.usage.output_tokens"?: number;
    "gen_ai.usage.cached_input_tokens"?: number;
    "gen_ai.response.model"?: string;
    "gen_ai.response.finish_reasons"?: string[];
    [key: string]: unknown;
  };
};

export type ModelRollup = {
  model: string;
  count: number;
  errors: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
};

export type Counters = { accepted: number; rejected: number; held: number };
