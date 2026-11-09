// Lesson: Spectrograms, Mel Scale & Audio Features (phase 06 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/02-spectrograms-mel-features/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/02-spectrograms-mel-features/code/main.ts

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

function chirp(f0: number, f1: number, sr: number, seconds: number, amp = 0.5): number[] {
  const n = Math.trunc(sr * seconds);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const f = f0 + (f1 - f0) * (t / seconds);
    out.push(amp * Math.sin(2.0 * Math.PI * f * t));
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

function frameSignal(signal: number[], frameLen: number, hop: number): number[][] {
  if (signal.length < frameLen) {
    return [];
  }
  const n = 1 + Math.floor((signal.length - frameLen) / hop);
  const out: number[][] = [];
  for (let i = 0; i < n; i++) {
    out.push(signal.slice(i * hop, i * hop + frameLen));
  }
  return out;
}

function stftMagnitude(signal: number[], frameLen: number, hop: number): number[][] {
  const w = hann(frameLen);
  return frameSignal(signal, frameLen, hop).map((f) => dftMag(f.map((v, j) => w[j] * v)));
}

function hzToMel(f: number): number {
  return 2595.0 * Math.log10(1.0 + f / 700.0);
}

function melToHz(m: number): number {
  return 700.0 * (10 ** (m / 2595.0) - 1.0);
}

function melFilterbank(nMels: number, nFft: number, sr: number, fmin = 0.0, fmax: number | null = null): number[][] {
  const hi = fmax === null ? sr / 2 : fmax;
  const mLo = hzToMel(fmin);
  const mHi = hzToMel(hi);
  const mels: number[] = [];
  for (let i = 0; i < nMels + 2; i++) {
    mels.push(mLo + ((mHi - mLo) * i) / (nMels + 1));
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
      const denom = Math.max(1, center - left);
      fb[m][k] = (k - left) / denom;
    }
    for (let k = center; k < right; k++) {
      const denom = Math.max(1, right - center);
      fb[m][k] = (right - k) / denom;
    }
  }
  return fb;
}

function applyFilterbank(stftMag: number[][], fb: number[][]): number[][] {
  return stftMag.map((spec) =>
    fb.map((row) => {
      let val = 0.0;
      row.forEach((w, k) => {
        if (w) {
          val += spec[k] * w;
        }
      });
      return val;
    }),
  );
}

function logTransform(melSpec: number[][], eps = 1e-10): number[][] {
  return melSpec.map((frame) => frame.map((v) => Math.log(Math.max(v, eps))));
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

function argmax(xs: number[]): number {
  let best = 0;
  for (let i = 1; i < xs.length; i++) {
    if (xs[i] > xs[best]) {
      best = i;
    }
  }
  return best;
}

function main(): void {
  const sr = 8000;
  const frameLen = 256;
  const hop = 128;
  const nMels = 40;
  const nFft = frameLen;

  console.log("=== Step 1: frame a 0.5 s, 2 kHz tone ===");
  const tone = sine(2000.0, sr, 0.5);
  const frames = frameSignal(tone, frameLen, hop);
  console.log(`  samples: ${tone.length}, frames: ${frames.length}, frame_len: ${frameLen}, hop: ${hop}`);

  console.log();
  console.log("=== Step 2: Hann window attenuates frame edges ===");
  const w = hann(frameLen);
  console.log(`  hann(0) = ${pyFixed(w[0], 4)}   hann(mid) = ${pyFixed(w[Math.floor(frameLen / 2)], 4)}   hann(last) = ${pyFixed(w[w.length - 1], 4)}`);

  console.log();
  console.log("=== Step 3: STFT of the tone; argmax bin is at 2000 Hz ===");
  const mag = stftMagnitude(tone, frameLen, hop);
  const mid = mag[Math.floor(mag.length / 2)];
  const kPeak = argmax(mid);
  console.log(`  frames: ${mag.length}, bins/frame: ${mid.length}`);
  console.log(`  peak bin: ${kPeak}, freq: ${pyFixed((kPeak * sr) / nFft, 1)} Hz (expected 2000 Hz)`);

  console.log();
  console.log("=== Step 4: mel filterbank, 40 mels, 0-4000 Hz ===");
  const fb = melFilterbank(nMels, nFft, sr);
  const melWidths = fb.map((f) => f.filter((x) => x > 0).length);
  console.log(`  filterbank shape: ${nMels} x ${fb[0].length}`);
  console.log(`  bin widths (first 6): [${melWidths.slice(0, 6).join(", ")}]   (last 6): [${melWidths.slice(-6).join(", ")}]`);
  console.log("  note: low-mel filters are narrow (dense), high-mel filters are wide (sparse).");

  console.log();
  console.log("=== Step 5: chirp 200 Hz -> 4000 Hz; argmax mel per frame ===");
  const c = chirp(200.0, 4000.0, sr, 0.4);
  const cmag = stftMagnitude(c, frameLen, hop);
  const melSpec = applyFilterbank(cmag, fb);
  const lm = logTransform(melSpec);
  console.log("  frame -> argmax mel bin:");
  const step = Math.max(1, Math.floor(lm.length / 10));
  for (let i = 0; i < lm.length; i += step) {
    const am = argmax(lm[i].slice(0, nMels));
    console.log(`    t=${String(i).padStart(3)}  argmax_mel=${String(am).padStart(2)}`);
  }

  console.log();
  console.log("=== Step 6: MFCC-13 of a single mel frame ===");
  const mfcc = dctII(lm[Math.floor(lm.length / 2)], 13);
  console.log(`  MFCC (13 coeffs, mid frame): [${mfcc.map((v) => pyFloat(pyRound(v, 3))).join(", ")}]`);
  console.log("  note: coef 0 encodes overall energy; typically dropped downstream.");
}

main();
