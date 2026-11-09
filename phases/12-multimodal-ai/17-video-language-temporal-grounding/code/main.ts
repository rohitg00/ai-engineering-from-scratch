// Lesson: Video-Language Models: Temporal Tokens and Grounding (phase 12 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/17-video-language-temporal-grounding/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/17-video-language-temporal-grounding/code/main.ts

export {};

function pyFloat(x: number): string {
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function pyList(xs: number[]): string {
  return "[" + xs.map(pyFloat).join(", ") + "]";
}

function roundHalfEven(x: number): number {
  const f = Math.floor(x);
  const diff = x - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

function round3(x: number): number {
  return Number(x.toFixed(3));
}

function uniformSample(duration: number, n: number): number[] {
  if (n <= 1) return [duration / 2];
  const step = duration / n;
  const out: number[] = [];
  for (let i = 0; i < n; i++) out.push(round3(step * (i + 0.5)));
  return out;
}

function dynamicSample(motion: number[], fpsCap = 4, totalBudget = 32): number[] {
  let totalMotion = 0;
  for (const m of motion) totalMotion += m;
  if (totalMotion === 0) return uniformSample(motion.length, totalBudget);
  const samplesPerSec: number[] = [];
  for (const m of motion) {
    const raw = (totalBudget * m) / totalMotion;
    samplesPerSec.push(Math.min(fpsCap, Math.max(1, roundHalfEven(raw))));
  }
  const times: number[] = [];
  samplesPerSec.forEach((count, secIdx) => {
    for (let j = 0; j < count; j++) {
      const t = secIdx + (j + 0.5) / count;
      times.push(round3(t));
    }
  });
  return times;
}

function iou(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  const inter = Math.max(0.0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
  const union = Math.max(aEnd, bEnd) - Math.min(aStart, bStart);
  return union > 0 ? inter / union : 0.0;
}

class Event {
  constructor(public name: string, public start: number, public end: number) {}
}

interface GroundingResult {
  recall: number;
  details: [string, number, boolean][];
}

function evaluateGrounding(predictions: Event[], groundTruth: Event[], tolIou = 0.3): GroundingResult {
  let hits = 0;
  const details: [string, number, boolean][] = [];
  for (const gt of groundTruth) {
    let bestIou = 0.0;
    for (const p of predictions) {
      if (p.name === gt.name) {
        const val = iou(p.start, p.end, gt.start, gt.end);
        if (val > bestIou) bestIou = val;
      }
    }
    const hit = bestIou >= tolIou;
    if (hit) hits += 1;
    details.push([gt.name, bestIou, hit]);
  }
  return { recall: hits / Math.max(1, groundTruth.length), details };
}

function demoSamplers(): void {
  console.log("\nFRAME SAMPLING STRATEGIES");
  console.log("-".repeat(60));
  const duration = 10.0;
  const uni = uniformSample(duration, 8);
  console.log(`  uniform   (8 frames / 10s) : ${pyList(uni)}`);
  const motion = [0.1, 0.1, 0.8, 0.9, 0.9, 0.2, 0.1, 0.5, 0.9, 0.9];
  const dyn = dynamicSample(motion, 4, 12);
  console.log(`  motion    : ${pyList(motion)}`);
  console.log(`  dynamic (12 frames total): ${pyList(dyn)}`);
  console.log("  dynamic places more frames in high-motion seconds 2-4 and 7-9");
}

function demoGrounding(): void {
  console.log("\nTEMPORAL GROUNDING EVAL (IoU >= 0.3)");
  console.log("-".repeat(60));
  const ground = [new Event("jump", 4.0, 4.5), new Event("turn", 6.0, 6.5), new Event("sit", 8.5, 9.5)];
  const predictions = [new Event("jump", 4.1, 4.7), new Event("turn", 5.8, 6.2), new Event("sit", 9.2, 9.6)];
  const result = evaluateGrounding(predictions, ground);
  console.log(`  recall@IoU0.3 : ${result.recall.toFixed(2)}`);
  for (const [name, val, hit] of result.details) {
    const tag = hit ? "HIT" : "miss";
    console.log(`    ${name.padEnd(6)} IoU=${val.toFixed(2)}  ${tag}`);
  }
}

function archCompare(): void {
  console.log("\nVIDEO VLM ARCHITECTURES");
  console.log("-".repeat(60));
  const rows: [string, string, string][] = [
    ["Video-LLaMA", "Q-former / 16 frames", "fixed clip, audio branch"],
    ["Video-LLaVA", "MLP / 8 frames", "shared image+video encoder"],
    ["VILA-1.5", "MLP / 8-16 frames", "pretraining-heavy"],
    ["Qwen2.5-VL", "time M-RoPE / dyn FPS", "absolute time, best open 2025"],
    ["LLaVA-OV-1.5", "pool / 32 frames", "unified image+multi+video"],
  ];
  console.log(`  ${"model".padEnd(14)}${"compressor".padEnd(24)}note`);
  for (const r of rows) console.log(`  ${r[0].padEnd(14)}${r[1].padEnd(24)}${r[2]}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("VIDEO-LANGUAGE TEMPORAL GROUNDING (Phase 12, Lesson 17)");
  console.log("=".repeat(60));

  demoSamplers();
  demoGrounding();
  archCompare();

  console.log("\nTAKEAWAY");
  console.log("-".repeat(60));
  console.log("  temporal tokens matter as much as the visual encoder");
  console.log("  dynamic FPS + time-aligned M-RoPE is the 2026 open-source default");
  console.log("  JSON grounded output beats free-text for downstream use");
}

main();
