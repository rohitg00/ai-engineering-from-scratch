// Lesson: Qwen-VL Family and Dynamic-FPS Video (phase 12 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/09-qwen-vl-family-dynamic-fps/code/main.ts

export {};

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}

function pyFloat(x: number): string {
  if (Object.is(x, -0)) return "-0.0";
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function pyRepr(v: Json): string {
  if (v === null) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return pyStr(v);
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `${pyStr(k)}: ${pyRepr(x)}`).join(", ") + "}";
}

interface MRoPEConfig {
  hidden: number;
  temporalDim: number;
  heightDim: number;
  widthDim: number;
  base: number;
}

function mropeAngles(cfg: MRoPEConfig, t: number, h: number, w: number): number[][] {
  const angles: number[][] = [];
  const bands: [number, number][] = [
    [cfg.temporalDim, t],
    [cfg.heightDim, h],
    [cfg.widthDim, w],
  ];
  for (const [dim, pos] of bands) {
    const band: number[] = [];
    const pairs = Math.floor(dim / 2);
    for (let i = 0; i < pairs; i++) {
      const theta = cfg.base ** ((-2 * i) / dim);
      band.push(pos * theta);
    }
    angles.push(band);
  }
  return angles;
}

function mropeRotate(cfg: MRoPEConfig, vec: number[], t: number, h: number, w: number): number[] {
  const out = [...vec];
  const axes: [number, number, number][] = [
    [cfg.temporalDim, t, 0],
    [cfg.heightDim, h, cfg.temporalDim],
    [cfg.widthDim, w, cfg.temporalDim + cfg.heightDim],
  ];
  for (const [dim, pos, start] of axes) {
    const pairs = Math.floor(dim / 2);
    for (let i = 0; i < pairs; i++) {
      const theta = cfg.base ** ((-2 * i) / dim);
      const angle = pos * theta;
      const idx0 = start + 2 * i;
      const idx1 = start + 2 * i + 1;
      const c = Math.cos(angle);
      const s = Math.sin(angle);
      const v0 = out[idx0];
      const v1 = out[idx1];
      out[idx0] = v0 * c - v1 * s;
      out[idx1] = v0 * s + v1 * c;
    }
  }
  return out;
}

class VideoPlan {
  constructor(
    public durationS: number,
    public tokensPerFrame: number,
    public budget: number,
    public motion: string,
  ) {}

  fps(): number {
    const fpsMax = this.budget / (this.durationS * this.tokensPerFrame);
    let candidates: number[];
    if (this.motion === "high") {
      candidates = [8, 4, 2, 1, 0.5, 0.25];
    } else if (this.motion === "medium") {
      candidates = [4, 2, 1, 0.5, 0.25];
    } else {
      candidates = [1, 0.5, 0.25, 0.1];
    }
    for (const f of candidates) {
      if (f <= fpsMax) return f;
    }
    return candidates[candidates.length - 1];
  }

  frameTimes(): number[] {
    const f = this.fps();
    const nFrames = Math.max(1, Math.trunc(this.durationS * f));
    const step = 1.0 / f;
    const out: number[] = [];
    for (let i = 0; i < nFrames; i++) out.push(Number((i * step).toFixed(3)));
    return out;
  }

  totalTokens(): number {
    return this.frameTimes().length * this.tokensPerFrame;
  }
}

function parseToolCall(raw: string): Json {
  try {
    return JSON.parse(raw) as Json;
  } catch {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1)) as Json;
      } catch {
        return { tool: "PARSE_ERROR", raw };
      }
    }
    return { tool: "PARSE_ERROR", raw };
  }
}

function demoMrope(): void {
  console.log("\nM-RoPE position rotations for hidden=48 (16 per band)");
  console.log("-".repeat(60));
  const cfg: MRoPEConfig = { hidden: 48, temporalDim: 16, heightDim: 16, widthDim: 16, base: 10000.0 };
  const positions: [string, number, number, number][] = [
    ["text token i=0", 0, 0, 0],
    ["text token i=12", 12, 0, 0],
    ["image patch (h=5, w=7)", 0, 5, 7],
    ["video frame t=3 (h=5, w=7)", 3, 5, 7],
  ];
  for (const [name, t, h, w] of positions) {
    const angles = mropeAngles(cfg, t, h, w);
    const firstPair = angles.map((a) => pyFloat(Number(a[0].toFixed(4))));
    console.log(`  ${name.padEnd(30)} first-pair angles (t, h, w) = [${firstPair.join(", ")}]`);
  }
}

function demoSampler(): void {
  console.log("\nDYNAMIC-FPS SAMPLER (tokens_per_frame=81 after 3x pool)");
  console.log("-".repeat(60));
  const videos: [string, number, string][] = [
    ["30s tennis rally (high motion)", 30.0, "high"],
    ["30s recipe demo (medium motion)", 30.0, "medium"],
    ["10min security loop (low motion)", 600.0, "low"],
    ["1min UI agent replay (medium)", 60.0, "medium"],
  ];
  const budget = 32768;
  console.log(`budget ${budget} tokens per video:`);
  for (const [name, dur, motion] of videos) {
    const plan = new VideoPlan(dur, 81, budget, motion);
    const nFrames = plan.frameTimes().length;
    console.log(
      `  ${name.padEnd(38)}  fps=${plan.fps()}  frames=${String(nFrames).padStart(4)}  tokens=${String(plan.totalTokens()).padStart(6)}`,
    );
  }
}

function demoToolParser(): void {
  console.log("\nQWEN2.5-VL TOOL-CALL PARSER");
  console.log("-".repeat(60));
  const examples = [
    '{"tool": "mouse_click", "coords": [1024, 512], "button": "left"}',
    'Sure, clicking at {"tool": "mouse_click", "coords": [800, 400]} now.',
    '{"tool": "type_text", "text": "hello"',
    '{"tool": "scroll", "direction": "down", "amount": 300}',
  ];
  for (const raw of examples) {
    const parsed = parseToolCall(raw);
    console.log(`  raw    : ${raw}`);
    console.log(`  parsed : ${pyRepr(parsed)}`);
    console.log();
  }
}

function main(): void {
  console.log("=".repeat(60));
  console.log("QWEN-VL FAMILY (Phase 12, Lesson 09)");
  console.log("=".repeat(60));

  demoMrope();
  demoSampler();
  demoToolParser();

  console.log("=".repeat(60));
  console.log("LINEAGE SUMMARY");
  console.log("-".repeat(60));
  console.log("  Qwen-VL   (2023) : 448 res, grounding, Q-Former");
  console.log("  Qwen2-VL  (2024) : M-RoPE, native res, MLP projector");
  console.log("  Qwen2.5-VL(2025) : dynamic FPS, abs-time M-RoPE, JSON agent mode");
  console.log("  Qwen3-VL  (2025) : Qwen3 base, thinking mode, OCR scale");
}

main();
