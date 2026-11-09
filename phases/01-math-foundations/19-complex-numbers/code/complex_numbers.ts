// Lesson: Complex Numbers for AI (phase 01 / lesson 19)
// TypeScript port of code/complex_numbers.py. Node standard library only.
// Source: phases/01-math-foundations/19-complex-numbers/docs/en.md
// Run: npx tsx phases/01-math-foundations/19-complex-numbers/code/complex_numbers.ts

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

function fx(x: number, digits: number): string {
  const negative = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let s = a.toFixed(digits);
  const exact = a.toFixed(Math.min(100, digits + 60));
  const tail = exact.slice(exact.length - (Math.min(100, digits + 60) - digits));
  if (/^50*$/.test(tail)) {
    const down = (Math.floor(a * 10 ** digits) / 10 ** digits).toFixed(digits);
    const lastDigit = Number(down.replace(".", "").slice(-1));
    if (lastDigit % 2 === 0) s = down;
  }
  return negative ? `-${s}` : s;
}

function ex(x: number, digits: number): string {
  const s = x.toExponential(digits);
  return s.replace(/e([+-])(\d)$/, "e$10$2");
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyBool(x: boolean): string {
  return x ? "True" : "False";
}

function degrees(rad: number): number {
  return rad * (180 / Math.PI);
}

function radians(deg: number): number {
  return deg * (Math.PI / 180);
}

class Complex {
  readonly real: number;
  readonly imag: number;

  constructor(real: number, imag = 0.0) {
    this.real = real;
    this.imag = imag;
  }

  private static of(other: Complex | number): Complex {
    return typeof other === "number" ? new Complex(other) : other;
  }

  add(other: Complex | number): Complex {
    const o = Complex.of(other);
    return new Complex(this.real + o.real, this.imag + o.imag);
  }

  radd(other: number): Complex {
    return this.add(new Complex(other));
  }

  sub(other: Complex | number): Complex {
    const o = Complex.of(other);
    return new Complex(this.real - o.real, this.imag - o.imag);
  }

  rsub(other: number): Complex {
    return new Complex(other - this.real, -this.imag);
  }

  mul(other: Complex | number): Complex {
    const o = Complex.of(other);
    const r = this.real * o.real - this.imag * o.imag;
    const i = this.real * o.imag + this.imag * o.real;
    return new Complex(r, i);
  }

  rmul(other: number): Complex {
    return this.mul(new Complex(other));
  }

  div(other: Complex | number): Complex {
    const o = Complex.of(other);
    const denom = o.real ** 2 + o.imag ** 2;
    if (denom === 0) {
      throw new RangeError("division by zero complex number");
    }
    const r = (this.real * o.real + this.imag * o.imag) / denom;
    const i = (this.imag * o.real - this.real * o.imag) / denom;
    return new Complex(r, i);
  }

  neg(): Complex {
    return new Complex(-this.real, -this.imag);
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
      return fx(this.real, 6);
    }
    const sign = this.imag >= 0 ? "+" : "-";
    return `${fx(this.real, 6)} ${sign} ${fx(Math.abs(this.imag), 6)}i`;
  }

  equals(other: Complex | number): boolean {
    const o = Complex.of(other);
    return Math.abs(this.real - o.real) < 1e-10 && Math.abs(this.imag - o.imag) < 1e-10;
  }
}

function toPolar(z: Complex): [number, number] {
  return [z.magnitude(), z.phase()];
}

function fromPolar(r: number, theta: number): Complex {
  return new Complex(r * Math.cos(theta), r * Math.sin(theta));
}

function euler(theta: number): Complex {
  return new Complex(Math.cos(theta), Math.sin(theta));
}

function dft(signal: readonly (Complex | number)[]): Complex[] {
  const N = signal.length;
  const result: Complex[] = [];
  for (let k = 0; k < N; k++) {
    let total = new Complex(0, 0);
    for (let n = 0; n < N; n++) {
      const angle = (-2 * Math.PI * k * n) / N;
      const s = signal[n];
      const xn = s instanceof Complex ? s : new Complex(s);
      total = total.add(xn.mul(euler(angle)));
    }
    result.push(total);
  }
  return result;
}

