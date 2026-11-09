// Lesson: Audio Fundamentals: Waveforms, Sampling, Fourier Transform (phase 06 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/01-audio-fundamentals/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/01-audio-fundamentals/code/main.ts

import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

function sine(freqHz: number, sr: number, seconds: number, amp = 0.5): number[] {
  const n = Math.trunc(sr * seconds);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(amp * Math.sin((2.0 * Math.PI * freqHz * i) / sr));
  }
  return out;
}

function mix(...signals: number[][]): number[] {
  const length = Math.min(...signals.map((s) => s.length));
  const out: number[] = [];
  for (let i = 0; i < length; i++) {
    let total = 0;
    for (const s of signals) {
      total += s[i];
    }
    out.push(total / signals.length);
  }
  return out;
}

function writeWav(path: string, samples: number[], sr: number): void {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0, "ascii");
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8, "ascii");
  buf.write("fmt ", 12, "ascii");
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36, "ascii");
  buf.writeUInt32LE(dataSize, 40);
  samples.forEach((s, i) => {
    buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.trunc(s * 32767))), 44 + 2 * i);
  });
  writeFileSync(path, buf);
}

function readWav(path: string): [number[], number] {
  const buf = readFileSync(path);
  let sr = 0;
  let offset = 12;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    if (id === "fmt ") {
      sr = buf.readUInt32LE(offset + 12);
    } else if (id === "data") {
      const out: number[] = [];
      for (let i = 0; i < size / 2; i++) {
        out.push(buf.readInt16LE(offset + 8 + 2 * i) / 32768.0);
      }
      return [out, sr];
    }
    offset += 8 + size;
  }
  return [[], sr];
}

function dft(x: number[]): [number, number][] {
  const n = x.length;
  const out: [number, number][] = [];
  for (let k = 0; k < n; k++) {
    let re = 0.0;
    let im = 0.0;
    for (let j = 0; j < n; j++) {
      const angle = (-2.0 * Math.PI * k * j) / n;
      re += x[j] * Math.cos(angle);
      im += x[j] * Math.sin(angle);
    }
    out.push([re, im]);
  }
  return out;
}

function magnitudes(spectrum: [number, number][]): number[] {
  return spectrum.map(([re, im]) => Math.sqrt(re * re + im * im));
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

function peakFreq(samples: number[], sr: number): [number, number] {
  const all = magnitudes(dft(samples));
  const half = Math.floor(all.length / 2);
  const mags = all.slice(0, half);
  const k = argmax(mags);
  return [(k * sr) / samples.length, k];
}

function downsampleNaive(samples: number[], factor: number): number[] {
  return samples.filter((_, i) => i % factor === 0);
}

function pyList(xs: number[]): string {
  return `[${xs.map(pyFloat).join(", ")}]`;
}

function main(): void {
  const sr = 8000;
  const duration = 0.064;

  console.log("=== Step 1: synthesize a 440 Hz sine, 8 kHz, 64 ms ===");
  const a = sine(440.0, sr, duration);
  console.log(`  samples: ${a.length}`);
  console.log(`  first 5: ${pyList(a.slice(0, 5).map((x) => pyRound(x, 4)))}`);

  console.log();
  console.log("=== Step 2: round-trip through a WAV file ===");
  const dir = mkdtempSync(join(tmpdir(), "audio_fundamentals_"));
  const path = join(dir, "a440.wav");
  writeWav(path, a, sr);
  const [loaded, loadedSr] = readWav(path);
  const size = statSync(path).size;
  console.log(`  wrote ${path} (${size} bytes, sr=${loadedSr})`);
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff = Math.max(diff, Math.abs(a[i] - loaded[i]));
  }
  console.log(`  round-trip max abs error (16-bit quantization): ${pyFixed(diff, 5)}`);

  console.log();
  console.log("=== Step 3: DFT peak detection on 440 Hz ===");
  const [freq, k] = peakFreq(a, sr);
  console.log(`  peak bin k=${k}, freq=${pyFixed(freq, 1)} Hz (expected ~440.0 Hz, bin resolution ${pyFixed(sr / a.length, 2)} Hz)`);

  console.log();
  console.log("=== Step 4: mixed signal (220 + 440 + 880) ===");
  const mixed = mix(sine(220, sr, duration), sine(440, sr, duration), sine(880, sr, duration));
  const mags = magnitudes(dft(mixed)).slice(0, Math.floor(mixed.length / 2));
  const order = mags.map((_, i) => i).sort((p, q) => -mags[p] - -mags[q]);
  const top3 = order.slice(0, 3);
  const peaksHz = top3.map((kk) => pyRound((kk * sr) / mixed.length, 1)).sort((p, q) => p - q);
  console.log(`  top 3 peaks: ${pyList(peaksHz)} Hz`);

  console.log();
  console.log("=== Step 5: aliasing: 7 kHz tone sampled at 10 kHz ===");
  const aliasSr = 10000;
  const tone = sine(7000.0, aliasSr, 0.0512);
  const [aliasFreq] = peakFreq(tone, aliasSr);
  const folded = aliasSr - 7000.0;
  console.log(`  true frequency: 7000.0 Hz (above Nyquist = ${pyFloat(aliasSr / 2)} Hz)`);
  console.log(`  DFT reports:    ${pyFixed(aliasFreq, 1)} Hz`);
  console.log(`  expected alias: ${pyFixed(folded, 1)} Hz  (= sr - f_true)`);

  console.log();
  console.log("=== Step 6: proper downsample vs naive decimation ===");
  const origSr = 24000;
  const sig = sine(7000.0, origSr, 0.032);
  const decimated = downsampleNaive(sig, 3);
  const newSr = Math.floor(origSr / 3);
  const [peakNew] = peakFreq(decimated, newSr);
  console.log("  24 kHz 7 kHz tone, decimated to 8 kHz without low-pass:");
  console.log(`    peak after decimation: ${pyFixed(peakNew, 1)} Hz (should be 1000 Hz from folding)`);
  console.log("    lesson: always low-pass filter before decimating");
}

main();
