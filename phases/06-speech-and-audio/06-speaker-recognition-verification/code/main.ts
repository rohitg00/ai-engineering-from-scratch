// Lesson: Speaker Recognition & Verification (phase 06 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/06-speaker-recognition-verification/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/06-speaker-recognition-verification/code/main.ts

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

let rng: Random = mulberry32(0);

function seed(value: number): void {
  rng = mulberry32(value);
}

function gauss(mu: number, sigma: number): number {
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

function pyRound(x: number, d: number): number {
  return parseFloat(pyFixed(x, d));
}

function toneMix(freqs: number[], sr: number, seconds: number, amp = 0.4, noise = 0.02): number[] {
  const n = Math.trunc(sr * seconds);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    let val = 0.0;
    const t = i / sr;
    for (const f of freqs) {
      val += Math.sin(2.0 * Math.PI * f * t);
    }
    val = (amp * val) / Math.max(1, freqs.length);
    val += gauss(0, noise);
    out.push(val);
  }
  return out;
}

function hann(N: number): number[] {
  const out: number[] = [];
  for (let n = 0; n < N; n++) {
    out.push(0.5 * (1.0 - Math.cos((2.0 * Math.PI * n) / (N - 1))));
  }
  return out;
}

function dftMag(x: number[]): number[] {
  const n = x.length;
  const half = Math.floor(n / 2) + 1;
  const out: number[] = [];
  for (let k = 0; k < half; k++) {
    let re = 0.0;
    let im = 0.0;
    for (let j = 0; j < n; j++) {
      const angle = (-2.0 * Math.PI * k * j) / n;
      re += x[j] * Math.cos(angle);
      im += x[j] * Math.sin(angle);
    }
    out.push(Math.sqrt(re * re + im * im));
  }
  return out;
}

function frameSignal(sig: number[], frameLen: number, hop: number): number[][] {
  const n = 1 + Math.max(0, Math.floor((sig.length - frameLen) / hop));
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    out.push(sig.slice(i * hop, i * hop + frameLen));
  }
  return out;
}

function stftMag(sig: number[], frameLen: number, hop: number): number[][] {
  const w = hann(frameLen);
  return frameSignal(sig, frameLen, hop).map((f) => {
    const windowed: number[] = [];
    for (let j = 0; j < frameLen; j++) {
      windowed.push(w[j] * f[j]);
    }
    return dftMag(windowed);
  });
}

function hzToMel(f: number): number {
  return 2595.0 * Math.log10(1.0 + f / 700.0);
}

function melToHz(m: number): number {
  return 700.0 * (10 ** (m / 2595.0) - 1.0);
}

function melFilterbank(nMels: number, nFft: number, sr: number): number[][] {
  const fmin = 0.0;
  const fmax = sr / 2;
  const mels: number[] = [];
  for (let i = 0; i < nMels + 2; i++) {
    mels.push(hzToMel(fmin) + ((hzToMel(fmax) - hzToMel(fmin)) * i) / (nMels + 1));
  }
  const hzs = mels.map(melToHz);
  const half = Math.floor(nFft / 2) + 1;
  const bins = hzs.map((h) => Math.min(half - 1, Math.trunc(pyRound((h * nFft) / sr, 0))));
  const fb: number[][] = [];
  for (let m = 0; m < nMels; m++) {
    fb.push(new Array<number>(half).fill(0.0));
  }
  for (let m = 0; m < nMels; m++) {
    const left = bins[m];
    const center = bins[m + 1];
    const right = bins[m + 2];
    for (let k = left; k < center; k++) {
      fb[m][k] = (k - left) / Math.max(1, center - left);
    }
    for (let k = center; k < right; k++) {
      fb[m][k] = (right - k) / Math.max(1, right - center);
    }
  }
  return fb;
}

function applyFilterbank(spec: number[][], fb: number[][]): number[][] {
  return spec.map((frame) =>
    fb.map((f) => {
      let total = 0;
      f.forEach((w, k) => {
        if (w) {
          total += w * frame[k];
        }
      });
      return total;
    }),
  );
}

function logTransform(x: number[][], eps = 1e-10): number[][] {
  return x.map((row) => row.map((v) => Math.log(Math.max(v, eps))));
}

function dctII(x: number[], nCoeffs: number): number[] {
  const N = x.length;
  const out: number[] = [];
  for (let k = 0; k < nCoeffs; k++) {
    let total = 0;
    for (let n = 0; n < N; n++) {
      total += x[n] * Math.cos((Math.PI * k * (2 * n + 1)) / (2 * N));
    }
    out.push(total);
  }
  return out;
}

function featurize(signal: number[], sr: number, nMfcc = 13, nMels = 40, frameLen = 256, hop = 128): number[][] {
  const mag = stftMag(signal, frameLen, hop);
  const fb = melFilterbank(nMels, frameLen, sr);
  const mels = applyFilterbank(mag, fb);
  const lm = logTransform(mels);
  return lm.map((f) => dctII(f, nMfcc));
}

