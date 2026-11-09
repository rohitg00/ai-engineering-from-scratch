// Lesson: Neural Audio Codecs: EnCodec, SNAC, Mimi, DAC and the Semantic-Acoustic Split (phase 06 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/13-neural-audio-codecs/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/13-neural-audio-codecs/code/main.ts

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

function generateSignal(n = 1000, seed = 0): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Math.sin((2 * Math.PI * i) / 100) + 0.3 * gaussFrom(rng, 0, 1.0));
  }
  return out;
}

function nearest(codebook: number[], v: number): number {
  let best = 0;
  for (let i = 1; i < codebook.length; i++) {
    if (Math.abs(codebook[i] - v) < Math.abs(codebook[best] - v)) {
      best = i;
    }
  }
  return best;
}

function learnCodebook(values: number[], size: number, iterations = 20, seed = 0): number[] {
  const rng = mulberry32(seed);
  if (values.length === 0) {
    return new Array<number>(size).fill(0.0);
  }
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const centroids: number[] = [];
  for (let i = 0; i < size; i++) {
    centroids.push(lo + (hi - lo) * rng());
  }
  for (let it = 0; it < iterations; it++) {
    const buckets: number[][] = [];
    for (let i = 0; i < size; i++) {
      buckets.push([]);
    }
    for (const v of values) {
      buckets[nearest(centroids, v)].push(v);
    }
    for (let i = 0; i < size; i++) {
      if (buckets[i].length > 0) {
        let total = 0;
        for (const x of buckets[i]) {
          total += x;
        }
        centroids[i] = total / buckets[i].length;
      }
    }
  }
  return [...centroids].sort((a, b) => a - b);
}

function quantizeWithCodebook(values: number[], codebook: number[]): [number[], number[]] {
  const indices: number[] = [];
  const residuals: number[] = [];
  for (const v of values) {
    const idx = nearest(codebook, v);
    indices.push(idx);
    residuals.push(v - codebook[idx]);
  }
  return [indices, residuals];
}

function rvqEncode(values: number[], codebookSize = 8, nCodebooks = 4): [number[][], number[][]] {
  let residuals = [...values];
  const codebooks: number[][] = [];
  const allIndices: number[][] = [];
  for (let cbI = 0; cbI < nCodebooks; cbI++) {
    const cb = learnCodebook(residuals, codebookSize, 20, cbI);
    codebooks.push(cb);
    const [indices, next] = quantizeWithCodebook(residuals, cb);
    residuals = next;
    allIndices.push(indices);
  }
  return [allIndices, codebooks];
}

function rvqDecode(allIndices: number[][], codebooks: number[][], length: number): number[] {
  const out = new Array<number>(length).fill(0.0);
  for (let c = 0; c < Math.min(allIndices.length, codebooks.length); c++) {
    allIndices[c].forEach((idx, i) => {
      out[i] += codebooks[c][idx];
    });
  }
  return out;
}

function mse(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    total += (a[i] - b[i]) ** 2;
  }
  return total / a.length;
}

function main(): void {
  console.log("=== Step 1: generate signal ===");
  const sig = generateSignal(1000);
  let sum = 0;
  for (const x of sig) {
    sum += x;
  }
  console.log(`  length: ${sig.length}   range: [${pyFixed(Math.min(...sig), 2)}, ${pyFixed(Math.max(...sig), 2)}]   mean: ${pyFixed(sum / sig.length, 3)}`);

  console.log();
  console.log("=== Step 2: RVQ reconstruction error vs codebook count ===");
  console.log("  codebook_size = 8   values per codebook");
  console.log("  | # codebooks | bits/frame | MSE        | bitrate @ 50 fps |");

  for (const nCb of [1, 2, 4, 8, 12]) {
    const [indices, codebooks] = rvqEncode(sig, 8, nCb);
    const recon = rvqDecode(indices, codebooks, sig.length);
    const err = mse(sig, recon);
    const bitsPerFrame = nCb * 3;
    const bitrate = bitsPerFrame * 50;
    console.log(`  | ${String(nCb).padStart(11)} | ${String(bitsPerFrame).padStart(10)} | ${pyFixed(err, 6)}   | ${String(bitrate).padStart(5)} bps       |`);
  }

  console.log();
  console.log("=== Step 3: 2026 codec comparison (speech @ 6 kbps) ===");
  const rows: [string, string, string, string][] = [
    ["EnCodec-24k", "75 Hz", "3.2 PESQ", "general audio, MusicGen"],
    ["DAC-44.1k", "86 Hz", "3.5 PESQ", "highest fidelity"],
    ["SNAC-24k", "~12 Hz", "3.3 PESQ", "multi-scale, AR-LM"],
    ["Mimi", "12.5 Hz", "3.1 PESQ", "semantic+acoustic, Moshi"],
  ];
  console.log("  | codec        | frame rate | quality    | use case                 |");
  for (const [name, fr, q, u] of rows) {
    console.log(`  | ${name.padEnd(12)} | ${fr.padEnd(10)} | ${q.padEnd(10)} | ${u.padEnd(24)} |`);
  }

  console.log();
  console.log("=== Step 4: semantic vs acoustic tokens (Mimi, conceptually) ===");
  console.log("  codebook 0  →  distilled from WavLM  →  content (what was said)");
  console.log("  codebook 1-7 → acoustic residuals    →  timbre, speaker, noise");
  console.log();
  console.log("  LM generates codebook 0 first (text → semantic), then");
  console.log("  generates codebook 1-7 conditioned on semantic + speaker ref");
  console.log("  = factorized generation that cleanly supports voice cloning");

  console.log();
  console.log("takeaways:");
  console.log("  - RVQ: cascade of small codebooks > one giant codebook");
  console.log("  - semantic/acoustic split (Mimi, AudioLM) is the 2024-2026 shift");
  console.log("  - 12.5 Hz Mimi × 8 codebooks = 1000 tokens per 10 s clip");
  console.log("  - that's why transformer LM over audio finally works at 2026 scale");
}

main();
