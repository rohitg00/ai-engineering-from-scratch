// Lesson: Capstone 03: Real-Time Voice Assistant (ASR to LLM to TTS) (phase 19 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/03-realtime-voice-assistant/docs/en.md
// Run: npx tsx phases/19-capstone-projects/03-realtime-voice-assistant/code/main.ts

export {};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let random = mulberry32(0);

interface Frame {
  t_ms: number;
  is_speech: boolean;
  partial: string;
}

function frame(t_ms: number, is_speech: boolean, partial: string = ""): Frame {
  return { t_ms, is_speech, partial };
}

function synthCall(script: string, startMs: number = 0, noise: number = 0.0): Frame[] {
  const words = script.split(/\s+/).filter((w) => w.length > 0);
  const frames: Frame[] = [];
  let t = startMs;
  for (let i = 0; i < 6; i++) {
    frames.push(frame(t, random() < noise));
    t += 20;
  }
  let partial = "";
  for (const w of words) {
    partial = (partial + " " + w).trim();
    for (let i = 0; i < 16; i++) {
      frames.push(frame(t, true, partial));
      t += 20;
    }
  }
  for (let i = 0; i < 110; i++) {
    frames.push(frame(t, false, partial));
    t += 20;
  }
  return frames;
}

function turnCompletionScore(partial: string): number {
  if (!partial) return 0.0;
  const r = partial.trimEnd();
  if (r.endsWith("?") || r.endsWith(".") || r.endsWith("!")) return 0.95;
  const n = partial.split(/\s+/).filter((w) => w.length > 0).length;
  if (n < 3) return 0.2;
  if (n < 6) return 0.55;
  return 0.75;
}

enum State {
  IDLE,
  LISTENING,
  WAITING,
  THINKING,
  SPEAKING,
  TOOL,
}

class Metrics {
  events: string[] = [];
  turn_complete_ms = 0;
  first_llm_token_ms = 0;
  first_audio_out_ms = 0;
  false_cutoffs = 0;
  barge_ins = 0;

  log(msg: string): void {
    this.events.push(msg);
  }

  latencyMs(): number {
    if (this.turn_complete_ms && this.first_audio_out_ms) return this.first_audio_out_ms - this.turn_complete_ms;
    return -1;
  }
}

interface Tool {
  name: string;
  latency_ms: number;
  result: string;
}

const WEATHER: Tool = { name: "weather.tokyo_tomorrow", latency_ms: 420, result: "68/52 partly cloudy" };

function runSession(frames: Frame[], useTool: boolean = true, bargeInAtMs: number | null = null): Metrics {
  const m = new Metrics();
  let state = State.IDLE;
  let silenceRunMs = 0;
  let finalPartial = "";
  let llmStreamStartedAt = -1;
  let ttsStreamStartedAt = -1;
  let toolStartedAt = -1;
  let toolDoneAt = -1;
  let fillerEmitted = false;

  for (const f of frames) {
    if (bargeInAtMs !== null && f.t_ms >= bargeInAtMs && (state === State.SPEAKING || state === State.THINKING) && f.is_speech) {
      m.barge_ins += 1;
      m.log(`${f.t_ms}ms BARGE-IN: cancel TTS, re-arm ASR`);
      state = State.LISTENING;
      ttsStreamStartedAt = -1;
      llmStreamStartedAt = -1;
      continue;
    }

    if (state === State.IDLE) {
      if (f.is_speech) {
        state = State.LISTENING;
        m.log(`${f.t_ms}ms LISTENING`);
      }
    } else if (state === State.LISTENING) {
      if (f.is_speech) {
        silenceRunMs = 0;
        finalPartial = f.partial || finalPartial;
      } else {
        silenceRunMs += 20;
        if (silenceRunMs >= 500) {
          const score = turnCompletionScore(finalPartial);
          if (score >= 0.6) {
            state = State.WAITING;
            m.turn_complete_ms = f.t_ms;
            m.log(`${f.t_ms}ms TURN COMPLETE (score=${score.toFixed(2)}) partial='${finalPartial}'`);
          } else {
            m.log(`${f.t_ms}ms SILENCE but score=${score.toFixed(2)}, waiting`);
          }
        }
      }
    }

    if (state === State.WAITING) {
      llmStreamStartedAt = f.t_ms + 140;
      state = State.THINKING;
      m.log(`${f.t_ms}ms LLM call fired`);
      if (useTool) {
        toolStartedAt = f.t_ms;
        state = State.TOOL;
      }
    } else if (state === State.TOOL) {
      if (toolStartedAt >= 0 && !fillerEmitted) {
        if (f.t_ms - toolStartedAt >= 300) {
          fillerEmitted = true;
          m.log(`${f.t_ms}ms filler 'one second, let me check'`);
        }
      }
      if (toolStartedAt >= 0 && f.t_ms - toolStartedAt >= WEATHER.latency_ms) {
        toolDoneAt = f.t_ms;
        m.log(`${f.t_ms}ms tool result: ${WEATHER.result}`);
        llmStreamStartedAt = f.t_ms + 140;
        state = State.THINKING;
      }
    } else if (state === State.THINKING) {
      if (llmStreamStartedAt > 0 && f.t_ms >= llmStreamStartedAt) {
        if (m.first_llm_token_ms === 0) {
          m.first_llm_token_ms = f.t_ms;
          m.log(`${f.t_ms}ms LLM first token`);
        }
        ttsStreamStartedAt = f.t_ms + 180;
        state = State.SPEAKING;
      }
    } else if (state === State.SPEAKING) {
      if (ttsStreamStartedAt > 0 && f.t_ms >= ttsStreamStartedAt) {
        if (m.first_audio_out_ms === 0) {
          m.first_audio_out_ms = f.t_ms;
          m.log(`${f.t_ms}ms TTS first audio-out`);
        }
      }
    }
  }

  return m;
}

function main(): void {
  random = mulberry32(0);
  console.log("=== session 1: clean call with tool (weather) ===");
  let frames = synthCall("what is the weather in tokyo tomorrow", 0);
  let m = runSession(frames, true, null);
  for (const line of m.events) console.log(" ", line);
  console.log(`  turn_complete  @ ${m.turn_complete_ms}ms`);
  console.log(`  first_llm_tok  @ ${m.first_llm_token_ms}ms`);
  console.log(`  first_audio_out @ ${m.first_audio_out_ms}ms`);
  console.log(`  turn latency   = ${m.latencyMs()}ms`);

  console.log();
  console.log("=== session 2: user barges in mid-response ===");
  frames = synthCall("tell me a long story about", 0);
  for (let i = 0; i < 8; i++) {
    const idx = frames.length - 20 + i;
    if (idx >= 0 && idx < frames.length) frames[idx] = frame(frames[idx].t_ms, true, frames[idx].partial);
  }
  m = runSession(frames, false, frames[frames.length - 20].t_ms - 60);
  for (const line of m.events) console.log(" ", line);
  console.log(`  barge_ins = ${m.barge_ins}`);
}

main();