function l2Normalize(v: number[]): number[] {
  let total = 0;
  for (const x of v) {
    total += x * x;
  }
  const norm = Math.sqrt(total) || 1e-12;
  return v.map((x) => x / norm);
}

function embedMfccStats(signal: number[], sr: number): number[] {
  const frames = featurize(signal, sr);
  const n = frames[0].length;
  const mean: number[] = [];
  const variance: number[] = [];
  for (let i = 0; i < n; i++) {
    let total = 0;
    for (const f of frames) {
      total += f[i];
    }
    mean.push(total / frames.length);
  }
  for (let i = 0; i < n; i++) {
    let total = 0;
    for (const f of frames) {
      total += (f[i] - mean[i]) ** 2;
    }
    variance.push(total / frames.length);
  }
  const std = variance.map((v) => Math.sqrt(v));
  return l2Normalize([...mean, ...std]);
}

function cosine(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    total += a[i] * b[i];
  }
  return total;
}

function eer(sameScores: number[], diffScores: number[]): [number, number] {
  const thresholds = [...new Set([...sameScores, ...diffScores])].sort((a, b) => a - b);
  let bestGap = Infinity;
  let bestFa = 1.0;
  let bestFr = 0.0;
  let bestT = thresholds.length > 0 ? thresholds[0] : 0.0;
  for (const t of thresholds) {
    const fr = sameScores.filter((s) => s < t).length / sameScores.length;
    const fa = diffScores.filter((s) => s >= t).length / diffScores.length;
    const gap = Math.abs(fa - fr);
    if (gap < bestGap) {
      bestGap = gap;
      bestFa = fa;
      bestFr = fr;
      bestT = t;
    }
  }
  return [(bestFa + bestFr) / 2, bestT];
}

function sum(xs: number[]): number {
  let total = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
}

function main(): void {
  seed(123);
  const sr = 8000;
  const duration = 0.4;

  const speakers: [string, number[]][] = [
    ["alice", [200, 400, 600]],
    ["bob", [220, 330, 880]],
    ["carol", [300, 600, 1200]],
    ["dave", [180, 540, 1080]],
    ["eve", [260, 520, 780]],
  ];

  const nPer = 5;
  console.log("=== Enroll 5 synthetic speakers, 5 utterances each ===");
  const enroll = new Map<string, number[][]>();
  for (const [spk, freqs] of speakers) {
    const list: number[][] = [];
    enroll.set(spk, list);
    for (let r = 0; r < nPer; r++) {
      const sig = toneMix(freqs, sr, duration, 0.4, 0.04);
      list.push(embedMfccStats(sig, sr));
    }
    console.log(`  ${spk}: ${list.length} embeddings, dim=${list[0].length}`);
  }

  console.log();
  console.log("=== Build trial pairs (same vs different speaker) ===");
  const sameScores: number[] = [];
  const diffScores: number[] = [];
  const spkList = speakers.map(([s]) => s);
  const get = (s: string): number[][] => enroll.get(s) ?? [];
  for (const spk of spkList) {
    const embs = get(spk);
    for (let i = 0; i < embs.length; i++) {
      for (let j = i + 1; j < embs.length; j++) {
        sameScores.push(cosine(embs[i], embs[j]));
      }
    }
  }
  spkList.forEach((s1, i) => {
    for (const s2 of spkList.slice(i + 1)) {
      for (const e1 of get(s1)) {
        for (const e2 of get(s2)) {
          diffScores.push(cosine(e1, e2));
        }
      }
    }
  });
  console.log(`  same-speaker pairs: ${sameScores.length}  mean cosine: ${pyFixed(sum(sameScores) / sameScores.length, 3)}`);
  console.log(`  diff-speaker pairs: ${diffScores.length}  mean cosine: ${pyFixed(sum(diffScores) / diffScores.length, 3)}`);

  console.log();
  console.log("=== Equal Error Rate ===");
  const [e, t] = eer(sameScores, diffScores);
  console.log(`  EER: ${pyFixed(e * 100, 2)}%   at threshold: ${pyFixed(t, 3)}`);
  console.log("  synthetic speakers are near-orthogonal, so this toy hits 0% EER.");
  console.log("  real ECAPA-TDNN on VoxCeleb1-O lands at 0.87% after training on 2700 speakers.");

  console.log();
  console.log("=== 2026 speaker-verification leaderboard ===");
  const table: [string, number, string][] = [
    ["ReDimNet (2024)", 0.39, "24M"],
    ["WavLM-SV large", 0.42, "316M"],
    ["Pyannote 3.1", 0.65, "6M"],
    ["ECAPA-TDNN", 0.87, "15M"],
    ["x-vector (classic)", 3.1, "5M"],
  ];
  console.log("  | Model              | EER  | Params |");
  for (const [name, er, p] of table) {
    console.log(`  | ${name.padEnd(18)} | ${pyFixed(er, 2)} | ${p.padEnd(6)} |`);
  }
}

main();
