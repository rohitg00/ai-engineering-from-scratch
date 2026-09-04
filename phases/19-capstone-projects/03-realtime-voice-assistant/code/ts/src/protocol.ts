import { z } from "zod";

export const EventFrame = z.object({
  type: z.literal("event"),
  line: z.string(),
});
export type EventFrame = z.infer<typeof EventFrame>;

export const SummaryFrame = z.object({
  type: z.literal("summary"),
  turnCompleteMs: z.number(),
  firstLlmTokenMs: z.number(),
  firstAudioOutMs: z.number(),
  turnLatencyMs: z.number(),
  bargeIns: z.number(),
});
export type SummaryFrame = z.infer<typeof SummaryFrame>;

export const Frame = z.discriminatedUnion("type", [EventFrame, SummaryFrame]);
export type Frame = z.infer<typeof Frame>;

export function encodeFrame(f: Frame): string {
  return JSON.stringify(f);
}

export function decodeFrame(raw: string): Frame {
  return Frame.parse(JSON.parse(raw));
}
