import type { GenAISpan } from "./types.js";

export const PRICE_USD_PER_MTOKEN: Record<
  string,
  { input: number; output: number }
> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-5.4": { input: 5, output: 15 },
  "claude-3-5-sonnet": { input: 3, output: 15 },
  "claude-opus-4-7": { input: 15, output: 75 },
  "gemini-2-5-pro": { input: 1.25, output: 5 },
};

export function spanModel(span: GenAISpan): string {
  return (
    span.attributes["gen_ai.response.model"] ??
    span.attributes["gen_ai.request.model"]
  );
}

export function spanCostUsd(span: GenAISpan): number {
  const model = spanModel(span);
  const price = PRICE_USD_PER_MTOKEN[model];
  if (!price) return 0;
  const inTok = Number(span.attributes["gen_ai.usage.input_tokens"] ?? 0);
  const outTok = Number(span.attributes["gen_ai.usage.output_tokens"] ?? 0);
  return (inTok / 1e6) * price.input + (outTok / 1e6) * price.output;
}

export function spanLatencyMs(span: GenAISpan): number {
  return (span.end_time_unix_nano - span.start_time_unix_nano) / 1e6;
}
