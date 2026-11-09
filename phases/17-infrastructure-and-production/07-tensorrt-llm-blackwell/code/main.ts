// Lesson: Hardware-Specialized Inference Compilation: FP8 and NVFP4 on Blackwell (phase 17 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/07-tensorrt-llm-blackwell/code/main.ts

function fixed(x: number, digits: number): string {
  const rounded = x.toFixed(digits);
  if (Math.abs(x) >= 1e21) return rounded;
  const exact = x.toFixed(100);
  const dot = exact.indexOf(".");
  if (!/^50*$/.test(exact.slice(dot + 1 + digits))) return rounded;
  const kept = digits === 0 ? exact.slice(0, dot) : exact.slice(0, dot + 1 + digits);
  return Number(kept.slice(-1)) % 2 === 0 ? kept : rounded;
}

const rj = (s: string | number, w: number): string => String(s).padStart(w);
const lj = (s: string, w: number): string => s.padEnd(w);

interface Stack {
  name: string;
  hbmGb: number;
  hbmBwTbs: number;
  weightBits: number;
  kvBits: number;
  mtpFactor: number;
  disaggFactor: number;
  pricePerGpuHour: number;
}

function stack(
  name: string,
  hbmGb: number,
  hbmBwTbs: number,
  weightBits: number,
  kvBits: number,
  mtpFactor: number,
  disaggFactor: number,
  pricePerGpuHour: number,
): Stack {
  return { name, hbmGb, hbmBwTbs, weightBits, kvBits, mtpFactor, disaggFactor, pricePerGpuHour };
}

const STACKS: Stack[] = [
  stack("H100 + BF16 + vLLM", 80, 3.35, 16, 16, 1.0, 1.0, 2.5),
  stack("H100 + FP8 + vLLM", 80, 3.35, 8, 8, 1.0, 1.0, 2.5),
  stack("H200 + FP8 + vLLM", 141, 4.8, 8, 8, 1.0, 1.0, 3.5),
  stack("B200 + NVFP4 + FP8 + TRT-LLM", 192, 8.0, 4, 8, 1.8, 1.6, 4.8),
  stack("GB200 NVL72 + TRT-LLM + Dyn", 192, 8.0, 4, 8, 1.8, 2.5, 6.2),
];

function hbmFootprintGb(paramsB: number, activeB: number, seqLen: number, s: Stack): [number, number] {
  const weightGb = (paramsB * s.weightBits) / 8;
  const layers = 64 * Math.sqrt(activeB / 35.0);
  const kvHeads = 8;
  const headDim = 128;
  const kvGb = (layers * 2 * kvHeads * headDim * seqLen * (s.kvBits / 8)) / 1e9;
  return [weightGb, kvGb];
}

function decodeThroughput(activeB: number, s: Stack): number {
  const bytesPerToken = (activeB * 1e9 * s.weightBits) / 8;
  const rawTokensPerS = (s.hbmBwTbs * 1e12) / bytesPerToken;
  return rawTokensPerS * s.mtpFactor * s.disaggFactor;
}

function costPerMillionTokens(activeB: number, s: Stack): number {
  const tps = decodeThroughput(activeB, s);
  const tokensPerHour = tps * 3600;
  return (s.pricePerGpuHour / tokensPerHour) * 1e6;
}

function printStack(paramsB: number, activeB: number, seqLen = 8192): void {
  console.log(`Model: ${paramsB}B total, ${activeB}B active, ${seqLen.toLocaleString("en-US")} tokens context`);
  console.log("-".repeat(90));
  console.log(`${lj("stack", 40)} ${rj("W GB", 7)} ${rj("KV GB", 7)} ${rj("tok/s", 9)} ${rj("$/M tok", 10)}`);
  for (const s of STACKS) {
    const [w, kv] = hbmFootprintGb(paramsB, activeB, seqLen, s);
    const tps = decodeThroughput(activeB, s);
    const cost = costPerMillionTokens(activeB, s);
    const fits = w + kv <= s.hbmGb ? "" : "  (multi-GPU)";
    console.log(`${lj(s.name, 40)} ${rj(fixed(w, 1), 7)} ${rj(fixed(kv, 2), 7)} ${rj(fixed(tps, 0), 9)} ${rj(fixed(cost, 4), 10)}${fits}`);
  }
  console.log();
}

function main(): void {
  console.log("=".repeat(90));
  console.log("TOY BLACKWELL + TRT-LLM ECONOMICS: memory-bandwidth-limited decode");
  console.log("=".repeat(90));
  console.log();

  printStack(70, 70);
  printStack(120, 36);
  printStack(405, 405);
  printStack(671, 37);

  console.log("=".repeat(90));
  console.log("KEY FINDING");
  console.log("-".repeat(90));
  console.log("  The 7x cost gap stacks from four sources:");
  console.log("    1. HBM bandwidth (H100 3.35 TB/s vs B200 8.0 TB/s) ~2.4x");
  console.log("    2. NVFP4 weights (half the bytes per token)       ~2.0x");
  console.log("    3. MTP draft (~1.8x on accepted tokens)           ~1.8x");
  console.log("    4. Disaggregation (Dynamo: ~1.6-2.5x)             ~2.0x");
  console.log("  Product ~14x raw, closer to 7x after overhead and real-traffic alpha.");
  console.log("  Validate NVFP4 quality before migrating reasoning-heavy workloads.");
}

main();
