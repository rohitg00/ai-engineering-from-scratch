// Lesson: Voice Activity Detection & Turn-Taking: Silero, Cobra, and the Flush Trick (phase 06 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/docs/en.md
// Run: npx tsx phases/06-speech-and-audio/14-voice-activity-detection-turn-taking/code/main.ts

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

function synthChunk(kind: string, rng: Random, sr = 16000, chunkMs = 20): number[] {
  const n = Math.trunc((sr * chunkMs) / 1000);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    if (kind === "speech") {
      out.push(0.2 * gaussFrom(rng, 0, 1.0));
    } else if (kind === "cough") {
      out.push(i < Math.floor(n / 5) ? 0.8 * gaussFrom(rng, 0, 1.0) : 0.001 * gaussFrom(rng, 0, 1.0));
    } else {
      out.push(0.002 * gaussFrom(rng, 0, 1.0));
    }
  }
  return out;
}

function rmsOf(chunk: number[]): number {
  let total = 0;
  for (const x of chunk) {
    total += x * x;
  }
  return (total / chunk.length) ** 0.5;
}

function energyVad(chunk: number[], thresholdDbfs = -40.0): boolean {
  const rms = rmsOf(chunk);
  return 20.0 * Math.log10(Math.max(rms, 1e-10)) > thresholdDbfs;
}

function fakeSileroVad(chunk: number[], prevState: unknown, threshold = 0.5): number {
  void prevState;
  void threshold;
  const rms = rmsOf(chunk);
  const duration = chunk.length / 16000.0;
  const transient = Math.max(...chunk) - Math.min(...chunk) > 0.6 && duration < 0.03;
  if (rms > 0.08 && !transient) {
    return 0.92;
  }
  if (rms > 0.05) {
    return 0.55;
  }
  return 0.02;
}

class TurnDetector {
  state = "idle";
  speechMs = 0;
  silenceMs = 0;

  constructor(
    public silenceHangoverMs = 500,
    public minSpeechMs = 250,
    public preRollMs = 300,
  ) {}

  update(isSpeech: boolean, chunkMs = 20): string | null {
    if (isSpeech) {
      this.speechMs += chunkMs;
      this.silenceMs = 0;
      if (this.state === "idle" && this.speechMs >= this.minSpeechMs) {
        this.state = "speaking";
        return "START";
      }
    } else if (this.state === "speaking") {
      this.silenceMs += chunkMs;
      if (this.silenceMs >= this.silenceHangoverMs) {
        this.state = "idle";
        this.speechMs = 0;
        this.silenceMs = 0;
        return "END";
      }
    }
    return null;
  }
}

function main(): void {
  const rng = mulberry32(42);

  const sequence: [string, number][] = [
    ["silence", 10],
    ["speech", 40],
    ["silence", 30],
    ["cough", 1],
    ["silence", 10],
    ["speech", 25],
    ["silence", 35],
  ];

  const chunks: [string, number[]][] = [];
  for (const [kind, count] of sequence) {
    for (let r = 0; r < count; r++) {
      chunks.push([kind, synthChunk(kind, rng)]);
    }
  }

  console.log(`=== stream: ${chunks.length} chunks of 20 ms = ${chunks.length * 20} ms total ===`);
  console.log();

  const tdSilero = new TurnDetector();
  const tdEnergy = new TurnDetector();
  const eventsSilero: [number, string, string][] = [];
  const eventsEnergy: [number, string, string][] = [];

  chunks.forEach(([truth, chunk], i) => {
    const eActive = energyVad(chunk);
    const sileroProb = fakeSileroVad(chunk, null);
    const sActive = sileroProb >= 0.5;

    const eEvent = tdEnergy.update(eActive);
    const sEvent = tdSilero.update(sActive);
    if (eEvent) {
      eventsEnergy.push([i * 20, eEvent, truth]);
    }
    if (sEvent) {
      eventsSilero.push([i * 20, sEvent, truth]);
    }
  });

  console.log("=== energy-only VAD turn events (many false positives on cough) ===");
  for (const [ms, ev, truth] of eventsEnergy) {
    console.log(`  t=${String(ms).padStart(4)} ms  ${ev.padEnd(5)}  (at ${truth})`);
  }

  console.log();
  console.log("=== Silero-style VAD turn events (rejects cough) ===");
  for (const [ms, ev, truth] of eventsSilero) {
    console.log(`  t=${String(ms).padStart(4)} ms  ${ev.padEnd(5)}  (at ${truth})`);
  }

  console.log();
  console.log("=== 2026 VAD cheatsheet ===");
  const rows: [string, string, string][] = [
    ["WebRTC VAD (Google, 2013)", "50.0% TPR @ 5% FPR", "BSD"],
    ["Silero VAD (2020-2026)", "87.7% TPR @ 5% FPR", "MIT, default open"],
    ["Cobra VAD (Picovoice)", "98.9% TPR @ 5% FPR", "commercial"],
    ["pyannote segmentation", "~95% TPR @ 5% FPR", "MIT-ish, diarization-grade"],
  ];
  console.log("  | VAD                       | accuracy            | license               |");
  for (const [name, acc, lic] of rows) {
    console.log(`  | ${name.padEnd(25)} | ${acc.padEnd(19)} | ${lic.padEnd(21)} |`);
  }

  console.log();
  console.log("takeaways:");
  console.log("  - energy-only VAD fires on every transient; not for production");
  console.log("  - Silero VAD handles the cough without firing a turn start");
  console.log("  - 500 ms silence hangover = conversational sweet spot");
  console.log("  - add the flush trick for sub-200 ms end-to-end voice agents");
}

main();
