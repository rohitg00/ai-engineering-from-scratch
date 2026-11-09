// Lesson: Omni Models: Qwen2.5-Omni and the Thinker-Talker Split (phase 12 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/20-omni-models-thinker-talker/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/20-omni-models-thinker-talker/code/main.ts

export {};

class StreamConfig {
  constructor(
    public thinkerB: number,
    public talkerM: number,
    public micSr: number = 16000,
    public includeVision: boolean = false,
  ) {}
}

class LatencyComponent {
  constructor(public name: string, public ms: number) {}
}

function ttfab(cfg: StreamConfig): LatencyComponent[] {
  const components: LatencyComponent[] = [];
  const micMs = 40 + Math.floor(cfg.micSr / 8000) * 5;
  components.push(new LatencyComponent("mic -> speech tokens", micMs));

  let prefill = 100 * (cfg.thinkerB / 7.0);
  if (cfg.includeVision) prefill += 80;
  components.push(new LatencyComponent("Thinker prefill (prompt + history)", prefill));

  const firstText = 40 * (cfg.thinkerB / 7.0);
  components.push(new LatencyComponent("Thinker first text token", firstText));

  const talkerFirst = Math.max(15, 20 * (cfg.talkerM / 300.0));
  components.push(new LatencyComponent("Talker first speech tokens", talkerFirst));

  const rvqDecode = 30;
  components.push(new LatencyComponent("residual-VQ decode (8 layers parallel)", rvqDecode));

  const waveDecode = 70;
  components.push(new LatencyComponent("waveform decoder (SNAC-class)", waveDecode));
  return components;
}

function pyBool(b: boolean): string {
  return b ? "True" : "False";
}

function printTtfab(cfg: StreamConfig): number {
  console.log(`\nCONFIG: Thinker=${cfg.thinkerB}B  Talker=${cfg.talkerM}M  mic=${cfg.micSr}Hz  vision=${pyBool(cfg.includeVision)}`);
  console.log("-".repeat(60));
  let total = 0.0;
  for (const c of ttfab(cfg)) {
    total += c.ms;
    console.log(`  ${c.name.padEnd(40)}  +${c.ms.toFixed(0).padStart(5)} ms  (${total.toFixed(0).padStart(6)})`);
  }
  let verdict: string;
  if (total < 250) verdict = "  -> GPT-4o class";
  else if (total < 400) verdict = "  -> conversational";
  else if (total < 700) verdict = "  -> noticeable but usable";
  else verdict = "  -> sluggish, user drift";
  console.log(`  TTFAB = ${total.toFixed(0)} ms ${verdict}`);
  return total;
}

class VADEvent {
  constructor(public timeMs: number, public kind: string) {}
}

function simulateTurnTaking(silenceThresholdMs = 200): VADEvent[] {
  const events: VADEvent[] = [];
  events.push(new VADEvent(0, "user starts speaking"));
  events.push(new VADEvent(450, "user audio tokens streaming"));
  events.push(new VADEvent(3800, "user stops speaking"));
  events.push(new VADEvent(3800 + silenceThresholdMs, "VAD triggers end-of-turn"));
  events.push(new VADEvent(3800 + silenceThresholdMs + 200, "Thinker begins prefill"));
  events.push(new VADEvent(3800 + silenceThresholdMs + 400, "Talker first audio out"));
  return events;
}

function demoVad(): void {
  console.log("\nHALF-DUPLEX TURN-TAKING (VAD silence 200ms)");
  console.log("-".repeat(60));
  for (const e of simulateTurnTaking(200)) console.log(`  t=${e.timeMs.toFixed(0).padStart(6)} ms  ${e.kind}`);
  console.log("  net response lag after user stops: ~400ms");
}

function duplexModes(): void {
  console.log("\nDUPLEX MODES");
  console.log("-".repeat(60));
  const modes: [string, string][] = [
    ["half-duplex", "user speaks, model listens; swap; clear turns"],
    ["turn-taking", "VAD silence detects end-of-turn (200-400ms)"],
    ["full-duplex", "both can speak; requires training + backchannel data"],
  ];
  for (const [mode, note] of modes) console.log(`  ${mode.padEnd(14)}: ${note}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("OMNI THINKER-TALKER STREAMING (Phase 12, Lesson 20)");
  console.log("=".repeat(60));

  const configs = [
    new StreamConfig(7, 200, 16000, false),
    new StreamConfig(7, 300, 16000, true),
    new StreamConfig(72, 300, 16000, true),
    new StreamConfig(70, 1000, 16000, true),
  ];
  for (const c of configs) printTtfab(c);

  demoVad();
  duplexModes();

  console.log("\nOPEN STREAMING DESIGNS");
  console.log("-".repeat(60));
  const designs: [string, string][] = [
    ["Mini-Omni (2024)", "first open streaming, text+speech interleaved"],
    ["Moshi (2024)", "single transformer inner-monologue, 160ms TTFAB"],
    ["Qwen2.5-Omni (3/25)", "Thinker-Talker split + TMRoPE, ~350ms TTFAB"],
    ["Qwen3-Omni (11/25)", "scaled Qwen3 base, approaches GPT-4o latency"],
  ];
  for (const [name, note] of designs) console.log(`  ${name.padEnd(22)}: ${note}`);
}

main();
