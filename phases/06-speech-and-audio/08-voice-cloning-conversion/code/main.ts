// Lesson: Voice Cloning & Voice Conversion (phase 06 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/08-voice-cloning-conversion/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/08-voice-cloning-conversion/code/main.ts

import { createHash } from "node:crypto";

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

function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (const ch of Buffer.from(s, "utf8")) {
    h = Math.imul(h ^ ch, 0x01000193) >>> 0;
  }
  return h;
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

function contentVector(text: string, dim = 64): number[] {
  const h = createHash("sha256").update(text, "utf8").digest();
  const reps = Math.floor((dim + h.length - 1) / h.length);
  const expanded: number[] = [];
  for (let r = 0; r < reps; r++) {
    expanded.push(...h);
  }
  return expanded.slice(0, dim).map((b) => b / 255.0 - 0.5);
}

function speakerVector(seed: string, dim = 64): number[] {
  const rng = mulberry32(seedFromString(seed));
  const v: number[] = [];
  for (let i = 0; i < dim; i++) {
    v.push(gaussFrom(rng, 0, 1));
  }
  let total = 0;
  for (const x of v) {
    total += x * x;
  }
  const norm = Math.sqrt(total) || 1e-12;
  return v.map((x) => x / norm);
}

function fakeTts(content: number[], speaker: number[], mix = 0.5): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.min(content.length, speaker.length); i++) {
    out.push((1 - mix) * content[i] + mix * speaker[i]);
  }
  return out;
}

function bestMatch(wave: number[], refs: Map<string, number[]>): [string, number] {
  const sims: [string, number][] = [...refs].map(([name, vec]) => [name, cosine(wave, vec)]);
  sims.sort((a, b) => -a[1] - -b[1]);
  return sims[0];
}

function extractSpeaker(wave: number[], referenceSpeakers: Map<string, number[]>): [string, number] {
  return bestMatch(wave, referenceSpeakers);
}

function extractContent(wave: number[], referenceContents: Map<string, number[]>): [string, number] {
  return bestMatch(wave, referenceContents);
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
  }
  for (const x of a) {
    sa += x * x;
  }
  for (const x of b) {
    sb += x * x;
  }
  const na = Math.sqrt(sa) || 1e-12;
  const nb = Math.sqrt(sb) || 1e-12;
  return dot / (na * nb);
}

function watermark(wave: number[], payloadBits: number[], strength = 0.003): number[] {
  const nBits = payloadBits.length;
  const out = [...wave];
  for (let i = 0; i < out.length; i++) {
    const bitIdx = i % nBits;
    const sign = payloadBits[bitIdx] ? 1 : -1;
    out[i] += sign * strength;
  }
  return out;
}

function detectWatermark(waveOriginal: number[], waveWm: number[], nBits = 32): number[] {
  const diff: number[] = [];
  for (let i = 0; i < Math.min(waveOriginal.length, waveWm.length); i++) {
    diff.push(waveWm[i] - waveOriginal[i]);
  }
  const bits: number[] = [];
  for (let b = 0; b < nBits; b++) {
    const chunk = diff.filter((_, i) => i >= b && (i - b) % nBits === 0);
    let total = 0;
    for (const x of chunk) {
      total += x;
    }
    const avg = total / Math.max(1, chunk.length);
    bits.push(avg > 0 ? 1 : 0);
  }
  return bits;
}

function bitAccuracy(a: number[], b: number[]): number {
  let same = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) {
      same += 1;
    }
  }
  return same / a.length;
}

