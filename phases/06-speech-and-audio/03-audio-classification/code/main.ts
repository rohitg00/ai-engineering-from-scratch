// Lesson: Audio Classification: From k-NN on MFCCs to AST and BEATs (phase 06 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/03-audio-classification/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/03-audio-classification/code/main.ts

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

function sine(freqHz: number, sr: number, seconds: number, amp = 0.5, phase = 0.0): number[] {
  const n = Math.trunc(sr * seconds);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(amp * Math.sin((2.0 * Math.PI * freqHz * i) / sr + phase));
  }
  return out;
}

function addNoise(signal: number[], sigma = 0.05): number[] {
  return signal.map((s) => s + gauss(0, sigma));
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

function summarize(frames: number[][]): number[] {
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
  return [...mean, ...variance];
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

function knn(q: number[], bank: number[][], labels: string[], k = 3): string {
  const idx = bank
    .map((_, i) => i)
    .map((i) => ({ i, s: -cosine(q, bank[i]) }))
    .sort((p, r) => p.s - r.s)
    .slice(0, k)
    .map((e) => e.i);
  const votes = new Map<string, number>();
  for (const i of idx) {
    votes.set(labels[i], (votes.get(labels[i]) ?? 0) + 1);
  }
  let best = "";
  let bestCount = -1;
  for (const [label, count] of votes) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

function main(): void {
  seed(42);
  const sr = 8000;
  const duration = 0.25;
  const classes: [string, number][] = [
    ["low", 200],
    ["mid_low", 400],
    ["mid_high", 800],
    ["high", 1600],
  ];
  const perClassTrain = 12;
  const perClassTest = 5;

  const xTrain: number[][] = [];
  const yTrain: string[] = [];
  const xTest: number[][] = [];
  const yTest: string[] = [];

  console.log("=== Build synthetic 4-class dataset (pure tones + noise) ===");
  for (const [label, freq] of classes) {
    for (let r = 0; r < perClassTrain; r++) {
      const sig = addNoise(sine(freq, sr, duration));
      xTrain.push(summarize(featurize(sig, sr)));
      yTrain.push(label);
    }
    for (let r = 0; r < perClassTest; r++) {
      const sig = addNoise(sine(freq, sr, duration));
      xTest.push(summarize(featurize(sig, sr)));
      yTest.push(label);
    }
  }
  console.log(`  train: ${xTrain.length}  test: ${xTest.length}`);
  console.log(`  feature dim: ${xTrain[0].length}  (mean+var of 13 MFCC)`);

  console.log();
  console.log("=== k-NN classify (k=3) ===");
  let correct = 0;
  const names = classes.map(([c]) => c);
  const confusion = new Map<string, Map<string, number>>(names.map((c) => [c, new Map<string, number>()]));
  xTest.forEach((feat, t) => {
    const gold = yTest[t];
    const pred = knn(feat, xTrain, yTrain, 3);
    const row = confusion.get(gold) as Map<string, number>;
    row.set(pred, (row.get(pred) ?? 0) + 1);
    if (pred === gold) {
      correct += 1;
    }
  });
  const acc = correct / xTest.length;
  console.log(`  test accuracy: ${pyFixed(acc, 3)} (${correct}/${xTest.length})`);

  console.log();
  console.log("=== Confusion matrix (rows=gold, cols=predicted) ===");
  const header = "  " + names.map((c) => c.slice(0, 8).padStart(10)).join(" ");
  console.log(header);
  for (const gold of names) {
    let row = `  ${gold.slice(0, 8).padStart(8)}`;
    for (const pred of names) {
      row += ` ${String(confusion.get(gold)?.get(pred) ?? 0).padStart(10)}`;
    }
    console.log(row);
  }

  console.log();
  console.log("takeaways:");
  console.log("  - k-NN on mean+var MFCC pool is a surprisingly strong baseline");
  console.log("  - real pipelines use BEATs / AST fine-tune + SpecAugment + mixup");
}

main();
