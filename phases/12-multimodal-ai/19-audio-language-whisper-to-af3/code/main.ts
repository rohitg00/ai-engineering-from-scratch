// Lesson: Audio-Language Models: the Whisper to Audio Flamingo 3 Arc (phase 12 / lesson 19)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/19-audio-language-whisper-to-af3/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/19-audio-language-whisper-to-af3/code/main.ts

export {};

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

const rng = mulberry32(6);

function gauss(mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 === 0) u1 = rng();
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function pyFloat(x: number): string {
  if (Object.is(x, -0)) return "-0.0";
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function synthWaveform(durationS = 1.0, sr = 16000): number[] {
  const n = Math.trunc(durationS * sr);
  const freq = 440;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(0.5 * Math.sin((2 * Math.PI * freq * i) / sr) + 0.2 * Math.sin((2 * Math.PI * 880 * i) / sr));
  }
  return out;
}

function windowFrames(x: number[], sr: number, winMs = 25, hopMs = 10): number[][] {
  const win = Math.trunc((sr * winMs) / 1000);
  const hop = Math.trunc((sr * hopMs) / 1000);
  const frames: number[][] = [];
  let i = 0;
  while (i + win <= x.length) {
    frames.push(x.slice(i, i + win));
    i += hop;
  }
  return frames;
}

function naiveDftMag(frame: number[], nBins = 64): number[] {
  const n = frame.length;
  const out: number[] = [];
  for (let k = 0; k < nBins; k++) {
    let re = 0.0;
    let im = 0.0;
    for (let i = 0; i < n; i++) {
      const angle = (-2 * Math.PI * k * i) / n;
      re += frame[i] * Math.cos(angle);
      im += frame[i] * Math.sin(angle);
    }
    out.push(Math.sqrt(re * re + im * im));
  }
  return out;
}

function melFilterbank(nBins = 64, nMels = 20): number[][] {
  const fbank: number[][] = [];
  const band = Math.floor(nBins / nMels);
  for (let m = 0; m < nMels; m++) {
    const row = new Array<number>(nBins).fill(0.0);
    const start = m * band;
    const end = Math.min(start + band, nBins);
    for (let k = start; k < end; k++) row[k] = 1.0 / (end - start);
    fbank.push(row);
  }
  return fbank;
}

function applyMel(specMag: number[], fbank: number[][]): number[] {
  return fbank.map((row) => {
    let s = 0;
    const n = Math.min(row.length, specMag.length);
    for (let i = 0; i < n; i++) s += row[i] * specMag[i];
    return s;
  });
}

function logCompress(xs: number[]): number[] {
  return xs.map((x) => Math.log(1 + x));
}

function demoMelspec(): void {
  console.log("\nLOG-MEL SPECTROGRAM (1s @ 16kHz, 25ms win, 10ms hop, 20 mel bins)");
  console.log("-".repeat(60));
  const wave = synthWaveform(1.0, 16000);
  const frames = windowFrames(wave, 16000, 25, 10);
  console.log(`  frames : ${frames.length} (should be ~99 at 1s)`);

  const spec = naiveDftMag(frames[0], 64);
  const fbank = melFilterbank(64, 20);
  const mel = applyMel(spec, fbank);
  const logMel = logCompress(mel);
  console.log(`  per-frame mel dim: ${mel.length}`);
  const shown = logMel.slice(0, 10).map((v) => pyFloat(Number(v.toFixed(2))));
  console.log(`  first frame log-mel (rounded): [${shown.join(", ")}]...`);
}

class QFormer {
  queries: number[][];

  constructor(public nQueries: number, public hidden: number) {
    this.queries = [];
    for (let i = 0; i < nQueries; i++) {
      const q: number[] = [];
      for (let j = 0; j < hidden; j++) q.push(gauss(0, 0.1));
      this.queries.push(q);
    }
  }

  forward(frames: number[][]): number[][] {
    const out: number[][] = [];
    for (const q of this.queries) {
      const scores = frames.map((f) => {
        let s = 0;
        const n = Math.min(q.length, f.length);
        for (let i = 0; i < n; i++) s += q[i] * f[i];
        return s;
      });
      const m = Math.max(...scores);
      const exps = scores.map((s) => Math.exp(s - m));
      const z = exps.reduce((a, b) => a + b, 0);
      const weights = exps.map((e) => e / z);
      const agg: number[] = [];
      for (let k = 0; k < this.hidden; k++) {
        let s = 0;
        for (let i = 0; i < weights.length; i++) s += weights[i] * frames[i][k];
        agg.push(s);
      }
      out.push(agg);
    }
    return out;
  }
}

function demoQformer(): void {
  console.log("\nAUDIO Q-FORMER (N=8 queries over 20-dim frames)");
  console.log("-".repeat(60));
  const frames: number[][] = [];
  for (let i = 0; i < 99; i++) {
    const f: number[] = [];
    for (let j = 0; j < 20; j++) f.push(gauss(0, 1));
    frames.push(f);
  }
  const qf = new QFormer(8, 20);
  const tokens = qf.forward(frames);
  console.log(`  input frames: ${frames.length}`);
  console.log(`  output tokens: ${tokens.length} of dim ${tokens[0].length}`);
  console.log("  each token attends over the full audio by soft attention weights");
}

function taskCoverageTable(): void {
  console.log("\nCASCADED (Whisper -> LLM) vs END-TO-END AUDIO-LLM");
  console.log("-".repeat(60));
  const tasks: [string, string, string][] = [
    ["transcription", "yes", "yes"],
    ["keyword extraction", "yes", "yes"],
    ["summarization", "yes", "yes"],
    ["speaker diarization", "partial", "yes"],
    ["emotion inference", "no", "yes"],
    ["music genre classification", "no", "yes"],
    ["instrument recognition", "no", "yes"],
    ["environmental sound ID", "no", "yes"],
    ["temporal event grounding", "partial", "yes"],
    ["deepfake detection", "no", "yes"],
  ];
  console.log(`  ${"task".padEnd(30)}${"cascaded".padEnd(14)}end-to-end`);
  for (const [name, cas, e2e] of tasks) console.log(`  ${name.padEnd(30)}${cas.padEnd(14)}${e2e}`);
  console.log("\n  cascaded: fast + reliable for text-extractable signals");
  console.log("  end-to-end: required for acoustic-only signals (~40% of MMAU)");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("AUDIO-LANGUAGE: WHISPER TO AF3 (Phase 12, Lesson 19)");
  console.log("=".repeat(60));

  demoMelspec();
  demoQformer();
  taskCoverageTable();

  console.log("\n2026 RECIPE");
  console.log("-".repeat(60));
  console.log("  encoder : AF-Whisper (Whisper-large-v3 based)");
  console.log("  bridge  : 64-query Q-former");
  console.log("  LLM     : Qwen2.5-7B with audio tokens");
  console.log("  training: AudioCaps + Clotho + MMAU-style instructions");
  console.log("  option  : on-demand thinking for complex reasoning");
}

main();
