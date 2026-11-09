// Lesson: Audio-Language Models: Qwen2.5-Omni, Audio Flamingo, GPT-4o Audio (phase 06 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/10-audio-language-models/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/10-audio-language-models/code/main.ts

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

function gaussFrom(rng: Random, mu: number, sigma: number): number {
  let u1 = rng();
  while (u1 <= 0) {
    u1 = rng();
  }
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

type Item = [string, number];

function fakeAudioEncoder(audioSeconds = 3.0, dim = 1280): number[][] {
  const rng = mulberry32(0);
  const nFrames = Math.trunc(audioSeconds * 50);
  const out: number[][] = [];
  for (let f = 0; f < nFrames; f++) {
    const row: number[] = [];
    for (let d = 0; d < dim; d++) {
      row.push(gaussFrom(rng, 0, 0.5));
    }
    out.push(row);
  }
  return out;
}

function projector(features: number[][], audioDim = 1280, llmDim = 4096): number[][] {
  const rng = mulberry32(1);
  const wDown: Float64Array[] = [];
  for (let i = 0; i < llmDim; i++) {
    const row = new Float64Array(audioDim);
    for (let j = 0; j < audioDim; j++) {
      row[j] = gaussFrom(rng, 0, 0.02);
    }
    wDown.push(row);
  }
  const out: number[][] = [];
  for (const f of features) {
    const hidden: number[] = [];
    for (let i = 0; i < llmDim; i++) {
      let total = 0;
      const row = wDown[i];
      for (let j = 0; j < audioDim; j++) {
        total += row[j] * f[j];
      }
      hidden.push(Math.max(0.0, total));
    }
    out.push(hidden);
  }
  return out;
}

function interleaveWithText(audioTokens: number[], textTokens: number[]): Item[] {
  return [...audioTokens.map((a): Item => ["AUDIO", a]), ...textTokens.map((t): Item => ["TEXT", t])];
}

function fakeLlmAnswer(interleaved: Item[]): string {
  const nAudio = interleaved.filter(([k]) => k === "AUDIO").length;
  const nText = interleaved.filter(([k]) => k === "TEXT").length;
  return `(simulated) given ${nAudio} audio tokens + ${nText} text tokens, I would answer...`;
}

function main(): void {
  console.log("=== Step 1: encode 3 s of audio → features (pretend Whisper-large) ===");
  const feats = fakeAudioEncoder(3.0);
  console.log(`  audio features: (${feats.length} frames, ${feats[0].length} dim)`);

  console.log();
  console.log("=== Step 2: projector → LLM embedding space ===");
  const projected = projector(feats.slice(0, 8));
  console.log(`  projected (first 8 frames): (${projected.length}, ${projected[0].length})`);

  console.log();
  console.log("=== Step 3: interleave with text token ids ===");
  const textTokens = [2345, 1098, 7, 9821, 65];
  const interleaved = interleaveWithText(
    projected.map((_, i) => i),
    textTokens,
  );
  console.log(`  interleaved sequence length: ${interleaved.length}`);
  console.log(`  first 12 items: [${interleaved.slice(0, 12).map(([k, v]) => `('${k}', ${v})`).join(", ")}]`);

  console.log();
  console.log("=== Step 4: LLM decoder generates an answer ===");
  const answer = fakeLlmAnswer(interleaved);
  console.log(`  ${answer}`);

  console.log();
  console.log("=== Step 5: 2026 LALM benchmark board (MMAU-Pro) ===");
  const models: [string, string, string, string, string, string][] = [
    ["Gemini 2.5 Pro", "~60%", "73.4%", "51.9%", "64.9%", "~22%"],
    ["Gemini 2.5 Flash", "~57%", "73.4%", "50.5%", "64.9%", "21.2%"],
    ["GPT-4o Audio", "52.5%", "-", "-", "-", "26.5%"],
    ["Qwen2.5-Omni-7B", "52.2%", "57.4%", "47.6%", "61.5%", "~20%"],
    ["Audio Flamingo 3", "~54%", "-", "-", "-", "-"],
  ];
  console.log("  | model              | overall | speech | sound  | music  | multi  |");
  for (const [name, o, s, snd, m, mu] of models) {
    console.log(`  | ${name.padEnd(18)} | ${o.padStart(7)} | ${s.padStart(6)} | ${snd.padStart(6)} | ${m.padStart(6)} | ${mu.padStart(6)} |`);
  }

  console.log();
  console.log("takeaways:");
  console.log("  - every LALM = audio encoder + projector + LLM decoder");
  console.log("  - Qwen2.5-Omni-7B (Apache-2.0) is within 0.3 points of GPT-4o Audio");
  console.log("  - multi-audio reasoning is near-random (~22-26%) across ALL models in 2026");
  console.log("  - Audio Flamingo Next leads LongAudioBench (beats Gemini 2.5 Pro)");
}

main();