function main(): void {
  const DIM = 64;

  const alice = speakerVector("alice_00001", DIM);
  const bob = speakerVector("bob_00002", DIM);
  const carol = speakerVector("carol_00003", DIM);
  const speakers = new Map<string, number[]>([
    ["alice", alice],
    ["bob", bob],
    ["carol", carol],
  ]);

  const textGreet = "hello this is a test";
  const textRemind = "please remember to water plants";
  const contentGreet = contentVector(textGreet, DIM);
  const contentRemind = contentVector(textRemind, DIM);
  const contents = new Map<string, number[]>([
    [textGreet, contentGreet],
    [textRemind, contentRemind],
  ]);

  console.log("=== Step 1: synthesize alice saying 'hello' ===");
  const wavAliceGreet = fakeTts(contentGreet, alice, 0.5);
  let [name, score] = extractSpeaker(wavAliceGreet, speakers);
  let [txt, tscore] = extractContent(wavAliceGreet, contents);
  console.log(`  speaker probe: ${name} (cos=${pyFixed(score, 3)})`);
  console.log(`  content probe: '${txt}' (cos=${pyFixed(tscore, 3)})`);

  console.log();
  console.log("=== Step 2: zero-shot clone: alice's voice on bob's intended text ===");
  const wavCloned = fakeTts(contentRemind, alice, 0.5);
  [name, score] = extractSpeaker(wavCloned, speakers);
  [txt, tscore] = extractContent(wavCloned, contents);
  console.log(`  speaker probe: ${name} (cos=${pyFixed(score, 3)})  -- should stay alice`);
  console.log(`  content probe: '${txt}' (cos=${pyFixed(tscore, 3)})  -- should be remind text`);

  console.log();
  console.log("=== Step 3: voice conversion: rewrite bob's utterance into alice ===");
  const wavBobOrig = fakeTts(contentRemind, bob, 0.5);
  const [matchedText] = extractContent(wavBobOrig, contents);
  const contentEst = contents.get(matchedText) ?? [];
  const wavConverted = fakeTts(contentEst, alice, 0.5);
  [name, score] = extractSpeaker(wavConverted, speakers);
  console.log(`  post-conversion speaker: ${name} (cos=${pyFixed(score, 3)})  -- should be alice`);
  console.log(`  content preserved:  '${matchedText}'`);

  console.log();
  console.log("=== Step 4: SECS: speaker cosine similarity of clone ===");
  const secsSame = cosine(alice, wavCloned);
  const secsDiff = cosine(bob, wavCloned);
  console.log(`  alice (target) vs clone  SECS = ${pyFixed(secsSame, 3)}  (should be high)`);
  console.log(`  bob (not target) vs clone SECS = ${pyFixed(secsDiff, 3)}  (should be low)`);
  console.log("  production ECAPA-TDNN on real clones lands SECS in 0.65 - 0.78 range.");

  console.log();
  console.log("=== Step 5: watermark + detect ===");
  const payload = [...(0xdeadbeef).toString(2).padStart(32, "0")].map((b) => parseInt(b, 10));
  const wm = watermark(wavCloned, payload);
  const detected = detectWatermark(wavCloned, wm, 32);
  const acc = bitAccuracy(payload, detected);
  console.log(`  payload:   ${payload.join("")}`);
  console.log(`  detected:  ${detected.join("")}`);
  console.log(`  bit accuracy: ${pyFixed(acc * 100, 1)}%   (real SilentCipher: ~99% across MP3 re-encode)`);

  console.log();
  console.log("=== Step 6: 2026 cloning leaderboard ===");
  const table: [string, number, number, string][] = [
    ["VoiceBox", 0.78, 2.1, "330M"],
    ["VALL-E 2", 0.77, 2.4, "370M"],
    ["F5-TTS", 0.72, 2.1, "335M"],
    ["OpenVoice v2", 0.7, 2.8, "220M"],
    ["XTTS v2", 0.65, 3.5, "470M"],
  ];
  console.log("  | Model          | SECS  | CER%  | Size |");
  for (const [n, s, c, p] of table) {
    console.log(`  | ${n.padEnd(14)} | ${pyFixed(s, 2)}  | ${pyFixed(c, 1)}   | ${p.padEnd(4)} |`);
  }
}

main();