function idft(spectrum: readonly Complex[]): Complex[] {
  const N = spectrum.length;
  const result: Complex[] = [];
  for (let n = 0; n < N; n++) {
    let total = new Complex(0, 0);
    for (let k = 0; k < N; k++) {
      const angle = (2 * Math.PI * k * n) / N;
      total = total.add(spectrum[k].mul(euler(angle)));
    }
    result.push(new Complex(total.real / N, total.imag / N));
  }
  return result;
}

function rootsOfUnity(N: number): Complex[] {
  return Array.from({ length: N }, (_, k) => euler((2 * Math.PI * k) / N));
}

function banner(title: string): void {
  console.log("=".repeat(65));
  console.log(`  ${title}`);
  console.log("=".repeat(65));
  console.log();
}

function demoArithmetic(): void {
  banner("COMPLEX ARITHMETIC");

  const z1 = new Complex(3, 2);
  const z2 = new Complex(1, 4);

  console.log(`  z1 = ${z1}`);
  console.log(`  z2 = ${z2}`);
  console.log();

  console.log(`  z1 + z2  = ${z1.add(z2)}`);
  console.log(`  z1 - z2  = ${z1.sub(z2)}`);
  console.log(`  z1 * z2  = ${z1.mul(z2)}`);
  console.log(`  z1 / z2  = ${z1.div(z2)}`);
  console.log();

  console.log(`  |z1|     = ${fx(z1.magnitude(), 6)}`);
  console.log(`  phase(z1)= ${fx(z1.phase(), 6)} rad (${fx(degrees(z1.phase()), 2)} deg)`);
  console.log(`  conj(z1) = ${z1.conjugate()}`);
  console.log();

  const product = z1.mul(z1.conjugate());
  const expected = z1.real ** 2 + z1.imag ** 2;
  console.log(`  z1 * conj(z1) = ${product}`);
  console.log(`  a^2 + b^2     = ${fx(expected, 6)}`);
  console.log(`  Match: ${pyBool(Math.abs(product.real - expected) < 1e-10)}`);
  console.log();

  const z3 = new Complex(5, 2);
  const z4 = new Complex(1, -3);
  const quotient = z3.div(z4);
  const reconstructed = quotient.mul(z4);
  console.log(`  Division check: (5+2i) / (1-3i) = ${quotient}`);
  console.log(`  Reconstruct:    result * (1-3i)  = ${reconstructed}`);
  console.log(
    `  Match original: ${pyBool(Math.abs(reconstructed.real - 5) < 1e-10 && Math.abs(reconstructed.imag - 2) < 1e-10)}`,
  );
}

function demoPolarConversion(): void {
  console.log();
  console.log();
  banner("POLAR FORM AND CONVERSION");

  const testCases = [
    new Complex(1, 0),
    new Complex(0, 1),
    new Complex(-1, 0),
    new Complex(0, -1),
    new Complex(3, 4),
    new Complex(-2, 3),
  ];

  console.log(`  ${"Rectangular".padEnd(25)} ${"r".padStart(8)}  ${"theta (deg)".padStart(12)}  ${"Reconstructed".padEnd(25)}`);
  console.log(`  ${"-".repeat(25)} ${"-".repeat(8)}  ${"-".repeat(12)}  ${"-".repeat(25)}`);

  for (const z of testCases) {
    const [r, theta] = toPolar(z);
    const zBack = fromPolar(r, theta);
    console.log(
      `  ${String(z).padEnd(25)} ${fx(r, 4).padStart(8)}  ${fx(degrees(theta), 2).padStart(12)}  ${String(zBack).padEnd(25)}`,
    );
  }
}

function demoEulerFormula(): void {
  console.log();
  console.log();
  banner("EULER'S FORMULA: e^(i*theta) = cos(theta) + i*sin(theta)");

  const angles = [0, Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI, (3 * Math.PI) / 2, 2 * Math.PI];
  const labels = ["0", "pi/6", "pi/4", "pi/3", "pi/2", "pi", "3pi/2", "2pi"];

  console.log(
    `  ${"theta".padEnd(8)} ${"cos(theta)".padStart(12)} ${"sin(theta)".padStart(12)} ` +
      `${"e^(i*theta)".padStart(25)} ${"|e^(i*theta)|".padStart(14)}`,
  );
  console.log(`  ${"-".repeat(8)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(25)} ${"-".repeat(14)}`);

  labels.forEach((label, idx) => {
    const theta = angles[idx];
    const e = euler(theta);
    console.log(
      `  ${label.padEnd(8)} ${fx(Math.cos(theta), 6).padStart(12)} ${fx(Math.sin(theta), 6).padStart(12)} ` +
        `  ${String(e).padStart(23)} ${fx(e.magnitude(), 10).padStart(14)}`,
    );
  });

  console.log();
  const ePi = euler(Math.PI);
  const result = ePi.add(new Complex(1, 0));
  console.log(`  Euler's identity: e^(i*pi) + 1 = ${result}`);
  console.log(`  |e^(i*pi) + 1| = ${ex(result.magnitude(), 2)} (should be ~0)`);
}

