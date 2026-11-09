// Lesson: Long-Video Understanding at Million-Token Context (phase 12 / lesson 18)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/18-long-video-million-token/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/18-long-video-million-token/code/main.ts

export {};

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

const rng = mulberry32(5);

function uniform(a: number, b: number): number {
  return a + (b - a) * rng();
}

function pyFloat(x: number): string {
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function commas(n: number): string {
  return n.toLocaleString("en-US");
}

function tokens(durationS: number, fps: number, perFrame: number): number {
  return Math.trunc(durationS * fps * perFrame);
}

function budgetTable(): void {
  console.log("\nLONG-VIDEO TOKEN BUDGETS");
  console.log("-".repeat(60));
  console.log(`${"duration".padEnd(14)}${"FPS".padStart(5)}${"per_frame".padStart(12)}${"tokens".padStart(12)}${"fits in".padStart(14)}`);
  const cases: [number, number, number, string][] = [
    [60, 1, 81, "32k+"],
    [300, 1, 81, "32k"],
    [300, 2, 81, "128k"],
    [1800, 1, 81, "256k"],
    [3600, 1, 81, "1M / LongVILA"],
    [7200, 1, 81, "Gemini 2.5 only"],
    [7200, 1, 32, "agentic retrieval"],
  ];
  for (const [dur, fps, pf, fits] of cases) {
    const t = tokens(dur, fps, pf);
    console.log(`${Math.floor(dur / 60)}min${" ".padEnd(8)}${String(fps).padStart(5)}${String(pf).padStart(12)}${commas(t).padStart(12)}   ${fits}`);
  }
}

class Needle {
  constructor(public t: number, public marker: string) {}
}

interface NihResult {
  needleTime: number;
  pctIntoVideo: number;
  recallProb: number;
}

function nihTrial(durationS: number, modelRecallCurve: [number, number][]): NihResult {
  const needleT = uniform(0, durationS);
  const needle = new Needle(needleT, "unique sticker");
  const pctIntoVideo = needle.t / durationS;
  for (const [thresh, recall] of modelRecallCurve) {
    if (pctIntoVideo <= thresh) return { needleTime: needleT, pctIntoVideo, recallProb: recall };
  }
  return { needleTime: needleT, pctIntoVideo, recallProb: modelRecallCurve[modelRecallCurve.length - 1][1] };
}

function nihSimulation(): void {
  console.log("\nNEEDLE-IN-A-HAYSTACK SIMULATION (single trial per model)");
  console.log("-".repeat(60));
  const models: [string, number, [number, number][]][] = [
    ["Qwen2.5-VL-72B @ 15min", 900, [[0.1, 0.98], [0.5, 0.9], [1.0, 0.85]]],
    ["Qwen2.5-VL-72B @ 30min", 1800, [[0.1, 0.95], [0.5, 0.85], [1.0, 0.75]]],
    ["Gemini 2.5 Pro @ 90min", 5400, [[0.1, 0.99], [0.5, 0.99], [1.0, 0.99]]],
    ["VideoAgent (retrieval) 2h", 7200, [[0.1, 0.92], [0.5, 0.92], [1.0, 0.92]]],
  ];
  for (const [name, dur, curve] of models) {
    const r = nihTrial(dur, curve);
    console.log(`  ${name.padEnd(32)}  needle@${r.needleTime.toFixed(1).padStart(6)}s  p(recall)=${r.recallProb.toFixed(2)}`);
  }
}

interface AgenticResult {
  steps: [string, string][];
  tokens: number;
}

function agenticRetrievalSim(question: string, videoDuration: number): AgenticResult {
  const trace: [string, string][] = [];
  trace.push(["LLM  ", `reading question: '${question}'`]);
  const words = question.split(/\s+/).filter((w) => w.length > 0);
  const query = words[words.length - 1].toLowerCase();
  trace.push(["LLM  ", `calling tool: find_clips(keyword='${query}')`]);
  const hits: number[] = [];
  for (let i = 0; i < 3; i++) hits.push(uniform(0, videoDuration));
  hits.sort((a, b) => a - b);
  trace.push(["TOOL ", `returned 3 clips: [${hits.map((h) => pyFloat(Number(h.toFixed(1)))).join(", ")}]`]);
  trace.push(["VLM  ", "encoding 3 x 30s clips (~7290 tokens total)"]);
  trace.push(["LLM  ", "composing answer from clip descriptions"]);
  const tokensUsed = 3 * 30 * 81 + 200;
  return { steps: trace, tokens: tokensUsed };
}

function agenticDemo(): void {
  console.log("\nVIDEOAGENT-STYLE RETRIEVAL (2-hour video)");
  console.log("-".repeat(60));
  const r = agenticRetrievalSim("at what point does the cat jump", 7200);
  for (const [role, msg] of r.steps) console.log(`  [${role}] ${msg}`);
  console.log(`\n  total tokens used: ~${commas(r.tokens)}`);
  console.log("  vs brute context 2h @ 1 FPS: ~583,000 tokens");
  console.log("  -> 99% cheaper inference for single-event queries");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("LONG-VIDEO UNDERSTANDING (Phase 12, Lesson 18)");
  console.log("=".repeat(60));

  budgetTable();
  nihSimulation();
  agenticDemo();

  console.log("\nSTRATEGY PICKER");
  console.log("-".repeat(60));
  console.log("  <15 min            : brute context (Qwen2.5-VL-72B)");
  console.log("  15-60 min          : LongVILA / Video-XL / Gemini 2.5");
  console.log("  >1h general QA     : Gemini 2.5 Pro (closed frontier)");
  console.log("  >1h specific query : VideoAgent (agentic retrieval)");
}

main();
