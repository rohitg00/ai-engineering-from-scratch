import type { AudioChunk } from "./types.ts";

export function turnCompletionScore(partial: string): number {
  // LiveKit turn-detector model の小さな代役。
  if (!partial) return 0;
  const tail = partial.trimEnd();
  if (tail.endsWith("?") || tail.endsWith(".") || tail.endsWith("!")) return 0.95;
  const n = partial.split(/\s+/).filter(Boolean).length;
  if (n < 3) return 0.2;
  if (n < 6) return 0.55;
  return 0.75;
}

export function synthCall(script: string, startMs = 0, noise = 0): AudioChunk[] {
  // 20ms-frame の "audio" を生成する。leading silence、word ごとの speech、
  // state machine が end to end に走れる長い trailing silence の順。
  const words = script.trim().split(/\s+/).filter(Boolean);
  const frames: AudioChunk[] = [];
  let t = startMs;
  for (let i = 0; i < 6; i++) {
    frames.push({ tMs: t, isSpeech: Math.random() < noise, partial: "" });
    t += 20;
  }
  let partial = "";
  for (const w of words) {
    partial = (partial ? partial + " " : "") + w;
    for (let i = 0; i < 16; i++) {
      frames.push({ tMs: t, isSpeech: true, partial });
      t += 20;
    }
  }
  for (let i = 0; i < 110; i++) {
    frames.push({ tMs: t, isSpeech: false, partial });
    t += 20;
  }
  return frames;
}
