// Lesson: Text-to-Speech (TTS): From Tacotron to F5 and Kokoro (phase 06 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/07-text-to-speech/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/07-text-to-speech/code/main.ts

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

function uniform(a: number, b: number): number {
  return a + (b - a) * rng();
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

const G2P: Record<string, string[]> = {
  " ": ["_"],
  a: ["AH"], b: ["B"], c: ["K"], d: ["D"], e: ["EH"],
  f: ["F"], g: ["G"], h: ["HH"], i: ["IH"], j: ["JH"],
  k: ["K"], l: ["L"], m: ["M"], n: ["N"], o: ["AO"],
  p: ["P"], q: ["K"], r: ["R"], s: ["S"], t: ["T"],
  u: ["UH"], v: ["V"], w: ["W"], x: ["K", "S"],
  y: ["Y"], z: ["Z"],
  the: ["DH", "AH"],
  ing: ["IH", "NG"],
  er: ["ER"],
  sh: ["SH"],
  ch: ["CH"],
  th: ["TH"],
  ee: ["IY"],
  oo: ["UW"],
  ow: ["AW"],
  ay: ["EY"],
  ".": ["_PAUSE_"],
  ",": ["_SHORT_"],
  "?": ["_PAUSE_"],
  "!": ["_PAUSE_"],
};

const DURATION_FRAMES: Record<string, number> = {
  AA: 9, AE: 7, AH: 6, AO: 8, AW: 9, AY: 8, B: 4, CH: 6,
  D: 4, DH: 5, EH: 6, ER: 7, EY: 8, F: 6, G: 5, HH: 4,
  IH: 5, IY: 7, JH: 6, K: 5, L: 5, M: 5, N: 5, NG: 6,
  OW: 8, OY: 9, P: 5, R: 5, S: 6, SH: 7, T: 4, TH: 5,
  UH: 6, UW: 8, V: 5, W: 5, Y: 5, Z: 6, ZH: 7,
  _: 3,
  _SHORT_: 6,
  _PAUSE_: 12,
};

function phonemize(input: string): string[] {
  const text = input.toLowerCase();
  const phones: string[] = [];
  let i = 0;
  while (i < text.length) {
    let matched = false;
    for (const length of [3, 2, 1]) {
      if (i + length <= text.length) {
        const chunk = text.slice(i, i + length);
        if (Object.prototype.hasOwnProperty.call(G2P, chunk)) {
          phones.push(...G2P[chunk]);
          i += length;
          matched = true;
          break;
        }
      }
    }
    if (!matched) {
      i += 1;
    }
  }
  return phones;
}

function duration(phones: string[], jitter = 0.1, seedValue = 0): number[] {
  seed(seedValue);
  const out: number[] = [];
  for (const p of phones) {
    const base = DURATION_FRAMES[p] ?? 5;
    const noise = Math.trunc(parseFloat(pyFixed(base * uniform(-jitter, jitter), 0)));
    out.push(Math.max(1, base + noise));
  }
  return out;
}

function melSchedule(phones: string[], durs: number[], hopMs = 12.5): [[string, number, number][], number] {
  const schedule: [string, number, number][] = [];
  let t = 0.0;
  for (let i = 0; i < Math.min(phones.length, durs.length); i++) {
    schedule.push([phones[i], t, t + durs[i] * hopMs]);
    t += durs[i] * hopMs;
  }
  return [schedule, t];
}

function main(): void {
  const text = "Please remind me to water the plants at 6 pm.";
  console.log("=== Step 1: grapheme to phoneme ===");
  console.log(`  text: '${text}'`);
  const phones = phonemize(text);
  console.log(`  phones (${phones.length}): ${phones.slice(0, 20).join(" ")}${phones.length > 20 ? "..." : ""}`);

  console.log();
  console.log("=== Step 2: estimate per-phoneme duration ===");
  const durs = duration(phones, 0.1, 42);
  console.log(`  durations (frames): [${durs.slice(0, 20).join(", ")}]${durs.length > 20 ? "..." : ""}`);

  console.log();
  console.log("=== Step 3: mel frame schedule (12.5 ms hop) ===");
  const [sched, totalMs] = melSchedule(phones, durs);
  console.log(`  total duration: ${pyFixed(totalMs, 1)} ms  (${pyFixed(totalMs / 1000, 2)} s)`);
  console.log("  first 10 frames:");
  for (const [p, s, e] of sched.slice(0, 10)) {
    console.log(`    ${p.padEnd(10)} ${pyFixed(s, 1).padStart(6)} – ${pyFixed(e, 1).padStart(6)} ms`);
  }

  console.log();
  console.log("=== Step 4: total mel frames sent to vocoder ===");
  const totalFrames = durs.reduce((a, b) => a + b, 0);
  const audioSamples = totalFrames * 300;
  console.log(`  mel frames: ${totalFrames}  audio samples @ 24 kHz: ${audioSamples}`);
  console.log(`  pipeline memory budget: ${pyFixed((totalFrames * 80 * 4) / 1024, 1)} KB (mel, float32)`);

  console.log();
  console.log("=== Step 5: 2026 TTS quality board (UTMOS / CER / size) ===");
  const table: [string, number, number, string][] = [
    ["ground truth", 4.08, 1.2, "-"],
    ["F5-TTS", 3.95, 2.1, "335M"],
    ["Kokoro v0.19", 3.87, 1.8, "82M"],
    ["XTTS v2", 3.81, 3.5, "470M"],
    ["Parler-TTS L", 3.76, 2.8, "2.3B"],
    ["VITS", 3.62, 3.1, "25M"],
  ];
  console.log("  | Model             | UTMOS | CER%  | Size |");
  for (const [name, u, c, s] of table) {
    console.log(`  | ${name.padEnd(17)} | ${pyFixed(u, 2)}  | ${pyFixed(c, 1)}   | ${s.padEnd(4)} |`);
  }
}

main();
