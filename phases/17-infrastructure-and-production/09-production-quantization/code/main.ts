// Lesson: Production Quantization: AWQ, GPTQ, GGUF K-quants, FP8, MXFP4/NVFP4 (phase 17 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/09-production-quantization/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/09-production-quantization/code/main.ts

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

interface Format {
  name: string;
  weightBits: number;
  kvBits: number;
  engine: string;
  notes: string;
}

const FORMATS: Format[] = [
  { name: "BF16 baseline (vLLM)", weightBits: 16, kvBits: 16, engine: "vLLM", notes: "reference" },
  { name: "GGUF Q5_K_M (llama.cpp)", weightBits: 5, kvBits: 16, engine: "llama.cpp", notes: "CPU/edge" },
  { name: "GGUF Q4_K_M (llama.cpp)", weightBits: 4, kvBits: 16, engine: "llama.cpp", notes: "CPU/edge, default" },
  { name: "GPTQ-Int4 + Marlin (vLLM)", weightBits: 4, kvBits: 16, engine: "vLLM", notes: "multi-LoRA support" },
  { name: "AWQ-Int4 + Marlin (vLLM)", weightBits: 4, kvBits: 16, engine: "vLLM", notes: "best Pass@1 at INT4" },
  { name: "FP8 (vLLM / TRT-LLM)", weightBits: 8, kvBits: 8, engine: "multi", notes: "safe default reasoning" },
  { name: "NVFP4 + FP8 KV (TRT-LLM)", weightBits: 4, kvBits: 8, engine: "TRT-LLM", notes: "Blackwell aggressive" },
];

interface Memory {
  weight: number;
  kv: number;
  act: number;
  total: number;
}

function memoryBreakdown(paramsB: number, fmt: Format, concurrency = 128, ctx = 2048): Memory {
  const weightGb = (paramsB * fmt.weightBits) / 8;
  const layers = 64 * Math.sqrt(paramsB / 70.0);
  const kvHeads = 8;
  const headDim = 128;
  const perSeqKvGb = (layers * 2 * kvHeads * headDim * ctx * (fmt.kvBits / 8)) / 1e9;
  const kvTotal = perSeqKvGb * concurrency;
  const activationsGb = 0.05 * paramsB;
  return { weight: weightGb, kv: kvTotal, act: activationsGb, total: weightGb + kvTotal + activationsGb };
}

function relativeThroughput(fmt: Format): number {
  return 16 / fmt.weightBits;
}

function gpuCheck(totalGb: number): string {
  if (totalGb <= 80) return "H100 80GB";
  if (totalGb <= 141) return "H200 141GB";
  if (totalGb <= 192) return "B200 192GB";
  return "MULTI-GPU";
}

function printScenario(paramsB: number, concurrency: number, ctx: number): void {
  console.log(`Model: ${paramsB}B params  |  concurrency ${concurrency}  |  ctx ${ctx}`);
  console.log("-".repeat(98));
  console.log(
    `${lj("format", 36)} ${rj("W GB", 7)} ${rj("KV GB", 7)} ${rj("Act GB", 7)} ${rj("Total", 7)} ${rj("fits on", 14)} ${rj("rel tput", 10)}`,
  );
  for (const f of FORMATS) {
    const m = memoryBreakdown(paramsB, f, concurrency, ctx);
    const tput = relativeThroughput(f);
    console.log(
      `${lj(f.name, 36)} ${rj(fixed(m.weight, 1), 7)} ${rj(fixed(m.kv, 1), 7)} ${rj(fixed(m.act, 1), 7)} ` +
        `${rj(fixed(m.total, 1), 7)} ${rj(gpuCheck(m.total), 14)} ${rj(fixed(tput, 2), 10)}x`,
    );
  }
  console.log();
}

function main(): void {
  console.log("=".repeat(98));
  console.log("TOY QUANTIZATION CALCULATOR: memory and relative throughput by format");
  console.log("=".repeat(98));
  console.log();

  printScenario(7, 128, 2048);
  printScenario(70, 128, 2048);
  printScenario(70, 256, 8192);
  printScenario(405, 128, 2048);

  console.log("=".repeat(98));
  console.log("KEY FINDINGS");
  console.log("-".repeat(98));
  console.log("  1. KV cache grows linearly with concurrency x context.");
  console.log("     At 256 conc / 8k ctx on 70B, KV alone dwarfs weight savings.");
  console.log("  2. AWQ vs GPTQ = same 4-bit footprint; choice is about LoRA support and kernels.");
  console.log("  3. NVFP4 + FP8 KV stacks: shrink weights AND KV ; Blackwell-only.");
  console.log("  4. For reasoning workloads, FP8 is the safe default despite higher memory.");
  console.log("  5. GGUF wins on CPU ; ~93 tok/s in vLLM is not a bug, it is the wrong engine.");
}

main();
