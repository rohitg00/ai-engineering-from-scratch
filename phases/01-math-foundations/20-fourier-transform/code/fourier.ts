// Lesson: The Fourier Transform (phase 01 / lesson 20)
// TypeScript port of code/fourier.py. Node standard library only.
// Source: phases/01-math-foundations/20-fourier-transform/docs/en.md
// Run: npx tsx phases/01-math-foundations/20-fourier-transform/code/fourier.ts
import { writeFileSync } from "node:fs";

type Random = () => number;

function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(random: Random, mean: number, std: number): number {
  let u1 = random();
  while (u1 === 0) {
    u1 = random();
  }
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

function exponential(value: number, digits: number): string {
  const [mantissa, exponent] = value.toExponential(digits).split("e");
  const power = Number(exponent);
  const sign = power < 0 ? "-" : "+";
  return `${mantissa}e${sign}${String(Math.abs(power)).padStart(2, "0")}`;
}

function pyFloat(value: number): string {
  return Number.isInteger(value) ? value.toFixed(1) : String(value);
}

function pyFloatList(values: number[]): string {
  return `[${values.map(pyFloat).join(", ")}]`;
}

function pyBool(value: boolean): string {
  return value ? "True" : "False";
}

function withCommas(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function line(char: string, count: number): string {
  return char.repeat(count);
}

class Complex {
  real: number;
  imag: number;

  constructor(real = 0, imag = 0) {
    this.real = real;
    this.imag = imag;
  }

  add(other: Complex | number): Complex {
    if (typeof other === "number") {
      return new Complex(this.real + other, this.imag);
    }
    return new Complex(this.real + other.real, this.imag + other.imag);
  }

  sub(other: Complex | number): Complex {
    if (typeof other === "number") {
      return new Complex(this.real - other, this.imag);
    }
    return new Complex(this.real - other.real, this.imag - other.imag);
  }

  mul(other: Complex | number): Complex {
    if (typeof other === "number") {
      return new Complex(this.real * other, this.imag * other);
    }
    const real = this.real * other.real - this.imag * other.imag;
    const imag = this.real * other.imag + this.imag * other.real;
    return new Complex(real, imag);
  }

  magnitude(): number {
    return Math.sqrt(this.real ** 2 + this.imag ** 2);
  }

  phase(): number {
    return Math.atan2(this.imag, this.real);
  }

  conjugate(): Complex {
    return new Complex(this.real, -this.imag);
  }

  toString(): string {
    if (Math.abs(this.imag) < 1e-12) {
      return this.real.toFixed(6);
    }
    const sign = this.imag >= 0 ? "+" : "-";
    return `${this.real.toFixed(6)} ${sign} ${Math.abs(this.imag).toFixed(6)}i`;
  }
}

type Sample = Complex | number;

function toComplex(value: Sample): Complex {
  return value instanceof Complex ? value : new Complex(value);
}

function euler(theta: number): Complex {
  return new Complex(Math.cos(theta), Math.sin(theta));
}

function dft(x: Sample[]): Complex[] {
  const N = x.length;
  const result: Complex[] = [];
  for (let k = 0; k < N; k++) {
    let total = new Complex(0, 0);
    for (let n = 0; n < N; n++) {
      const angle = (-2 * Math.PI * k * n) / N;
      total = total.add(toComplex(x[n]!).mul(euler(angle)));
    }
    result.push(total);
  }
  return result;
}

function idft(X: Sample[]): Complex[] {
  const N = X.length;
  const result: Complex[] = [];
  for (let n = 0; n < N; n++) {
    let total = new Complex(0, 0);
    for (let k = 0; k < N; k++) {
      const angle = (2 * Math.PI * k * n) / N;
      total = total.add(toComplex(X[k]!).mul(euler(angle)));
    }
    result.push(new Complex(total.real / N, total.imag / N));
  }
  return result;
}

function fft(x: Sample[]): Complex[] {
  const N = x.length;
  if (N === 0) {
    return [];
  }
  if (N === 1) {
    return [toComplex(x[0]!)];
  }
  if (N % 2 !== 0) {
    return dft(x);
  }

  const even = fft(x.filter((_, i) => i % 2 === 0));
  const odd = fft(x.filter((_, i) => i % 2 === 1));

  const half = N / 2;
  const result: Complex[] = new Array<Complex>(N).fill(new Complex(0));
  for (let k = 0; k < half; k++) {
    const angle = (-2 * Math.PI * k) / N;
    const twiddle = euler(angle);
    const t = twiddle.mul(odd[k]!);
    result[k] = even[k]!.add(t);
    result[k + half] = even[k]!.sub(t);
  }
  return result;
}

function ifft(X: Sample[]): Complex[] {
  const N = X.length;
  if (N === 0) {
    return [];
  }
  const conjX = X.map((xk) => (xk instanceof Complex ? xk.conjugate() : new Complex(xk)));
  const result = fft(conjX);
  return result.map((r) => new Complex(r.real / N, -r.imag / N));
}

function powerSpectrum(X: Complex[]): number[] {
  return X.map((xk) => xk.real ** 2 + xk.imag ** 2);
}

function magnitudeSpectrum(X: Complex[]): number[] {
  return X.map((xk) => xk.magnitude());
}

function spectralAnalysis(signal: number[], sampleRate: number): [number[], number[]] {
  const N = signal.length;
  const X = fft(signal);
  const magnitudes = magnitudeSpectrum(X);
  const freqs: number[] = [];
  for (let k = 0; k < N; k++) {
    freqs.push((k * sampleRate) / N);
  }
  const keep = Math.floor(N / 2) + 1;
  return [freqs.slice(0, keep), magnitudes.slice(0, keep)];
}

function hannWindow(N: number): number[] {
  if (N === 1) {
    throw new RangeError("window length must not be 1");
  }
  const window: number[] = [];
  for (let n = 0; n < N; n++) {
    window.push(0.5 * (1 - Math.cos((2 * Math.PI * n) / (N - 1))));
  }
  return window;
}

function hammingWindow(N: number): number[] {
  if (N === 1) {
    throw new RangeError("window length must not be 1");
  }
  const window: number[] = [];
  for (let n = 0; n < N; n++) {
    window.push(0.54 - 0.46 * Math.cos((2 * Math.PI * n) / (N - 1)));
  }
  return window;
}

function applyWindow(signal: number[], window: number[]): number[] {
  const length = Math.min(signal.length, window.length);
  const result: number[] = [];
  for (let i = 0; i < length; i++) {
    result.push(signal[i]! * window[i]!);
  }
  return result;
}

function convolveDirect(x: number[], h: number[]): number[] {
  const N = x.length;
  const M = h.length;
  if (N === 0 || M === 0) {
    return [];
  }
  const outLength = N + M - 1;
  const result: number[] = new Array<number>(outLength).fill(0);
  for (let n = 0; n < outLength; n++) {
    let total = 0;
    for (let k = 0; k < M; k++) {
      if (n - k >= 0 && n - k < N) {
        total += x[n - k]! * h[k]!;
      }
    }
    result[n] = total;
  }
  return result;
}

function convolveFft(x: number[], h: number[]): number[] {
  if (x.length === 0 || h.length === 0) {
    return [];
  }
  const N = x.length + h.length - 1;
  let paddedN = 1;
  while (paddedN < N) {
    paddedN *= 2;
  }

  const xPadded = [...x, ...new Array<number>(paddedN - x.length).fill(0)];
  const hPadded = [...h, ...new Array<number>(paddedN - h.length).fill(0)];

  const X = fft(xPadded);
  const H = fft(hPadded);

  const Y = X.map((xk, i) => xk.mul(H[i]!));

  const y = ifft(Y);
  return y.slice(0, N).map((value) => value.real);
}

function generateSignal(
  frequencies: number[],
  amplitudes: number[],
  N: number,
  sampleRate: number,
): number[] {
  const signal: number[] = new Array<number>(N).fill(0);
  const count = Math.min(frequencies.length, amplitudes.length);
  for (let i = 0; i < count; i++) {
    const freq = frequencies[i]!;
    const amp = amplitudes[i]!;
    for (let n = 0; n < N; n++) {
      const t = n / sampleRate;
      signal[n] = signal[n]! + amp * Math.sin(2 * Math.PI * freq * t);
    }
  }
  return signal;
}

function positionalEncoding(pos: number, dModel: number): number[] {
  const pe: number[] = new Array<number>(dModel).fill(0);
  for (let i = 0; 2 * i < dModel; i++) {
    const freq = 1 / 10000 ** ((2 * i) / dModel);
    const angle = pos * freq;
    pe[2 * i] = Math.sin(angle);
    if (2 * i + 1 < dModel) {
      pe[2 * i + 1] = Math.cos(angle);
    }
  }
  return pe;
}

function printHeader(title: string): void {
  console.log(line("=", 65));
  console.log(`  ${title}`);
  console.log(line("=", 65));
  console.log();
}

function demoPureSine(): void {
  printHeader("DFT OF A PURE SINE WAVE");

  const N = 32;
  const sampleRate = 32;
  const freq = 5;
  const signal = generateSignal([freq], [1.0], N, sampleRate);

  console.log(`  Signal: sin(2*pi*${freq}*t), ${N} samples at ${sampleRate} Hz`);
  console.log();

  const X = dft(signal);
  const mags = magnitudeSpectrum(X);

  console.log(`  ${"Freq bin k".padEnd(12)} ${"Frequency (Hz)".padStart(14)} ${"|X[k]|".padStart(10)}`);
  console.log(`  ${line("-", 12)} ${line("-", 14)} ${line("-", 10)}`);

  for (let k = 0; k < N / 2 + 1; k++) {
    const fHz = (k * sampleRate) / N;
    if (mags[k]! > 0.01) {
      console.log(`  k=${String(k).padEnd(8)} ${fHz.toFixed(1).padStart(14)} ${mags[k]!.toFixed(4).padStart(10)}`);
    }
  }

  console.log();
  console.log(`  Peak at k=${freq}, corresponding to ${freq} Hz.`);
  console.log("  The DFT correctly identified the frequency.");
}

function demoMultiFrequency(): void {
  console.log();
  console.log();
  printHeader("DFT OF SUMMED SINE WAVES");

  const N = 64;
  const sampleRate = 64;
  const freqs = [3, 7, 15];
  const amps = [1.0, 0.5, 0.3];

  const signal = generateSignal(freqs, amps, N, sampleRate);

  console.log(
    `  Signal: ${pyFloat(amps[0]!)}*sin(2*pi*${freqs[0]}*t) + ` +
      `${pyFloat(amps[1]!)}*sin(2*pi*${freqs[1]}*t) + ` +
      `${pyFloat(amps[2]!)}*sin(2*pi*${freqs[2]}*t)`,
  );
  console.log(`  ${N} samples at ${sampleRate} Hz`);
  console.log();

  const X = fft(signal);
  const mags = magnitudeSpectrum(X);

  console.log("  Frequencies recovered (magnitude > 0.5):");
  console.log(`  ${"Freq (Hz)".padStart(10)} ${"|X[k]|".padStart(10)} ${"Expected amp * N/2".padStart(20)}`);
  console.log(`  ${line("-", 10)} ${line("-", 10)} ${line("-", 20)}`);

  for (let k = 0; k < N / 2 + 1; k++) {
    if (mags[k]! > 0.5) {
      const fHz = (k * sampleRate) / N;
      let expected = "";
      for (let i = 0; i < freqs.length; i++) {
        if (Math.abs(fHz - freqs[i]!) < 0.1) {
          expected = ((amps[i]! * N) / 2).toFixed(1);
        }
      }
      console.log(`  ${fHz.toFixed(1).padStart(10)} ${mags[k]!.toFixed(4).padStart(10)} ${expected.padStart(20)}`);
    }
  }

  console.log();
  console.log("  All three frequencies correctly recovered.");
  console.log("  Amplitudes match expected values (amplitude * N/2).");
}

function demoFftVsDft(): void {
  console.log();
  console.log();
  printHeader("FFT vs DFT: SAME RESULT, FASTER");

  const N = 32;
  const random = mulberry32(42);
  const signal: number[] = [];
  for (let i = 0; i < N; i++) {
    signal.push(gauss(random, 0, 1));
  }

  const XDft = dft(signal);
  const XFft = fft(signal);

  let maxError = 0;
  for (let k = 0; k < N; k++) {
    const diffReal = Math.abs(XDft[k]!.real - XFft[k]!.real);
    const diffImag = Math.abs(XDft[k]!.imag - XFft[k]!.imag);
    maxError = Math.max(maxError, diffReal, diffImag);
  }

  console.log(`  Random signal, N = ${N}`);
  console.log(`  Max difference between DFT and FFT: ${exponential(maxError, 2)}`);
  console.log(`  Match: ${pyBool(maxError < 1e-10)}`);
  console.log();

  console.log(`  ${"k".padEnd(6)} ${"DFT |X[k]|".padStart(14)} ${"FFT |X[k]|".padStart(14)} ${"Diff".padStart(12)}`);
  console.log(`  ${line("-", 6)} ${line("-", 14)} ${line("-", 14)} ${line("-", 12)}`);
  for (let k = 0; k < 8; k++) {
    const dMag = XDft[k]!.magnitude();
    const fMag = XFft[k]!.magnitude();
    const diff = Math.abs(dMag - fMag);
    console.log(
      `  ${String(k).padEnd(6)} ${dMag.toFixed(8).padStart(14)} ${fMag.toFixed(8).padStart(14)} ${exponential(diff, 2).padStart(12)}`,
    );
  }

  console.log(`  ... (${N - 8} more coefficients)`);
  console.log();

  console.log(`  DFT complexity: O(N^2) = ${N * N} multiplications`);
  console.log(`  FFT complexity: O(N*log2(N)) = ${Math.trunc(N * Math.log2(N))} multiplications`);
  console.log(`  Speedup: ${((N * N) / (N * Math.log2(N))).toFixed(1)}x`);
}

function demoReconstruction(): void {
  console.log();
  console.log();
  printHeader("PERFECT RECONSTRUCTION: DFT -> IDFT");

  const random = mulberry32(99);
  const N = 16;
  const signal: number[] = [];
  for (let i = 0; i < N; i++) {
    signal.push(gauss(random, 0, 2));
  }

  const X = fft(signal);
  const reconstructed = ifft(X);

  let maxErr = 0;
  for (let n = 0; n < N; n++) {
    maxErr = Math.max(maxErr, Math.abs(reconstructed[n]!.real - signal[n]!));
  }

  console.log(`  Original and reconstructed signal (N=${N}):`);
  console.log(`  ${"n".padEnd(4)} ${"Original".padStart(12)} ${"Reconstructed".padStart(14)} ${"Error".padStart(12)}`);
  console.log(`  ${line("-", 4)} ${line("-", 12)} ${line("-", 14)} ${line("-", 12)}`);

  for (let n = 0; n < N; n++) {
    const err = Math.abs(reconstructed[n]!.real - signal[n]!);
    console.log(
      `  ${String(n).padEnd(4)} ${signal[n]!.toFixed(6).padStart(12)} ${reconstructed[n]!.real.toFixed(6).padStart(14)} ${exponential(err, 2).padStart(12)}`,
    );
  }

  console.log();
  console.log(`  Max reconstruction error: ${exponential(maxErr, 2)}`);
  console.log(`  Perfect reconstruction: ${pyBool(maxErr < 1e-10)}`);
}

function demoConvolutionTheorem(): void {
  console.log();
  console.log();
  printHeader("CONVOLUTION THEOREM");

  const x = [1.0, 2.0, 3.0, 4.0, 5.0];
  const h = [1.0, 1.0, 1.0];

  const direct = convolveDirect(x, h);
  const fftResult = convolveFft(x, h);

  console.log(`  Signal x = ${pyFloatList(x)}`);
  console.log(`  Filter h = ${pyFloatList(h)}`);
  console.log("  Linear convolution (x * h):");
  console.log();

  console.log(`  ${"n".padEnd(4)} ${"Direct".padStart(10)} ${"FFT-based".padStart(10)} ${"Diff".padStart(12)}`);
  console.log(`  ${line("-", 4)} ${line("-", 10)} ${line("-", 10)} ${line("-", 12)}`);

  let maxErr = 0;
  for (let n = 0; n < direct.length; n++) {
    const diff = Math.abs(direct[n]! - fftResult[n]!);
    maxErr = Math.max(maxErr, diff);
    console.log(
      `  ${String(n).padEnd(4)} ${direct[n]!.toFixed(4).padStart(10)} ${fftResult[n]!.toFixed(4).padStart(10)} ${exponential(diff, 2).padStart(12)}`,
    );
  }

  console.log();
  console.log(`  Max difference: ${exponential(maxErr, 2)}`);
  console.log(`  Match: ${pyBool(maxErr < 1e-8)}`);
  console.log();
  console.log("  Convolution in time = multiplication in frequency.");
  console.log("  Direct convolution: O(N*M) = O(15)");
  console.log("  FFT convolution: O(N*log(N)) for large N");
}

function demoWindowing(): void {
  console.log();
  console.log();
  printHeader("WINDOWING AND SPECTRAL LEAKAGE");

  const N = 64;
  const sampleRate = 64;
  const freq = 7.5;

  const signal: number[] = [];
  for (let n = 0; n < N; n++) {
    signal.push(Math.sin((2 * Math.PI * freq * n) / sampleRate));
  }

  const XRect = fft(signal);
  const magsRect = magnitudeSpectrum(XRect);

  const hann = hannWindow(N);
  const signalHann = applyWindow(signal, hann);
  const XHann = fft(signalHann);
  const magsHann = magnitudeSpectrum(XHann);

  const hamm = hammingWindow(N);
  const signalHamm = applyWindow(signal, hamm);
  const XHamm = fft(signalHamm);
  const magsHamm = magnitudeSpectrum(XHamm);

  console.log(`  Signal: sin(2*pi*${freq}*t) -- frequency is between bins`);
  console.log(`  N = ${N}, sample rate = ${sampleRate} Hz`);
  console.log(`  Frequency resolution: ${(sampleRate / N).toFixed(2)} Hz per bin`);
  console.log(`  ${freq} Hz falls between bin 7 and bin 8`);
  console.log();

  console.log(
    `  ${"Freq (Hz)".padStart(10)} ${"No window".padStart(12)} ${"Hann".padStart(12)} ${"Hamming".padStart(12)}`,
  );
  console.log(`  ${line("-", 10)} ${line("-", 12)} ${line("-", 12)} ${line("-", 12)}`);

  for (let k = 0; k < N / 2 + 1; k++) {
    const fHz = (k * sampleRate) / N;
    if (magsRect[k]! > 0.5 || (fHz >= 5 && fHz <= 11)) {
      console.log(
        `  ${fHz.toFixed(1).padStart(10)} ${magsRect[k]!.toFixed(4).padStart(12)} ` +
          `${magsHann[k]!.toFixed(4).padStart(12)} ${magsHamm[k]!.toFixed(4).padStart(12)}`,
      );
    }
  }

  console.log();
  console.log("  Without windowing, energy leaks into neighboring bins.");
  console.log("  Hann and Hamming windows concentrate energy near the true frequency.");
  console.log("  Tradeoff: windows widen the main peak but suppress side lobes.");
}

function demoParseval(): void {
  console.log();
  console.log();
  printHeader("PARSEVAL'S THEOREM: ENERGY CONSERVATION");

  const random = mulberry32(7);
  const N = 32;
  const signal: number[] = [];
  for (let i = 0; i < N; i++) {
    signal.push(gauss(random, 0, 1));
  }

  let timeEnergy = 0;
  for (const s of signal) {
    timeEnergy += s ** 2;
  }

  const X = fft(signal);
  let freqEnergy = 0;
  for (const xk of X) {
    freqEnergy += xk.real ** 2 + xk.imag ** 2;
  }
  freqEnergy /= N;

  console.log(`  Signal: ${N} random samples`);
  console.log(`  Time-domain energy:  sum |x[n]|^2 = ${timeEnergy.toFixed(6)}`);
  console.log(`  Freq-domain energy:  (1/N) sum |X[k]|^2 = ${freqEnergy.toFixed(6)}`);
  console.log(`  Difference: ${exponential(Math.abs(timeEnergy - freqEnergy), 2)}`);
  console.log(`  Energy conserved: ${pyBool(Math.abs(timeEnergy - freqEnergy) < 1e-10)}`);
}

function demoPositionalEncoding(): void {
  console.log();
  console.log();
  printHeader("POSITIONAL ENCODING FREQUENCIES");

  const dModel = 16;
  const maxPos = 8;

  console.log(`  d_model = ${dModel}, positions 0-${maxPos - 1}`);
  console.log();

  console.log("  Frequency at each dimension pair:");
  for (let i = 0; i < dModel / 2; i++) {
    const freq = 1 / 10000 ** ((2 * i) / dModel);
    const wavelength = freq > 0 ? (2 * Math.PI) / freq : Infinity;
    console.log(
      `    dim (${String(2 * i).padStart(2)},${String(2 * i + 1).padStart(2)}): freq = ${freq.toFixed(8)}  ` +
        `wavelength = ${wavelength.toFixed(1)}`,
    );
  }

  console.log();
  console.log("  Dot product between position encodings:");
  console.log("  (depends only on distance, not absolute position)");
  console.log();

  console.log(`  ${"pos_i".padStart(6)} ${"pos_j".padStart(6)} ${"dist".padStart(6)} ${"dot product".padStart(12)}`);
  console.log(`  ${line("-", 6)} ${line("-", 6)} ${line("-", 6)} ${line("-", 12)}`);

  const pairs: [number, number][] = [
    [0, 0],
    [0, 1],
    [0, 2],
    [0, 4],
    [1, 2],
    [1, 3],
    [2, 4],
    [3, 7],
  ];
  for (const [p1, p2] of pairs) {
    const pe1 = positionalEncoding(p1, dModel);
    const pe2 = positionalEncoding(p2, dModel);
    let dot = 0;
    for (let d = 0; d < dModel; d++) {
      dot += pe1[d]! * pe2[d]!;
    }
    console.log(
      `  ${String(p1).padStart(6)} ${String(p2).padStart(6)} ${String(Math.abs(p2 - p1)).padStart(6)} ${dot.toFixed(4).padStart(12)}`,
    );
  }

  console.log();
  console.log("  Pairs with the same distance have similar dot products.");
  console.log("  This lets the model learn relative position through attention.");
}

function demoFrequencyScaling(): void {
  console.log();
  console.log();
  printHeader("FFT COMPLEXITY SCALING");

  console.log(`  ${"N".padStart(8)} ${"DFT O(N^2)".padStart(14)} ${"FFT O(N logN)".padStart(16)} ${"Speedup".padStart(10)}`);
  console.log(`  ${line("-", 8)} ${line("-", 14)} ${line("-", 16)} ${line("-", 10)}`);

  for (let exp = 3; exp < 14; exp++) {
    const N = 2 ** exp;
    const dftOps = N * N;
    const fftOps = Math.trunc(N * Math.log2(N));
    const speedup = dftOps / fftOps;
    console.log(
      `  ${String(N).padStart(8)} ${withCommas(dftOps).padStart(14)} ${withCommas(fftOps).padStart(16)} ${speedup.toFixed(1).padStart(10)}x`,
    );
  }
}

const PROMPT_LINES = [
  "---\n",
  "name: prompt-spectral-analyzer\n",
  "description: Guides analysis of frequency content in signals using Fourier transform techniques\n",
  "phase: 1\n",
  "lesson: 20\n",
  "---\n\n",
  "You are a spectral analysis expert. You help engineers analyze the frequency content of signals using Fourier transform techniques.\n\n",
  "When given a signal or signal description, guide the analysis step by step:\n\n",
  "1. **Determine sampling parameters.**\n",
  "   - What is the sampling rate (fs)? This sets the maximum detectable frequency (Nyquist = fs/2).\n",
  "   - How many samples (N)? This sets the frequency resolution (delta_f = fs/N).\n",
  "   - Is the signal length a power of 2? If not, recommend zero-padding for FFT efficiency.\n\n",
  "2. **Choose a window function.**\n",
  "   - Is the signal exactly periodic in the analysis window? If yes, no window needed.\n",
  "   - For general analysis: use Hann window (good tradeoff between resolution and leakage).\n",
  "   - For audio/speech: Hamming window.\n",
  "   - When side lobe suppression matters most: Blackman window.\n",
  "   - Remember: windowing widens peaks but reduces leakage.\n\n",
  "3. **Compute and interpret the spectrum.**\n",
  "   - Power spectrum |X[k]|^2 shows energy at each frequency.\n",
  "   - Peaks in the power spectrum indicate dominant frequencies.\n",
  "   - X[0] is the DC component (signal mean * N).\n",
  "   - Only look at bins 0 to N/2 for real-valued signals (upper half is the mirror).\n",
  "   - Frequency of bin k: f_k = k * fs / N.\n\n",
  "4. **Identify dominant frequencies.**\n",
  "   - Find peaks above a noise threshold.\n",
  "   - Convert bin index to Hz: freq = k * fs / N.\n",
  "   - Check for harmonics (peaks at integer multiples of a fundamental).\n",
  "   - Check for aliased frequencies (actual frequency = fs - apparent frequency).\n\n",
  "5. **Common pitfalls to watch for.**\n",
  "   - Spectral leakage: non-integer number of cycles in the window causes energy to spread across bins.\n",
  "   - Aliasing: if signal contains frequencies above fs/2, they fold back into the spectrum.\n",
  "   - DC offset: large X[0] can mask nearby low-frequency content. Remove the mean before FFT.\n",
  "   - Zero-padding increases bin density but does NOT improve actual frequency resolution.\n",
  "   - Circular vs linear convolution: DFT gives circular convolution. Zero-pad for linear.\n\n",
  "6. **For convolution analysis.**\n",
  "   - Time-domain convolution = frequency-domain multiplication.\n",
  "   - For large kernels, FFT-based convolution is faster: O(N log N) vs O(N*M).\n",
  "   - Zero-pad both signals to length N + M - 1 for correct linear convolution.\n",
];

function writePromptOutput(): void {
  const outputPath = "outputs/prompt-spectral-analyzer.md";
  try {
    writeFileSync(outputPath, PROMPT_LINES.join(""));
    console.log(`\n  Prompt output written to ${outputPath}`);
  } catch {
    console.log("\n  Could not write prompt output (run from the lesson directory)");
  }
}

function printSummary(): void {
  console.log();
  console.log();
  printHeader("SUMMARY");
  console.log("  1. The DFT converts N time samples to N frequency coefficients.");
  console.log("  2. Each X[k] measures the signal's correlation with frequency k.");
  console.log("  3. The FFT computes the DFT in O(N log N) instead of O(N^2).");
  console.log("  4. DFT and IDFT are perfect inverses -- no information is lost.");
  console.log("  5. The convolution theorem: convolution in time = multiplication");
  console.log("     in frequency. This is why FFT-based convolution is fast.");
  console.log("  6. Windowing reduces spectral leakage for non-periodic signals.");
  console.log("  7. Parseval's theorem: energy is conserved through the transform.");
  console.log("  8. Transformer positional encodings use the same frequency");
  console.log("     decomposition idea -- each position gets a unique spectrum.");
  console.log();
}


demoPureSine();
demoMultiFrequency();
demoFftVsDft();
demoReconstruction();
demoConvolutionTheorem();
demoWindowing();
demoParseval();
demoPositionalEncoding();
demoFrequencyScaling();
writePromptOutput();
printSummary();