function demoRotation(): void {
  console.log();
  console.log();
  banner("ROTATION VIA COMPLEX MULTIPLICATION");

  const point = new Complex(3, 4);
  console.log(`  Original point: ${point}`);
  console.log(`  Magnitude: ${fx(point.magnitude(), 4)}`);
  console.log(`  Phase: ${fx(degrees(point.phase()), 2)} deg`);
  console.log();

  const rotationAngles = [45, 90, 180, 270, 360];

  console.log(`  ${"Rotation".padEnd(12)} ${"Result".padEnd(30)} ${"Magnitude".padStart(10)} ${"Phase (deg)".padStart(12)}`);
  console.log(`  ${"-".repeat(12)} ${"-".repeat(30)} ${"-".repeat(10)} ${"-".repeat(12)}`);

  for (const deg of rotationAngles) {
    const rad = radians(deg);
    const rotated = point.mul(euler(rad));
    const [r, theta] = toPolar(rotated);
    console.log(
      `  ${String(deg).padStart(3)} deg     ${String(rotated).padEnd(30)} ${fx(r, 4).padStart(10)} ${fx(degrees(theta), 2).padStart(12)}`,
    );
  }

  console.log();
  console.log("  Magnitude is preserved through all rotations.");
  console.log("  360 degrees returns to the original point.");
  console.log();

  console.log("  Rotation matrix equivalence check:");
  console.log();

  const testAngles = [Math.PI / 6, Math.PI / 4, Math.PI / 3, Math.PI / 2, Math.PI];
  const testPoints = [new Complex(1, 0), new Complex(3, 4), new Complex(-2, 5)];

  let maxError = 0.0;
  for (const theta of testAngles) {
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    for (const p of testPoints) {
      const complexResult = p.mul(euler(theta));
      const matrixX = cosT * p.real - sinT * p.imag;
      const matrixY = sinT * p.real + cosT * p.imag;

      const err = Math.sqrt((complexResult.real - matrixX) ** 2 + (complexResult.imag - matrixY) ** 2);
      maxError = Math.max(maxError, err);
    }
  }

  console.log("  Max difference between complex multiplication");
  console.log(`  and rotation matrix: ${ex(maxError, 2)}`);
}

function demoRootsOfUnity(): void {
  console.log();
  console.log();
  banner("ROOTS OF UNITY");

  for (const N of [4, 8]) {
    const roots = rootsOfUnity(N);
    console.log(`  ${N}-th roots of unity:`);
    console.log(`  ${"k".padEnd(4)} ${"Root".padEnd(30)} ${"|root|".padStart(8)}`);
    console.log(`  ${"-".repeat(4)} ${"-".repeat(30)} ${"-".repeat(8)}`);

    let total = new Complex(0, 0);
    roots.forEach((root, k) => {
      total = total.add(root);
      console.log(`  ${String(k).padEnd(4)} ${String(root).padEnd(30)} ${fx(root.magnitude(), 6).padStart(8)}`);
    });

    console.log(`  Sum of all roots: ${total}`);
    console.log(`  |sum| = ${ex(total.magnitude(), 2)} (should be ~0)`);
    console.log();
  }

  console.log("  Roots of unity always sum to zero.");
  console.log("  Each root has magnitude exactly 1.");
}

