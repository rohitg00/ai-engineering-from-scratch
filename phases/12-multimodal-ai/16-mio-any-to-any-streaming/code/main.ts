// Lesson: MIO and Any-to-Any Streaming Multimodal Models (phase 12 / lesson 16)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/16-mio-any-to-any-streaming/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/16-mio-any-to-any-streaming/code/main.ts

export {};

class VocabSlot {
  constructor(
    public name: string,
    public start: number,
    public size: number,
  ) {}

  get end(): number {
    return this.start + this.size;
  }
}

function buildVocab(): VocabSlot[] {
  const slots: VocabSlot[] = [];
  let cursor = 0;
  const plan: [string, number][] = [
    ["text BPE", 32000],
    ["image SEED", 8192],
    ["speech 4x1024", 4096],
    ["music", 8192],
    ["<image>", 1],
    ["</image>", 1],
    ["<speech>", 1],
    ["</speech>", 1],
    ["<music>", 1],
    ["</music>", 1],
  ];
  for (const [name, size] of plan) {
    slots.push(new VocabSlot(name, cursor, size));
    cursor += size;
  }
  return slots;
}

function printVocab(slots: VocabSlot[]): void {
  console.log("\nSHARED VOCABULARY LAYOUT");
  console.log("-".repeat(60));
  console.log(`  ${"slot".padEnd(18)}${"start".padStart(8)}${"end".padStart(8)}${"size".padStart(8)}`);
  for (const s of slots) {
    console.log(
      `  ${s.name.padEnd(18)}${String(s.start).padStart(8)}${String(s.end).padStart(8)}${String(s.size).padStart(8)}`,
    );
  }
  const total = slots[slots.length - 1].end;
  console.log(`  ${"TOTAL".padEnd(18)}${String(total).padStart(8)}${"(vocab size)".padStart(16)}`);
}

interface Input {
  kind: string;
  payload: string;
}

interface Routed extends Input {
  path: string;
}

function routeInputs(inputs: Input[]): Routed[] {
  const routed: Routed[] = [];
  for (const inp of inputs) {
    const kind = inp.kind;
    let path: string;
    if (kind === "text") {
      path = "BPE";
    } else if (kind === "image") {
      path = "SEED-Tokenizer";
    } else if (kind === "speech" || kind === "voice") {
      path = "SpeechTokenizer residual-VQ";
    } else if (kind === "music") {
      path = "Encodec";
    } else {
      path = "UNKNOWN";
    }
    routed.push({ ...inp, path });
  }
  return routed;
}

interface LatencyTrace {
  label: string;
  ms: number;
}

function streamingDecodeLatency(promptAudioSeconds = 2.0, modelSizeB = 8): LatencyTrace[] {
  const trace: LatencyTrace[] = [];
  trace.push({ label: "mic audio -> speech tokens", ms: promptAudioSeconds * 20 });
  trace.push({ label: "prefill prompt tokens", ms: 80 * (modelSizeB / 8.0) });
  trace.push({ label: "first output token", ms: 40 * (modelSizeB / 8.0) });
  trace.push({ label: "residual-VQ layers 1..7", ms: 30 });
  trace.push({ label: "speech decoder (Encodec-like)", ms: 80 });
  return trace;
}

function printTrace(trace: LatencyTrace[]): void {
  console.log("\nSTREAMING DECODE LATENCY (time-to-first-audio-byte)");
  console.log("-".repeat(60));
  let total = 0.0;
  for (const t of trace) {
    total += t.ms;
    console.log(
      `  ${t.label.padEnd(38)}  +${t.ms.toFixed(0).padStart(5)} ms   (cumul ${total.toFixed(0).padStart(6)})`,
    );
  }
  console.log("-".repeat(60));
  console.log(`  total TTFAB: ${total.toFixed(0)} ms`);
  if (total < 500) {
    console.log("  -> conversational feel (GPT-4o-class)");
  } else if (total < 800) {
    console.log("  -> acceptable (first-gen open any-to-any)");
  } else {
    console.log("  -> sluggish, consider smaller model or parallel decode");
  }
}

function demoChainOfVisualThought(): void {
  console.log("\nCHAIN-OF-VISUAL-THOUGHT (MIO)");
  console.log("-".repeat(60));
  const prompt = "Is the cat climbing the tree in this photo?";
  const steps = [
    "user text -> vision tokens",
    "model sketches intermediate image <image> ... </image>",
    "model emits text analysis of sketch",
    "model concludes with yes/no + justification",
  ];
  console.log(`  prompt: ${prompt}`);
  steps.forEach((s, i) => console.log(`    step ${i + 1}: ${s}`));
  console.log("  wins on spatial-reasoning benchmarks; hurts latency.");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("MIO ANY-TO-ANY STREAMING (Phase 12, Lesson 16)");
  console.log("=".repeat(60));

  const vocab = buildVocab();
  printVocab(vocab);

  console.log("\nROUTER: four inputs -> four tokenizers");
  console.log("-".repeat(60));
  const inputs: Input[] = [
    { kind: "text", payload: "Hello" },
    { kind: "image", payload: "cat.png" },
    { kind: "voice", payload: "user.wav" },
    { kind: "music", payload: "loop.mp3" },
  ];
  for (const r of routeInputs(inputs)) {
    console.log(`  ${r.kind.padEnd(8)}  '${r.payload}'  -> ${r.path}`);
  }

  const trace = streamingDecodeLatency(2.0, 8);
  printTrace(trace);

  demoChainOfVisualThought();
}

main();
