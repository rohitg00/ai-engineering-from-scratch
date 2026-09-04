import type { AudioChunk } from "./types.ts";

export function turnCompletionScore(partial: string): number {
  // Tiny stand-in for the LiveKit turn-detector model.
  if (!partial) return 0;
  const tail = partial.trimEnd();
  if (tail.endsWith("?") || tail.endsWith(".") || tail.endsWith("!")) return 0.95;
  const n = partial.split(/\s+/).filter(Boolean).length;
  if (n < 3) return 0.2;
  if (n < 6) return 0.55;
  return 0.75;
}

export function synthCall(script: string, startMs = 0, noise = 0): AudioChunk[] {
  // Generate 20ms-frame "audio" with a leading silence, then per-word speech,
  // then a long trailing silence so the state machine can run end to end.
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
