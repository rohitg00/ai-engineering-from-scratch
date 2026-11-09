// Lesson: InternVL3: Native Multimodal Pretraining (phase 12 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/10-internvl3-native-multimodal/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/10-internvl3-native-multimodal/code/main.ts

export {};

function commas(n: number): string {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

class CorpusMix {
  constructor(
    public textPct: number,
    public interleavedPct: number,
    public captionPct: number,
    public videoPct: number,
  ) {}

  normalize(): void {
    const total = this.textPct + this.interleavedPct + this.captionPct + this.videoPct;
    this.textPct /= total;
    this.interleavedPct /= total;
    this.captionPct /= total;
    this.videoPct /= total;
  }

  steps(total: number): Record<string, number> {
    return {
      text: Math.trunc(total * this.textPct),
      interleaved: Math.trunc(total * this.interleavedPct),
      caption: Math.trunc(total * this.captionPct),
      video: Math.trunc(total * this.videoPct),
    };
  }
}

interface RouterTier {
  name: string;
  tokens: number;
  fraction: number;
}

function virSim(tiers: RouterTier[]): { avg_tokens: number; baseline: number; ratio: number } {
  const avg = tiers.reduce((s, t) => s + t.tokens * t.fraction, 0);
  const baseline = Math.max(...tiers.map((t) => t.tokens));
  return { avg_tokens: avg, baseline, ratio: baseline / avg };
}

function dvdThroughput(
  encoderFlops: number,
  llmFlops: number,
  llmTokens = 128,
): { colocated: number; decoupled: number; speedup: number } {
  const colocated = encoderFlops + llmFlops * llmTokens;
  const decoupled = Math.max(encoderFlops, llmFlops * llmTokens);
  return { colocated, decoupled, speedup: colocated / decoupled };
}

function posthocVsNativeTable(): void {
  console.log("\nPOST-HOC vs NATIVE PRETRAINING");
  console.log("-".repeat(60));
  const rows: [string, string, string][] = [
    ["metric", "post-hoc", "native"],
    ["-".repeat(22), "-".repeat(12), "-".repeat(12)],
    ["total GPU-hours", "~30k", "~300k"],
    ["base LLM reuse", "yes", "no"],
    ["alignment debt", "visible", "negligible"],
    ["MMLU regression", "-2 to -8", "0"],
    ["GSM8K regression", "-3 to -10", "0"],
    ["corpus flexibility", "instr only", "interleaved"],
    ["base-LLM swap later", "possible", "impossible"],
    ["examples", "LLaVA, Qwen-VL v1", "InternVL3, GPT-4o, Chameleon"],
  ];
  for (const r of rows) console.log(`  ${r[0].padEnd(22)}${r[1].padEnd(14)}${r[2]}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("INTERNVL3 NATIVE PRETRAINING (Phase 12, Lesson 10)");
  console.log("=".repeat(60));

  const mix = new CorpusMix(40, 35, 20, 5);
  mix.normalize();
  const totalSteps = 500_000;
  const steps = mix.steps(totalSteps);
  console.log(`\nCORPUS MIX (target ${commas(totalSteps)} training steps)`);
  console.log("-".repeat(60));
  for (const [k, v] of Object.entries(steps)) {
    console.log(`  ${k.padEnd(14)}: ${commas(v).padStart(8)}  (${((v * 100) / totalSteps).toFixed(1)}%)`);
  }
  console.log("\n40% text floor keeps base LLM skills; interleaved is the key unlock");
  console.log("that lets the model learn multi-image reasoning during pretraining.");

  console.log("\nVIR ROUTING SIMULATION (production query mix)");
  console.log("-".repeat(60));
  const tiers: RouterTier[] = [
    { name: "low-res photo QA", tokens: 256, fraction: 0.5 },
    { name: "medium product shot", tokens: 576, fraction: 0.3 },
    { name: "high-res doc + OCR", tokens: 2048, fraction: 0.2 },
  ];
  for (const t of tiers) {
    console.log(
      `  ${t.name.padEnd(26)}  ${String(t.tokens).padStart(5)} tok x ${(t.fraction * 100).toFixed(0).padStart(4)}%`,
    );
  }
  const r = virSim(tiers);
  console.log(`\n  avg tokens/req  : ${r.avg_tokens.toFixed(0)}`);
  console.log(`  baseline (all high-res): ${r.baseline}`);
  console.log(`  speed-up vs baseline  : ${r.ratio.toFixed(2)}x`);
  console.log("  note: 50% of real-world queries need only low-res encoding");

  console.log("\nDVD DEPLOYMENT: encoder vs LLM parallelism");
  console.log("-".repeat(60));
  const encoderGflops = 300;
  const llmGflopsPerToken = 8;
  const d = dvdThroughput(encoderGflops, llmGflopsPerToken, 128);
  console.log(`  encoder: ${encoderGflops} GFLOPs per image`);
  console.log(`  LLM    : ${llmGflopsPerToken} GFLOPs per output token, 128 tokens`);
  console.log(`  colocated total: ${d.colocated} GFLOPs`);
  console.log(`  decoupled bottleneck: ${d.decoupled} GFLOPs`);
  console.log(`  speedup: ${d.speedup.toFixed(2)}x with DvD`);

  posthocVsNativeTable();
}

main();
