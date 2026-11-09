// Lesson: Streaming Speech-to-Speech: Moshi, Hibiki, and Full-Duplex Dialogue (phase 06 / lesson 15)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/15-streaming-speech-to-speech-moshi-hibiki/code/main.ts

import { performance } from "node:perf_hooks";

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randint(rng: Random, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

function pyFixed(x: number, d: number): string {
  if (Number.isNaN(x)) {
    return "nan";
  }
  if (!Number.isFinite(x)) {
    return x > 0 ? "inf" : "-inf";
  }
  const neg = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let s = a.toFixed(d);
  if (a < 1e21) {
    const extra = Math.min(100, d + 30);
    const full = a.toFixed(extra);
    const cut = full.length - (extra - d);
    if (/^50*$/.test(full.slice(cut))) {
      const trunc = full.slice(0, cut).replace(/\.$/, "");
      const last = trunc.charCodeAt(trunc.length - 1) - 48;
      if (last % 2 === 0) {
        s = trunc;
      }
    }
  }
  return (neg ? "-" : "") + s;
}

const FRAME_MS = 80;
const CODEBOOKS = 8;
const SAMPLE_RATE = 24000;

const sleepCell = new Int32Array(new SharedArrayBuffer(4));

function sleep(seconds: number): void {
  Atomics.wait(sleepCell, 0, 0, seconds * 1000);
}

function now(): number {
  return performance.now() / 1000;
}

function fakeMimiEncode(audio80ms: number[]): number[] {
  let total = 0;
  for (const x of audio80ms) {
    total += Math.abs(x);
  }
  const s = total / Math.max(1, audio80ms.length);
  const rng = mulberry32(Math.trunc(s * 1000));
  const out: number[] = [];
  for (let c = 0; c < CODEBOOKS; c++) {
    out.push(randint(rng, 0, 1023));
  }
  return out;
}

function fakeMimiDecode(tokens: number[]): number[] {
  const s = tokens.reduce((a, b) => a + b, 0) / (1024.0 * CODEBOOKS);
  const n = Math.trunc((SAMPLE_RATE * FRAME_MS) / 1000);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(0.1 * s * Math.sin((2.0 * Math.PI * 220.0 * i) / SAMPLE_RATE));
  }
  return out;
}

function depthTransformer(contextText: string[], contextUserMimi: number[][], contextMoshiMimi: number[][]): number[] {
  void contextText;
  sleep(0.003);
  const rng = mulberry32(contextUserMimi.length + contextMoshiMimi.length);
  const out: number[] = [];
  for (let c = 0; c < CODEBOOKS; c++) {
    out.push(randint(rng, 0, 1023));
  }
  return out;
}

function innerMonologueNextToken(textSoFar: string[], userMimiStream: number[][]): string {
  void userMimiStream;
  sleep(0.002);
  return `tok_${textSoFar.length}`;
}

function simulateUserSpeech(nFrames: number): number[][] {
  const audio: number[][] = [];
  const n = Math.trunc((SAMPLE_RATE * FRAME_MS) / 1000);
  for (let i = 0; i < nFrames; i++) {
    const chunk: number[] = [];
    for (let j = 0; j < n; j++) {
      chunk.push(0.15 * Math.sin((2 * Math.PI * (220 + 20 * i) * j) / SAMPLE_RATE));
    }
    audio.push(chunk);
  }
  return audio;
}

function main(): void {
  console.log(`=== Moshi-style full-duplex simulation: ${FRAME_MS} ms frames, ${CODEBOOKS} codebooks ===`);
  console.log();

  const userAudioStream = simulateUserSpeech(25);
  const userMimi: number[][] = [];
  const moshiMimi: number[][] = [];
  const moshiText: string[] = [];
  const perFrameMs: number[] = [];

  for (const userChunk of userAudioStream) {
    const frameStart = now();

    const userTokens = fakeMimiEncode(userChunk);
    userMimi.push(userTokens);

    const nextText = innerMonologueNextToken(moshiText, userMimi);
    moshiText.push(nextText);

    const nextMoshiTokens = depthTransformer(moshiText, userMimi, moshiMimi);
    moshiMimi.push(nextMoshiTokens);

    const outAudio = fakeMimiDecode(nextMoshiTokens);
    void outAudio;
    const frameMs = (now() - frameStart) * 1000;
    perFrameMs.push(frameMs);
  }

  console.log(`processed ${userAudioStream.length} frames (${userAudioStream.length * FRAME_MS} ms wall audio)`);
  console.log(`  user_mimi:    ${userMimi.length} × ${CODEBOOKS} codebooks`);
  console.log(`  moshi_mimi:   ${moshiMimi.length} × ${CODEBOOKS} codebooks`);
  console.log(`  moshi_text:   ${moshiText.length} tokens   (first 5: [${moshiText.slice(0, 5).map((t) => `'${t}'`).join(", ")}])`);

  console.log();
  console.log("=== per-frame latency ===");
  const avg = perFrameMs.reduce((a, b) => a + b, 0) / perFrameMs.length;
  const p95 = [...perFrameMs].sort((a, b) => a - b)[Math.trunc(perFrameMs.length * 0.95)];
  console.log(`  mean: ${pyFixed(avg, 2)} ms   p95: ${pyFixed(p95, 2)} ms   target: < 80 ms per frame (realtime)`);

  console.log();
  console.log("=== 2026 streaming S2S model cheatsheet ===");
  const rows: [string, string, string, string][] = [
    ["Moshi (Kyutai)", "200 ms L4", "full-duplex dialogue, EN+FR", "CC-BY 4.0"],
    ["Hibiki", "12.5 Hz", "EN↔FR streaming translation", "CC-BY 4.0"],
    ["Hibiki-Zero (Feb 26)", "12.5 Hz", "5 langs, no aligned data", "CC-BY 4.0"],
    ["Sesame CSM-1B", "200 ms", "context-TTS (not full duplex)", "Apache-2.0"],
    ["GPT-4o Realtime", "~300 ms", "closed, API", "commercial"],
    ["Gemini 2.5 Live", "~350 ms", "closed, API", "commercial"],
  ];
  console.log("  | model                | latency   | description                     | license      |");
  for (const [name, lat, desc, lic] of rows) {
    console.log(`  | ${name.padEnd(20)} | ${lat.padEnd(9)} | ${desc.padEnd(30)}  | ${lic.padEnd(12)} |`);
  }

  console.log();
  console.log("takeaways:");
  console.log("  - full-duplex architecture: 2 parallel Mimi streams + text inner-monologue");
  console.log("  - 160 ms theoretical latency floor (80 ms frame + 80 ms acoustic delay)");
  console.log("  - Moshi is best voice-companion; pipelines (lesson 12) still win for tool-use");
  console.log("  - Hibiki is streaming translation; same shape, different training data");
}

main();
