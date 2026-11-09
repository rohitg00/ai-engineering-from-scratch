// Lesson: Whisper: Architecture & Fine-Tuning (phase 06 / lesson 05)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/05-whisper-architecture-finetuning/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/05-whisper-architecture-finetuning/code/main.ts

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

function pyRound(x: number, d: number): number {
  return parseFloat(pyFixed(x, d));
}

const SPECIAL: Record<string, string> = {
  SOT: "<|startoftranscript|>",
  EOT: "<|endoftext|>",
  TRANSCRIBE: "<|transcribe|>",
  TRANSLATE: "<|translate|>",
  NO_TIMESTAMPS: "<|notimestamps|>",
  NO_SPEECH: "<|nospeech|>",
};

const LANG: Record<string, string> = { en: "<|en|>", fr: "<|fr|>", ja: "<|ja|>" };

function buildPrompt(language: string, task = "transcribe", timestamps = false): string[] {
  const toks = [SPECIAL.SOT, LANG[language]];
  toks.push(task === "transcribe" ? SPECIAL.TRANSCRIBE : SPECIAL.TRANSLATE);
  if (!timestamps) {
    toks.push(SPECIAL.NO_TIMESTAMPS);
  }
  return toks;
}

function chunkSchedule(totalSeconds: number, chunkS = 30.0, strideS = 5.0): [number, number][] {
  if (totalSeconds <= chunkS) {
    return [[0.0, totalSeconds]];
  }
  const out: [number, number][] = [];
  let start = 0.0;
  const step = chunkS - strideS;
  while (start < totalSeconds) {
    const end = Math.min(totalSeconds, start + chunkS);
    out.push([pyRound(start, 2), pyRound(end, 2)]);
    if (end === totalSeconds) {
      break;
    }
    start += step;
  }
  return out;
}

function encoderFrames(seconds: number, sr = 16000, hop = 160): number {
  const samples = Math.trunc(seconds * sr);
  return 1 + Math.floor((samples - 400) / hop);
}

function transformerParams(nLayers: number, dModel: number, dFf: number, nHeads: number, vocab: number): [number, number, number] {
  void nHeads;
  const perBlock = 4 * dModel * dModel + 2 * dModel * dFf + 4 * dModel;
  const enc = nLayers * perBlock;
  const dec = nLayers * (perBlock + 4 * dModel * dModel + 4 * dModel);
  const embed = vocab * dModel + 3000 * dModel;
  return [enc, dec, embed];
}

function loraParams(nLayers: number, dModel: number, rank = 16, modules: string[] = ["q_proj", "v_proj"]): number {
  const perModule = 2 * dModel * rank;
  const perBlock = modules.length * perModule;
  return nLayers * 2 * perBlock;
}

function main(): void {
  console.log("=== Step 1: build a Whisper decoder prompt ===");
  const pEn = buildPrompt("en", "transcribe", false);
  const pFr = buildPrompt("fr", "translate", false);
  const pJa = buildPrompt("ja", "transcribe", true);
  console.log(`  EN transcribe, no ts: ${pEn.join(" ")}`);
  console.log(`  FR->EN translate:    ${pFr.join(" ")}`);
  console.log(`  JA with timestamps:  ${pJa.join(" ")}`);

  console.log();
  console.log("=== Step 2: encoder frame budget ===");
  for (const secs of [1.0, 10.0, 30.0]) {
    const n = encoderFrames(secs);
    console.log(`  ${pyFixed(secs, 1).padStart(4)}s @16 kHz, 10 ms hop -> ${n} frames`);
  }
  console.log("  Whisper zero-pads all inputs to 30 s -> 3000 frames after stride-2 conv -> 1500 encoder tokens");

  console.log();
  console.log("=== Step 3: chunk schedule for a 10-min clip ===");
  const schedule = chunkSchedule(600.0, 30.0, 5.0);
  console.log(`  chunks (30 s window, 5 s stride): ${schedule.length}`);
  for (const [start, end] of schedule.slice(0, 6)) {
    console.log(`    ${pyFixed(start, 1).padStart(6)} s -> ${pyFixed(end, 1).padStart(6)} s`);
  }
  console.log(`    ... (${schedule.length - 6} more)`);

  console.log();
  console.log("=== Step 4: param counts for Large-v3-turbo vs Large-v3 ===");
  const configs: [string, number, number, number, number, number][] = [
    ["Tiny", 4, 384, 1536, 6, 51865],
    ["Base", 6, 512, 2048, 8, 51865],
    ["Small", 12, 768, 3072, 12, 51865],
    ["Medium", 24, 1024, 4096, 16, 51865],
    ["Large-v3", 32, 1280, 5120, 20, 51865],
    ["Turbo", 4, 1280, 5120, 20, 51865],
  ];
  console.log("  variant     enc     dec     embed   total  (approx, M params)");
  for (const [name, layers, d, dFf, heads, vocab] of configs) {
    let [enc, dec, embed] = transformerParams(layers, d, dFf, heads, vocab);
    if (name === "Turbo") {
      const [encBig, , embedBig] = transformerParams(32, d, dFf, heads, vocab);
      dec = enc;
      enc = encBig;
      embed = embedBig;
    }
    const total = enc + dec + embed;
    console.log(
      `  ${name.padEnd(10)}  ${pyFixed(enc / 1e6, 1).padStart(6)}  ${pyFixed(dec / 1e6, 1).padStart(6)}  ${pyFixed(embed / 1e6, 1).padStart(6)}  ${pyFixed(total / 1e6, 1).padStart(7)}`,
    );
  }

  console.log();
  console.log("=== Step 5: LoRA-r=16 on q_proj,v_proj reduces trainable params 100x+ ===");
  for (const [name, layers, d] of configs.slice(3, 6)) {
    const lp = loraParams(layers, d, 16);
    console.log(`  ${name.padEnd(10)}  LoRA-trainable: ${pyFixed(lp / 1e6, 3)} M`);
  }

  console.log();
  console.log("=== Step 6: 2026 inference recipes ===");
  const recipes: [string, string][] = [
    ["offline English, best WER", "large-v3-turbo via whisperx + Silero VAD"],
    ["long-form + word timestamps", "whisperx (forced-align via wav2vec 2.0)"],
    ["streaming (2 s latency)", "whisper-streaming or Parakeet-TDT"],
    ["mobile / edge", "whisper-tiny int8 or moonshine"],
    ["low-resource language", "LoRA fine-tune on 2-20 h domain audio"],
  ];
  for (const [s, r] of recipes) {
    console.log(`  ${s.padEnd(30)} -> ${r}`);
  }
}

main();
