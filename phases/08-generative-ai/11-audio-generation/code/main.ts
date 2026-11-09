// Lesson: Audio Generation (phase 08 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/08-generative-ai/11-audio-generation/docs/en.md
// Run: npx tsx phases/08-generative-ai/11-audio-generation/code/main.ts

class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  random(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  randint(a: number, b: number): number {
    return a + Math.floor(this.random() * (b - a + 1));
  }
}

const VOCAB = 16;
const NUM_STYLES = 2;

type Counts = number[][][];

function pyFloat(x: number): string {
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function makeTokens(style: number, length: number, rng: Random): number[] {
  const out: number[] = [];
  if (style === 0) {
    for (let i = 0; i < length; i++) out.push((i + rng.randint(0, 1)) % VOCAB);
    return out;
  }
  for (let i = 0; i < length; i++) out.push((i * 3 + rng.randint(0, 1)) % VOCAB);
  return out;
}

function initCounts(): Counts {
  return Array.from({ length: NUM_STYLES }, () =>
    Array.from({ length: VOCAB }, () => new Array<number>(VOCAB).fill(1.0)),
  );
}

function updateCounts(counts: Counts, sequence: number[], style: number): void {
  for (let i = 0; i < sequence.length - 1; i++) counts[style][sequence[i]][sequence[i + 1]] += 1.0;
}

function probs(counts: Counts, style: number, prevTok: number): number[] {
  const row = counts[style][prevTok];
  let total = 0;
  for (const x of row) total += x;
  return row.map((x) => x / total);
}

function entropy(p: number[]): number {
  let s = 0;
  for (const pi of p) s += pi * Math.log(Math.max(pi, 1e-10));
  return -s;
}

function sampleFrom(p: number[], rng: Random): number {
  const r = rng.random();
  let acc = 0.0;
  for (let i = 0; i < p.length; i++) {
    acc += p[i];
    if (r <= acc) return i;
  }
  return p.length - 1;
}

function generate(counts: Counts, style: number, start: number, length: number, rng: Random, temperature = 1.0): number[] {
  const out = [start];
  for (let k = 0; k < length - 1; k++) {
    let p = probs(counts, style, out[out.length - 1]);
    if (temperature !== 1.0) {
      p = p.map((pi) => pi ** (1 / temperature));
      let total = 0;
      for (const x of p) total += x;
      p = p.map((x) => x / total);
    }
    out.push(sampleFrom(p, rng));
  }
  return out;
}

function listRepr(xs: number[]): string {
  return `[${xs.join(", ")}]`;
}

function main(): void {
  const rng = new Random(42);
  const counts = initCounts();

  console.log("=== training codec-token bigram per style on 500 sequences each ===");
  for (let k = 0; k < 500; k++) {
    for (let style = 0; style < NUM_STYLES; style++) {
      const seq = makeTokens(style, 20, rng);
      updateCounts(counts, seq, style);
    }
  }

  console.log();
  console.log("=== generate 20 tokens per style, start=0 ===");
  for (let style = 0; style < NUM_STYLES; style++) {
    const label = style === 0 ? "speech-like (alternating)" : "music-like (ramp)";
    console.log(`\nstyle ${style}: ${label}`);
    for (const temp of [0.7, 1.0]) {
      const out = generate(counts, style, 0, 20, rng, temp);
      console.log(`  temp ${temp.toFixed(1)}: ${listRepr(out)}`);
    }
  }

  console.log();
  console.log("=== entropy at each position for style 0 conditional on token 5 ===");
  const p = probs(counts, 0, 5);
  const top3 = Array.from({ length: VOCAB }, (_, i) => i)
    .sort((a, b) => -p[a] - -p[b])
    .slice(0, 3);
  console.log(`  p(next | style=0, prev=5): H = ${entropy(p).toFixed(3)}`);
  console.log(`  top-3: [${top3.map((i) => `(${i}, ${pyFloat(Number(p[i].toFixed(3)))})`).join(", ")}]`);

  console.log();
  console.log("=== VALL-E-style prompt continuation ===");
  const prompt = makeTokens(0, 5, rng).slice(0, 5);
  console.log(`  3-second voice prompt (tokens): ${listRepr(prompt)}`);
  const continuation = [...prompt];
  for (let k = 0; k < 15; k++) {
    const q = probs(counts, 0, continuation[continuation.length - 1]);
    continuation.push(sampleFrom(q, rng));
  }
  console.log(`  continuation: ${listRepr(continuation)}`);

  console.log();
  console.log("takeaway: tokens + transformer = entire TTS / music generation substrate.");
  console.log("          RVQ of Encodec / DAC makes real audio fit in the same loop.");
}

main();
