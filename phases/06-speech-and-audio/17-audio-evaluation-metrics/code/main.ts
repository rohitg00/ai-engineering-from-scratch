// Lesson: Audio Evaluation: WER, MOS, UTMOS, MMAU, FAD, and the Open Leaderboards (phase 06 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/17-audio-evaluation-metrics/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/17-audio-evaluation-metrics/code/main.ts

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

function pyStr(s: string): string {
  if (s.includes("'") && !s.includes('"')) {
    return `"${s}"`;
  }
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function sum(xs: number[]): number {
  let total = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
}

function editDistance(aTokens: string[], bTokens: string[]): number {
  const dp: number[][] = [];
  for (let i = 0; i <= aTokens.length; i++) {
    dp.push(new Array<number>(bTokens.length + 1).fill(0));
  }
  for (let i = 0; i <= aTokens.length; i++) {
    dp[i][0] = i;
  }
  for (let j = 0; j <= bTokens.length; j++) {
    dp[0][j] = j;
  }
  for (let i = 1; i <= aTokens.length; i++) {
    for (let j = 1; j <= bTokens.length; j++) {
      const cost = aTokens[i - 1] === bTokens[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[aTokens.length][bTokens.length];
}

function normalize(input: string): string {
  let text = input.toLowerCase();
  text = text.replace(/[^a-z0-9\s]/g, "");
  text = text.replace(/\s+/g, " ").trim();
  return text;
}

function splitWords(s: string): string[] {
  return s.split(/\s+/).filter((w) => w.length > 0);
}

function wer(ref: string, hyp: string): number {
  const r = splitWords(normalize(ref));
  const h = splitWords(normalize(hyp));
  return editDistance(r, h) / Math.max(1, r.length);
}

function cer(ref: string, hyp: string): number {
  return editDistance([...ref], [...hyp]) / Math.max(1, [...ref].length);
}

function eerFromScores(same: number[], diff: number[]): [number, number] {
  const thresholds = [...new Set([...same, ...diff])].sort((a, b) => a - b);
  let best: [number, number, number, number] = [1.0, 0.0, 0.0, 0.0];
  for (const t of thresholds) {
    const far = diff.filter((s) => s >= t).length / Math.max(1, diff.length);
    const frr = same.filter((s) => s < t).length / Math.max(1, same.length);
    if (Math.abs(far - frr) < best[0]) {
      best = [Math.abs(far - frr), t, far, frr];
    }
  }
  const [, t, far, frr] = best;
  return [(far + frr) / 2, t];
}

function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    dot += a[i] * b[i];
  }
  const na = Math.sqrt(sum(a.map((x) => x * x))) || 1e-12;
  const nb = Math.sqrt(sum(b.map((x) => x * x))) || 1e-12;
  return dot / (na * nb);
}

function embeddingFadLike(realEmbeds: number[][], fakeEmbeds: number[][]): number {
  const meanVar = (embs: number[][]): [number[], number[]] => {
    const n = embs[0].length;
    const mean: number[] = [];
    const variance: number[] = [];
    for (let i = 0; i < n; i++) {
      mean.push(sum(embs.map((e) => e[i])) / embs.length);
    }
    for (let i = 0; i < n; i++) {
      variance.push(sum(embs.map((e) => (e[i] - mean[i]) ** 2)) / embs.length);
    }
    return [mean, variance];
  };
  const [muR, vR] = meanVar(realEmbeds);
  const [muF, vF] = meanVar(fakeEmbeds);
  let meanDist = 0;
  for (let i = 0; i < Math.min(muR.length, muF.length); i++) {
    meanDist += (muR[i] - muF[i]) ** 2;
  }
  let varDist = 0;
  for (let i = 0; i < Math.min(vR.length, vF.length); i++) {
    varDist += (Math.sqrt(vR[i]) - Math.sqrt(vF[i])) ** 2;
  }
  return Math.sqrt(meanDist + varDist);
}

function mmauAccuracy(predictions: string[], golds: string[]): number {
  let correct = 0;
  for (let i = 0; i < Math.min(predictions.length, golds.length); i++) {
    if (predictions[i] === golds[i]) {
      correct += 1;
    }
  }
  return correct / Math.max(1, predictions.length);
}

function main(): void {
  console.log("=== WER + CER ===");
  const pairs: [string, string][] = [
    ["turn on the kitchen lights", "turn off the kitchen lights"],
    ["what's the weather today", "what is the weather today"],
    ["play jazz", "play jazz"],
    ["set a 5 minute timer", "set a five minute timer"],
  ];
  for (const [ref, hyp] of pairs) {
    console.log(`  ref: ${pyStr(ref)}`);
    console.log(`  hyp: ${pyStr(hyp)}`);
    console.log(`    WER = ${pyFixed(wer(ref, hyp), 3)}   CER = ${pyFixed(cer(ref, hyp), 3)}`);
  }

  console.log();
  console.log("=== EER (toy speaker verification) ===");
  const rng = mulberry32(0);
  const same: number[] = [];
  for (let i = 0; i < 100; i++) {
    same.push(gaussFrom(rng, 0.8, 0.06));
  }
  const diff: number[] = [];
  for (let i = 0; i < 500; i++) {
    diff.push(gaussFrom(rng, 0.2, 0.15));
  }
  const [eer, t] = eerFromScores(same, diff);
  console.log(`  same mean cos: ${pyFixed(sum(same) / same.length, 3)}`);
  console.log(`  diff mean cos: ${pyFixed(sum(diff) / diff.length, 3)}`);
  console.log(`  EER = ${pyFixed(eer * 100, 2)}%   at threshold ${pyFixed(t, 3)}`);

  console.log();
  console.log("=== SECS (toy voice-cloning similarity) ===");
  const refEmb: number[] = [];
  for (let i = 0; i < 192; i++) {
    refEmb.push(gaussFrom(rng, 0, 0.1));
  }
  const cloneEmb = refEmb.map((v) => v + gaussFrom(rng, 0, 0.1));
  const secs = cosine(refEmb, cloneEmb);
  console.log(`  SECS = ${pyFixed(secs, 3)}   (target: > 0.75 for recognizable clone)`);

  console.log();
  console.log("=== FAD-shaped embedding distance ===");
  const realEmbs: number[][] = [];
  for (let r = 0; r < 50; r++) {
    const row: number[] = [];
    for (let i = 0; i < 32; i++) {
      row.push(gaussFrom(rng, 0, 1.0));
    }
    realEmbs.push(row);
  }
  const fakeEmbs: number[][] = [];
  for (let r = 0; r < 50; r++) {
    const row: number[] = [];
    for (let i = 0; i < 32; i++) {
      row.push(gaussFrom(rng, 0.1, 1.1));
    }
    fakeEmbs.push(row);
  }
  const fad = embeddingFadLike(realEmbs, fakeEmbs);
  console.log(`  FAD-like = ${pyFixed(fad, 3)}   (MusicGen-small on MusicCaps: 4.5)`);

  console.log();
  console.log("=== MMAU-Pro-style multiple-choice accuracy ===");
  const predictions = ["A", "C", "B", "A", "D", "C", "B", "A", "A", "C"];
  const golds = ["A", "B", "B", "A", "D", "A", "B", "A", "C", "C"];
  const acc = mmauAccuracy(predictions, golds);
  console.log(`  accuracy = ${pyFixed(acc, 3)}  (random on 4-way: 0.250)`);

  console.log();
  console.log("=== 2026 benchmarks worth knowing ===");
  const rows: [string, string, string][] = [
    ["Open ASR Leaderboard", "LibriSpeech + multilingual", "Parakeet-TDT 6.05%, Whisper-LV3-turbo 1.58%"],
    ["TTS Arena", "blind pairwise TTS", "Kokoro ELO 1059, ElevenLabs v3 1179"],
    ["Artificial Analysis Speech", "TTS + STT arena", "Inworld TTS-1.5-Max ELO 1236 leader"],
    ["MMAU-Pro", "LALM reasoning", "Gemini 2.5 Pro ~60%, GPT-4o Audio 52.5%"],
    ["LongAudioBench", "multi-minute LALM", "Audio Flamingo Next beats Gemini 2.5 Pro"],
    ["VoxCeleb1-O", "speaker verification EER", "ECAPA 0.87%, 3D-Speaker 0.50%"],
    ["AudioSet mAP", "multi-label classification", "BEATs-iter3 0.548 mAP"],
    ["ASVspoof 5", "anti-spoofing EER", "SOTA ~7.23% on in-the-wild"],
  ];
  console.log("  | leaderboard              | axis                      | 2026 SOTA                                   |");
  for (const [name, axis, sota] of rows) {
    console.log(`  | ${name.padEnd(24)} | ${axis.padEnd(25)} | ${sota.padEnd(43)} |`);
  }

  console.log();
  console.log("takeaways:");
  console.log("  - every task has 2-3 primary metrics; choose BEFORE training");
  console.log("  - normalize text before computing WER/CER; report the normalization");
  console.log("  - report P50/P95/P99 for latency, per-class for classification, per-category for MMAU");
  console.log("  - public benchmark + your own held-out domain set = both, always");
}

main();
