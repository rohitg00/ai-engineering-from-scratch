// Lesson: Many-Shot Jailbreaking (phase 18 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/docs/en.md
// Run: npx tsx phases/18-ethics-safety-alignment/13-many-shot-jailbreaking/code/main.ts

export {};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = mulberry32(41);

function fmt(x: number, d: number): string {
  const full = Math.abs(x).toFixed(Math.min(100, d + 30));
  const cut = full.indexOf(".") + 1 + d;
  const tail = full.slice(cut);
  let body: string;
  if (/^50*$/.test(tail)) {
    const lo = Number(full.slice(0, cut));
    const last = Number(full[cut - 1]);
    body = (last % 2 === 0 ? lo : lo + Math.pow(10, -d)).toFixed(d);
  } else {
    body = Math.abs(x).toFixed(d);
  }
  return (x < 0 || Object.is(x, -0) ? "-" : "") + body;
}

function targetAsr(nShots: number, alpha = 0.5, a0 = 0.02): number {
  if (nShots <= 0) {
    return 0.0;
  }
  const c = 0.03;
  return Math.min(1.0, a0 + c * nShots ** alpha);
}

function defenseAdjusted(nShots: number, alpha = 0.5): number {
  const eff = Math.min(nShots, 16);
  return targetAsr(eff, alpha);
}

function simulate(nShots: number, asrFn: (n: number) => number, trials = 500): number {
  const p = asrFn(nShots);
  let hits = 0;
  for (let i = 0; i < trials; i++) {
    if (random() < p) {
      hits += 1;
    }
  }
  return hits / trials;
}

function fitPowerLaw(shots: number[], asrs: number[]): [number, number] {
  const xs = shots.filter((s) => s > 0).map((s) => Math.log(s));
  const ys = asrs.map((a) => Math.log(Math.max(a, 1e-4)));
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  for (let i = 0; i < Math.min(xs.length, ys.length); i++) {
    num += (xs[i] - mx) * (ys[i] - my);
  }
  const den = xs.reduce((s, xi) => s + (xi - mx) ** 2, 0);
  const alpha = num / den;
  const logc = my - alpha * mx;
  return [alpha, Math.exp(logc)];
}

function main(): void {
  console.log("=".repeat(70));
  console.log("MANY-SHOT JAILBREAKING TOY (Phase 18, Lesson 13)");
  console.log("=".repeat(70));

  const shots = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512];

  console.log("\n-- undefended target (power-law ASR curve) --");
  const undef: number[] = [];
  for (const s of shots) {
    const rate = simulate(s, (n) => targetAsr(n));
    undef.push(rate);
    console.log(`  shots=${String(s).padStart(4)}   ASR=${fmt(rate, 3)}`);
  }
  const [alpha, c] = fitPowerLaw(shots, undef);
  console.log(`\n  fitted power law: ASR ~= ${fmt(c, 3)} * n^${fmt(alpha, 3)}`);

  console.log("\n-- classifier-defended target (caps effective shots at 16) --");
  for (const s of shots) {
    const rate = simulate(s, (n) => defenseAdjusted(n));
    console.log(`  shots=${String(s).padStart(4)}   ASR=${fmt(rate, 3)}`);
  }

  console.log("\n" + "=".repeat(70));
  console.log("TAKEAWAY: ASR grows power-law in shot count. the defense caps the");
  console.log("effective number of shots. preserving benign ICL while suppressing");
  console.log("harmful ICL requires a classifier that distinguishes the two at the");
  console.log("context level -- which is why classifier-based prompt modification");
  console.log("(Anthropic 2024) reports 61%->2% reduction without breaking ICL.");
  console.log("=".repeat(70));
}

main();