function demoDft(): void {
  console.log();
  console.log();
  banner("DFT OF A SIMPLE SIGNAL");

  const N = 32;
  const freq1 = 3;
  const freq2 = 7;
  const amp1 = 1.0;
  const amp2 = 0.5;

  const signal: number[] = [];
  for (let n = 0; n < N; n++) {
    const t = n / N;
    const val = amp1 * Math.sin(2 * Math.PI * freq1 * t) + amp2 * Math.sin(2 * Math.PI * freq2 * t);
    signal.push(val);
  }

  console.log(`  Signal: ${pyFloat(amp1)}*sin(2*pi*${freq1}*t) + ${pyFloat(amp2)}*sin(2*pi*${freq2}*t)`);
  console.log(`  ${N} samples`);
  console.log();

  const spectrum = dft(signal);

  console.log(`  ${"Freq bin".padEnd(10)} ${"|X[k]|".padStart(10)} ${"Phase (deg)".padStart(12)}`);
  console.log(`  ${"-".repeat(10)} ${"-".repeat(10)} ${"-".repeat(12)}`);

  for (let k = 0; k < Math.floor(N / 2) + 1; k++) {
    const mag = spectrum[k].magnitude();
    if (mag > 0.01) {
      const phaseDeg = degrees(spectrum[k].phase());
      console.log(`  k=${String(k).padEnd(6)} ${fx(mag, 4).padStart(10)} ${fx(phaseDeg, 2).padStart(12)}`);
    }
  }

  console.log();
  console.log(`  Expected peaks at k=${freq1} (amplitude ${fx((amp1 * N) / 2, 1)})`);
  console.log(`  and k=${freq2} (amplitude ${fx((amp2 * N) / 2, 1)})`);
  console.log();

  const reconstructed = idft(spectrum);
  let maxErr = -Infinity;
  for (let n = 0; n < N; n++) maxErr = Math.max(maxErr, Math.abs(reconstructed[n].real - signal[n]));
  console.log(`  IDFT reconstruction error: ${ex(maxErr, 2)}`);
  console.log(`  Perfect reconstruction: ${pyBool(maxErr < 1e-10)}`);
}

function demoPhasor(): void {
  console.log();
  console.log();
  banner("PHASORS: ROTATING COMPLEX NUMBERS AS SIGNALS");

  const omega = 2 * Math.PI * 3;
  const N = 16;

  console.log(`  Phasor: e^(i*${3}*2*pi*t), sampled at ${N} points`);
  console.log();
  console.log(`  ${"t".padStart(6)} ${"Real (cos)".padStart(12)} ${"Imag (sin)".padStart(12)} ${"Magnitude".padStart(10)}`);
  console.log(`  ${"-".repeat(6)} ${"-".repeat(12)} ${"-".repeat(12)} ${"-".repeat(10)}`);

  for (let n = 0; n < N; n++) {
    const t = n / N;
    const phasor = euler(omega * t);
    console.log(
      `  ${fx(t, 3).padStart(6)} ${fx(phasor.real, 6).padStart(12)} ${fx(phasor.imag, 6).padStart(12)} ${fx(phasor.magnitude(), 6).padStart(10)}`,
    );
  }

  console.log();
  console.log("  The real part traces cos(6*pi*t).");
  console.log("  The imaginary part traces sin(6*pi*t).");
  console.log("  Magnitude is always 1 -- the phasor stays on the unit circle.");
}

function demoPositionalEncoding(): void {
  console.log();
  console.log();
  banner("TRANSFORMER POSITIONAL ENCODING FREQUENCIES");

  const dModel = 8;
  const maxPos = 10;
  const half = Math.floor(dModel / 2);

  console.log(`  d_model = ${dModel}, showing first ${maxPos} positions`);
  console.log();
  console.log("  Frequencies (1/10000^(2i/d)):");
  const freqs: number[] = [];
  for (let i = 0; i < half; i++) {
    const freq = 1.0 / 10000 ** ((2 * i) / dModel);
    freqs.push(freq);
    console.log(`    dim pair ${i}: freq = ${fx(freq, 6)}`);
  }

  console.log();
  console.log("  PE matrix (sin/cos pairs for each position):");
  console.log();

  let header = "  pos";
  for (let i = 0; i < half; i++) {
    header += `  sin_${i}     cos_${i}  `;
  }
  console.log(header);
  console.log(`  ${"-".repeat(5 + half * 20)}`);

  for (let pos = 0; pos < maxPos; pos++) {
    let line = `  ${String(pos).padStart(3)}`;
    for (let i = 0; i < half; i++) {
      const angle = pos * freqs[i];
      line += `  ${fx(Math.sin(angle), 4).padStart(7)}  ${fx(Math.cos(angle), 4).padStart(7)}`;
    }
    console.log(line);
  }

  console.log();
  console.log("  Each (sin, cos) pair is the real and imaginary part");
  console.log("  of e^(i * pos * freq). Different frequencies give each");
  console.log("  position a unique 'fingerprint' in the complex plane.");
}

