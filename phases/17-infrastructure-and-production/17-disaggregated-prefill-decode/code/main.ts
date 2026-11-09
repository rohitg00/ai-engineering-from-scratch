// Lesson: Disaggregated Prefill/Decode: NVIDIA Dynamo and llm-d (phase 17 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/17-disaggregated-prefill-decode/code/main.ts

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

const PREFILL_TOK_PER_MS = 40.0;
const DECODE_TOK_PER_MS_COLOCATED = 0.1;
const DECODE_TOK_PER_MS_DECODE_GPU = 0.18;
const KV_BYTES_PER_TOKEN_70B_FP8 = 125_000;
const NIXL_RDMA_GB_S = 100;
const NIXL_TCP_GB_S = 10;

function msColocated(prompt: number, output: number): number {
  const prefillMs = prompt / PREFILL_TOK_PER_MS;
  const decodeMs = output / DECODE_TOK_PER_MS_COLOCATED;
  return prefillMs + decodeMs;
}

function msDisaggregated(prompt: number, output: number, useRdma = true): number {
  const prefillMs = prompt / PREFILL_TOK_PER_MS;
  const kvBytes = prompt * KV_BYTES_PER_TOKEN_70B_FP8;
  const transport = useRdma ? NIXL_RDMA_GB_S : NIXL_TCP_GB_S;
  const transferMs = (kvBytes / 1e9 / transport) * 1000;
  const decodeMs = output / DECODE_TOK_PER_MS_DECODE_GPU;
  return prefillMs + transferMs + decodeMs;
}

function main(): void {
  console.log("=".repeat(95));
  console.log("DISAGGREGATED vs COLOCATED: same request, different GPU placement");
  console.log("=".repeat(95));
  const header = `${rj("prompt", 7)}  ${rj("output", 7)}  ${rj("colocated (ms)", 15)}  ${rj("disagg RDMA (ms)", 17)}  ${rj("disagg TCP (ms)", 16)}  Winner`;
  console.log(header);
  console.log("-".repeat(header.length));
  const cases: [number, number][] = [
    [256, 100],
    [512, 200],
    [1024, 300],
    [2048, 400],
    [4096, 500],
    [8192, 800],
    [16384, 1200],
    [32768, 2000],
  ];
  for (const [prompt, output] of cases) {
    const colo = msColocated(prompt, output);
    const rdma = msDisaggregated(prompt, output, true);
    const tcp = msDisaggregated(prompt, output, false);
    const winner = colo < rdma ? "colocated" : "disaggregated";
    console.log(`${rj(prompt, 7)}  ${rj(output, 7)}  ${rj(fixed(colo, 1), 14)}  ${rj(fixed(rdma, 1), 17)}  ${rj(fixed(tcp, 1), 16)}  ${winner}`);
  }

  console.log();
  console.log("Read: disaggregation wins at longer prompts where decode throughput improvement");
  console.log("on memory-optimized pool outweighs the KV transfer tax. TCP transport raises the");
  console.log("break-even; RDMA makes disaggregation profitable earlier.");
}

main();
