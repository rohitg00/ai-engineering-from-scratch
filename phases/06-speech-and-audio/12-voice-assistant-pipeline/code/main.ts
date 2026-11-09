// Lesson: Build a Voice Assistant Pipeline: The Phase 6 Capstone (phase 06 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/12-voice-assistant-pipeline/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/12-voice-assistant-pipeline/code/main.ts

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

function gaussFrom(rng: Random, mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 <= 0) {
    u1 = rng();
  }
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
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

function pyFloat(x: number): string {
  if (Number.isNaN(x)) {
    return "nan";
  }
  if (!Number.isFinite(x)) {
    return x > 0 ? "inf" : "-inf";
  }
  if (x === 0) {
    return Object.is(x, -0) ? "-0.0" : "0.0";
  }
  const [mant, expStr] = x.toExponential().split("e");
  const exp = parseInt(expStr, 10);
  const neg = mant.startsWith("-");
  const digits = mant.replace("-", "").replace(".", "");
  let body: string;
  if (exp >= -4 && exp < 16) {
    if (exp >= 0) {
      const intPart = digits.slice(0, exp + 1).padEnd(exp + 1, "0");
      const frac = digits.slice(exp + 1);
      body = `${intPart}.${frac || "0"}`;
    } else {
      body = `0.${"0".repeat(-exp - 1)}${digits}`;
    }
  } else {
    const frac = digits.slice(1);
    body = `${digits[0]}${frac ? "." + frac : ""}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return (neg ? "-" : "") + body;
}

type PyValue = string | number | boolean | PyValue[] | { [key: string]: PyValue };

function pyRepr(v: PyValue): string {
  if (typeof v === "string") {
    return `'${v}'`;
  }
  if (typeof v === "boolean") {
    return v ? "True" : "False";
  }
  if (typeof v === "number") {
    return Number.isInteger(v) ? String(v) : pyFloat(v);
  }
  if (Array.isArray(v)) {
    return `[${v.map(pyRepr).join(", ")}]`;
  }
  return `{${Object.entries(v).map(([k, x]) => `'${k}': ${pyRepr(x)}`).join(", ")}}`;
}

const sleepCell = new Int32Array(new SharedArrayBuffer(4));

function sleep(seconds: number): void {
  Atomics.wait(sleepCell, 0, 0, seconds * 1000);
}

function now(): number {
  return (performance.timeOrigin + performance.now()) / 1000;
}

interface ToolCall {
  name: string;
  args: { [key: string]: number };
}

interface LlmResponse {
  tool_calls: ToolCall[];
  text: string;
}

function* micGenerator(durationS = 2.0, sr = 16000, chunkMs = 20, speechMask: boolean[] | null = null): Generator<[number[], boolean]> {
  const rng = mulberry32(0);
  const nChunks = Math.trunc((durationS * 1000) / chunkMs);
  const mask = speechMask ?? [...new Array<boolean>(5).fill(false), ...new Array<boolean>(60).fill(true), ...new Array<boolean>(20).fill(false)];
  for (let i = 0; i < Math.min(nChunks, mask.length); i++) {
    const isSpeech = mask[i];
    const n = Math.trunc((sr * chunkMs) / 1000);
    const chunk: number[] = [];
    for (let j = 0; j < n; j++) {
      chunk.push((isSpeech ? 0.2 : 0.003) * gaussFrom(rng, 0, 1.0));
    }
    yield [chunk, isSpeech];
  }
}

function vad(chunk: number[], thresholdDbfs = -35.0): boolean {
  let total = 0;
  for (const x of chunk) {
    total += x * x;
  }
  const rms = (total / chunk.length) ** 0.5;
  return 20.0 * Math.log10(Math.max(rms, 1e-10)) > thresholdDbfs;
}

function streamingStt(utterance: number[], sr = 16000): string {
  sleep(0.08 + (utterance.length / sr) * 0.05);
  return "set a timer for five minutes";
}

function llmWithTools(transcript: string): LlmResponse {
  sleep(0.12);
  if (transcript.includes("timer")) {
    return {
      tool_calls: [{ name: "set_timer", args: { seconds: 300 } }],
      text: "Sure, setting a 5 minute timer.",
    };
  }
  return { tool_calls: [], text: "OK." };
}

function dispatchTool(name: string, args: { [key: string]: number }): { [key: string]: PyValue } {
  sleep(0.01);
  if (name === "set_timer") {
    return { ok: true, expires_at: now() + args.seconds };
  }
  return { ok: false };
}

function streamingTts(text: string): string[] {
  sleep(0.1);
  return text.split(/\s+/).filter((w) => w.length > 0).map((word) => `(audio chunk: ${word})`);
}

function play(audioChunks: string[]): void {
  for (let i = 0; i < audioChunks.length; i++) {
    sleep(0.02);
  }
}

function main(): void {
  console.log("=== Step 1: capture turn via VAD gating ===");
  const buffered: number[] = [];
  const preRoll: number[][] = [];
  let triggered = false;
  let silentMs = 0;
  const turnStart = now();
  for (const [chunk] of micGenerator()) {
    preRoll.push(chunk);
    if (preRoll.length > 15) {
      preRoll.shift();
    }
    if (vad(chunk)) {
      if (!triggered) {
        for (const c of preRoll) {
          buffered.push(...c);
        }
        triggered = true;
      }
      buffered.push(...chunk);
      silentMs = 0;
    } else if (triggered) {
      silentMs += 20;
      buffered.push(...chunk);
      if (silentMs >= 400) {
        break;
      }
    }
  }
  const tCapture = (now() - turnStart) * 1000;
  console.log(`  captured ${buffered.length} samples (${pyFixed(buffered.length / 16000, 3)} s) in ${pyFixed(tCapture, 0)} ms wall time`);

  console.log();
  console.log("=== Step 2: streaming STT ===");
  let t0 = now();
  const text = streamingStt(buffered);
  const tStt = (now() - t0) * 1000;
  console.log(`  transcript: '${text}'   stt latency: ${pyFixed(tStt, 1)} ms`);

  console.log();
  console.log("=== Step 3: LLM with tool calling ===");
  t0 = now();
  const response = llmWithTools(text);
  const tLlm = (now() - t0) * 1000;
  const calls: PyValue = response.tool_calls.map((c) => ({ name: c.name, args: c.args }));
  console.log(`  tool_calls: ${pyRepr(calls)}`);
  for (const call of response.tool_calls) {
    const result = dispatchTool(call.name, call.args);
    console.log(`  ${call.name}(${pyRepr(call.args)}) → ${pyRepr(result)}`);
  }
  console.log(`  reply text: '${response.text}'   llm latency: ${pyFixed(tLlm, 1)} ms`);

  console.log();
  console.log("=== Step 4: streaming TTS + playback ===");
  t0 = now();
  const audio = streamingTts(response.text);
  const tTtsTtfa = (now() - t0) * 1000;
  console.log(`  TTFA: ${pyFixed(tTtsTtfa, 1)} ms    audio chunks: ${audio.length}`);
  t0 = now();
  play(audio);
  const tPlay = (now() - t0) * 1000;
  void tPlay;

  console.log();
  console.log("=== Step 5: end-to-end budget ===");
  const stages: [string, number][] = [
    ["VAD + capture (after end-of-speech)", silentMs],
    ["STT", tStt],
    ["LLM + tool", tLlm],
    ["TTS TTFA", tTtsTtfa],
  ];
  let total = 0;
  for (const [, ms] of stages) {
    total += ms;
  }
  for (const [name, ms] of stages) {
    const bar = "#".repeat(Math.trunc(ms / 10));
    console.log(`  ${name.padEnd(40)} ${pyFixed(ms, 1).padStart(6)} ms  ${bar}`);
  }
  console.log(`  TOTAL user-perceived (to first audio): ${pyFixed(total, 1)} ms   (target: < 800 ms)`);

  console.log();
  console.log("=== Step 6: 2026 reference stacks ===");
  const stacks: [string, string, string][] = [
    ["LiveKit + Deepgram + GPT-4o + Cartesia", "350-500 ms", "industry default"],
    ["Pipecat + Whisper-stream + GPT-4o + Kokoro", "500-800 ms", "DIY-friendly"],
    ["Moshi (full-duplex single model)", "200-300 ms", "see lesson 15"],
    ["Vapi / Retell (managed)", "300-500 ms", "fastest to ship"],
    ["whisper.cpp + llama.cpp + Kokoro-ONNX", "offline", "edge / privacy"],
  ];
  for (const [s, lat, note] of stacks) {
    console.log(`  ${s.padEnd(46)} ${lat.padEnd(12)} ${note}`);
  }
}

main();
