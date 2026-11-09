// Lesson: Voice Anti-Spoofing & Audio Watermarking: ASVspoof 5, AudioSeal, WaveVerify (phase 06 / lesson 16)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/16-anti-spoofing-audio-watermarking/code/main.ts

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

function sum(xs: number[]): number {
  let total = 0;
  for (const x of xs) {
    total += x;
  }
  return total;
}

function synthRealSpeech(nSamples = 16000, seed = 0): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    const base = 0.2 * Math.sin((2 * Math.PI * 220 * i) / 16000);
    const harmonic = 0.08 * Math.sin((2 * Math.PI * 440 * i) / 16000);
    const noise = 0.02 * gaussFrom(rng, 0, 1.0);
    out.push(base + harmonic + noise);
  }
  return out;
}

function synthFakeSpeech(nSamples = 16000, seed = 0): number[] {
  const rng = mulberry32(seed);
  const out: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    const base = 0.2 * Math.sin((2 * Math.PI * 220 * i) / 16000);
    const ultraFlat = 0.05 * Math.sin((2 * Math.PI * 6000 * i) / 16000);
    out.push(base + ultraFlat + 0.002 * gaussFrom(rng, 0, 1.0));
  }
  return out;
}

function magnitudeSpectrum(audio: number[], nFft = 256): number[] {
  const half = Math.floor(nFft / 2) + 1;
  const result = new Array<number>(half).fill(0.0);
  const window: number[] = [];
  for (let i = 0; i < nFft; i++) {
    window.push(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (nFft - 1)));
  }
  const cos: Float64Array[] = [];
  const sin: Float64Array[] = [];
  for (let k = 0; k < half; k++) {
    const c = new Float64Array(nFft);
    const s = new Float64Array(nFft);
    for (let j = 0; j < nFft; j++) {
      const angle = (-2 * Math.PI * k * j) / nFft;
      c[j] = Math.cos(angle);
      s[j] = Math.sin(angle);
    }
    cos.push(c);
    sin.push(s);
  }
  for (let start = 0; start < audio.length - nFft; start += nFft) {
    const chunk = audio.slice(start, start + nFft);
    for (let k = 0; k < half; k++) {
      let re = 0.0;
      let im = 0.0;
      for (let j = 0; j < nFft; j++) {
        re += window[j] * chunk[j] * cos[k][j];
        im += window[j] * chunk[j] * sin[k][j];
      }
      result[k] += Math.sqrt(re * re + im * im);
    }
  }
  return result;
}

function toyDetectorScore(audio: number[]): number {
  const spec = magnitudeSpectrum(audio);
  const total = sum(spec) || 1e-9;
  return sum(spec.slice(Math.floor(spec.length / 2))) / total;
}

function toyWatermarkEmbed(audio: number[], payloadBits: number[]): number[] {
  const out = [...audio];
  const step = Math.max(1, Math.floor(audio.length / payloadBits.length));
  payloadBits.forEach((bit, i) => {
    const idx = i * step;
    if (idx < out.length) {
      out[idx] = out[idx] + (bit ? 0.0005 : -0.0005);
    }
  });
  return out;
}

function toyWatermarkDetect(audio: number[], reference: number[], nBits = 16): number[] {
  const step = Math.max(1, Math.floor(audio.length / nBits));
  const out: number[] = [];
  for (let i = 0; i < nBits; i++) {
    const idx = i * step;
    if (idx < audio.length) {
      out.push(audio[idx] - reference[idx] > 0 ? 1 : 0);
    }
  }
  return out;
}

function main(): void {
  console.log("=== Step 1: synthesize real vs fake speech ===");
  const realClips: number[][] = [];
  const fakeClips: number[][] = [];
  for (let i = 0; i < 20; i++) {
    realClips.push(synthRealSpeech(16000, i));
  }
  for (let i = 0; i < 20; i++) {
    fakeClips.push(synthFakeSpeech(16000, 100 + i));
  }
  console.log(`  20 real, 20 fake, ${realClips[0].length} samples each`);

  console.log();
  console.log("=== Step 2: score with toy spectral detector ===");
  const realScores = realClips.map(toyDetectorScore);
  const fakeScores = fakeClips.map(toyDetectorScore);
  console.log(`  real  mean: ${pyFixed(sum(realScores) / realScores.length, 3)}`);
  console.log(`  fake  mean: ${pyFixed(sum(fakeScores) / fakeScores.length, 3)}`);

  console.log();
  console.log("=== Step 3: sweep threshold → EER ===");
  const candidates = [...new Set([...realScores, ...fakeScores])].sort((a, b) => a - b);
  let best: [number, number, number, number] = [1.0, 0.0, 0.0, 0.0];
  for (const t of candidates) {
    const far = fakeScores.filter((s) => s < t).length / fakeScores.length;
    const frr = realScores.filter((s) => s >= t).length / realScores.length;
    if (Math.abs(far - frr) < best[0]) {
      best = [Math.abs(far - frr), t, far, frr];
    }
  }
  const [, t, far, frr] = best;
  console.log(`  EER ≈ ${pyFixed((far + frr) * 50, 2)}%  at threshold ${pyFixed(t, 4)}`);
  console.log("    (on toy data, real AASIST on ASVspoof 2019 LA: 0.42% EER)");

  console.log();
  console.log("=== Step 4: watermark embed + detect (toy) ===");
  const payload = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0];
  const clean = synthRealSpeech(16000, 42);
  const watermarked = toyWatermarkEmbed(clean, payload);
  const recovered = toyWatermarkDetect(watermarked, clean);
  let same = 0;
  for (let i = 0; i < Math.min(payload.length, recovered.length); i++) {
    if (payload[i] === recovered[i]) {
      same += 1;
    }
  }
  const bitAcc = same / payload.length;
  console.log(`  payload:   [${payload.join(", ")}]`);
  console.log(`  recovered: [${recovered.join(", ")}]`);
  console.log(`  bit accuracy: ${pyFixed(bitAcc * 100, 1)}%   (toy; real AudioSeal: > 99% pre-attack)`);

  console.log();
  console.log("=== Step 5: 2026 benchmarks ===");
  const rows: [string, string, string][] = [
    ["AASIST (ASVspoof 2019 LA)", "0.42% EER", "detection SOTA"],
    ["NeXt-TDNN + WavLM (2025)", "0.42% EER", "detection SOTA"],
    ["Robust method on ASVspoof 5", "7.23% EER", "real-world"],
    ["AudioSeal (pre-attack)", "> 99% bit acc", "localized watermark"],
    ["WavMark (pre-attack)", "99.52% bit acc", "legacy watermark"],
    ["All (under pitch shift)", "< 60% bit acc", "universal attack"],
  ];
  console.log("  | method                         | metric           | note              |");
  for (const [name, m, note] of rows) {
    console.log(`  | ${name.padEnd(30)} | ${m.padEnd(16)} | ${note.padEnd(17)} |`);
  }

  console.log();
  console.log("takeaways:");
  console.log("  - detection: AASIST on log-mel / spec features; ensemble with RawNet2");
  console.log("  - watermark: AudioSeal (localized, fast, Meta, 485× faster than WavMark)");
  console.log("  - pitch-shift attack breaks every watermark → need both detection AND watermarking");
  console.log("  - always ship C2PA manifest + audit log on top");
}

main();