const SKILL_LINES = [
  "---\n",
  "name: skill-complex-arithmetic\n",
  "description: Quick reference for complex number operations in ML and signal processing contexts\n",
  "phase: 1\n",
  "lesson: 19\n",
  "---\n\n",
  "You are an expert in complex number arithmetic for machine learning and signal processing.\n\n",
  "When someone asks about complex numbers, Fourier transforms, rotations, or positional encodings:\n\n",
  "1. Identify which representation is best: rectangular (a + bi) for addition, polar (r * e^(i*theta)) for multiplication and rotation.\n\n",
  "2. Key conversions:\n",
  "   - Rectangular to polar: r = sqrt(a^2 + b^2), theta = atan2(b, a)\n",
  "   - Polar to rectangular: a = r*cos(theta), b = r*sin(theta)\n",
  "   - Euler's formula: e^(i*theta) = cos(theta) + i*sin(theta)\n\n",
  "3. Common operations and their geometric meaning:\n",
  "   - Addition: vector addition in the complex plane\n",
  "   - Multiplication: rotate by arg(z2) and scale by |z2|\n",
  "   - Conjugate: reflect over the real axis\n",
  "   - Division: reverse rotation and rescale\n\n",
  "4. ML connections:\n",
  "   - DFT uses roots of unity: e^(-2*pi*i*k*n/N)\n",
  "   - Positional encodings: sin/cos pairs are real/imag parts of complex exponentials\n",
  "   - RoPE: explicit complex multiplication for position-dependent rotation of query/key vectors\n",
  "   - FFT: recursive DFT using symmetry of roots of unity, O(N log N)\n\n",
  "5. Quick checks:\n",
  "   - |e^(i*theta)| = 1 always\n",
  "   - z * conj(z) = |z|^2 (always real)\n",
  "   - Sum of N-th roots of unity = 0\n",
  "   - e^(i*pi) + 1 = 0 (Euler's identity)\n",
  "   - Multiplying by e^(i*theta) rotates by theta radians\n\n",
  "6. Python quick reference:\n",
  "   - Built-in: z = 3+2j, abs(z), z.conjugate(), z.real, z.imag\n",
  "   - cmath: cmath.phase(z), cmath.exp(1j*theta), cmath.polar(z)\n",
  "   - numpy: np.abs(z), np.angle(z), np.conj(z), np.fft.fft(signal)\n",
];

function writeSkillOutput(): void {
  const scriptDir = __dirname;
  const outputPath = join(dirname(scriptDir), "outputs", "skill-complex-arithmetic.md");
  mkdirSync(dirname(outputPath), { recursive: true });
  try {
    writeFileSync(outputPath, SKILL_LINES.join(""));
    console.log(`\n  Skill output written to ${outputPath}`);
  } catch {
    console.log("\n  Could not write skill output (run from the lesson directory)");
  }
}

function printSummary(): void {
  console.log();
  console.log();
  banner("SUMMARY");
  console.log("  1. A complex number z = a + bi is a point (a, b) in the plane.");
  console.log("  2. Multiplication rotates and scales. Division reverses it.");
  console.log("  3. Euler's formula: e^(i*theta) = cos(theta) + i*sin(theta).");
  console.log("  4. Multiplying by e^(i*theta) rotates by theta radians.");
  console.log("  5. Complex multiplication IS 2D rotation (same as rotation matrix).");
  console.log("  6. DFT decomposes signals into rotating phasors (roots of unity).");
  console.log("  7. Transformer positional encodings are complex exponentials");
  console.log("     at different frequencies.");
  console.log("  8. RoPE uses explicit complex multiplication for position.");
  console.log();
}

demoArithmetic();
demoPolarConversion();
demoEulerFormula();
demoRotation();
demoRootsOfUnity();
demoDft();
demoPhasor();
demoPositionalEncoding();
writeSkillOutput();
printSummary();
