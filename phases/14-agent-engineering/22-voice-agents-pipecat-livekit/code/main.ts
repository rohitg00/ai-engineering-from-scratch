// Lesson: Voice Agents: Pipecat and LiveKit (phase 14 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/22-voice-agents-pipecat-livekit/docs/en.md
// Run: npx tsx phases/14-agent-engineering/22-voice-agents-pipecat-livekit/code/main.ts

function pyStr(s: string): string {
  if (s.includes("'") && !s.includes('"')) return `"${s}"`;
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pyList(xs: string[]): string {
  return "[" + xs.map(pyStr).join(", ") + "]";
}

function splitWords(s: string): string[] {
  return s.split(/\s+/).filter((w) => w.length > 0);
}

class Frame {
  constructor(
    public kind: string,
    public payload: unknown,
    public direction = "downstream",
  ) {}
}

class Processor {
  next: Processor | null = null;
  prev: Processor | null = null;
  trace: string[] = [];

  constructor(public name: string) {}

  process(frame: Frame): void {
    this.trace.push(`${this.name} saw ${frame.kind}`);
    if (this.next !== null && frame.direction === "downstream") {
      this.next.process(frame);
    } else if (this.prev !== null && frame.direction === "upstream") {
      this.prev.process(frame);
    }
  }
}

class VAD extends Processor {
  override process(frame: Frame): void {
    if (frame.kind === "audio_chunk") {
      const isSpeech = Boolean(frame.payload);
      this.trace.push(`VAD: speech=${isSpeech ? "True" : "False"}`);
      if (isSpeech) super.process(new Frame("vad_speech", frame.payload));
    } else {
      super.process(frame);
    }
  }
}

class STT extends Processor {
  override process(frame: Frame): void {
    if (frame.kind === "vad_speech") {
      const transcript = String(frame.payload);
      this.trace.push(`STT: -> ${pyStr(transcript)}`);
      super.process(new Frame("transcript", transcript));
    } else {
      super.process(frame);
    }
  }
}

class LLM extends Processor {
  constructor(
    name: string,
    public replies: Map<string, string>,
  ) {
    super(name);
  }

  override process(frame: Frame): void {
    if (frame.kind === "cancel") {
      this.trace.push("LLM: cancelled");
      super.process(frame);
      return;
    }
    if (frame.kind === "transcript") {
      const text = String(frame.payload);
      const reply = this.replies.get(text) ?? "[no canned reply]";
      this.trace.push(`LLM: ${pyStr(text)}  -> ${pyStr(reply)}`);
      super.process(new Frame("text", reply));
    } else {
      super.process(frame);
    }
  }
}

class TTS extends Processor {
  cancelled = false;

  override process(frame: Frame): void {
    if (frame.kind === "cancel") {
      this.cancelled = true;
      this.trace.push("TTS: cancel received; drop pending audio");
      super.process(frame);
      return;
    }
    if (frame.kind === "text") {
      this.cancelled = false;
      const words = splitWords(String(frame.payload));
      const emitted: string[] = [];
      for (const w of words) {
        if (this.cancelled) {
          this.trace.push(`TTS: cut mid-word after ${pyList(emitted)}`);
          break;
        }
        emitted.push(w);
      }
      this.trace.push(`TTS: emitted ${pyList(emitted)}`);
      super.process(new Frame("tts_audio", emitted));
    } else {
      super.process(frame);
    }
  }
}

class Transport extends Processor {
  delivered: string[][] = [];

  override process(frame: Frame): void {
    if (frame.kind === "tts_audio") {
      const payload = frame.payload as string[];
      this.delivered.push([...payload]);
      this.trace.push(`transport: sent ${payload.length} words`);
    } else {
      super.process(frame);
    }
  }
}

function link(...processors: Processor[]): void {
  for (let i = 0; i + 1 < processors.length; i++) {
    const a = processors[i]!;
    const b = processors[i + 1]!;
    a.next = b;
    b.prev = a;
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("VOICE PIPELINE (PIPECAT-SHAPED): Phase 14, Lesson 22");
  console.log("=".repeat(70));

  const vad = new VAD("vad");
  const stt = new STT("stt");
  const llm = new LLM(
    "llm",
    new Map([
      ["hello", "hi there, how can I help today?"],
      ["refund please", "sure, I can help with a refund; what order number should I look up?"],
    ]),
  );
  const tts = new TTS("tts");
  const transport = new Transport("transport");
  link(vad, stt, llm, tts, transport);

  console.log("\nscenario 1: normal flow");
  vad.process(new Frame("audio_chunk", "hello"));
  console.log(`  transport delivered: ${pyList(transport.delivered[transport.delivered.length - 1]!)}`);

  console.log("\nscenario 2: barge-in mid-utterance");
  tts.cancelled = false;
  vad.process(new Frame("audio_chunk", "refund please"));
  transport.process(new Frame("cancel", null, "upstream"));

  console.log("  trace across pipeline");
  for (const proc of [vad, stt, llm, tts, transport]) {
    for (const line of proc.trace) console.log(`    ${proc.name}: ${line}`);
  }

  console.log();
  console.log("barge-in needs UPSTREAM cancel frames that propagate back to TTS+LLM.");
  console.log("sum latency per stage; premium stack lands at 450-600ms end-to-end.");
}

main();
