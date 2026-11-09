// Lesson: The Actor Model for Agents: Async Messages and Typed Runtimes (phase 14 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/14-autogen-actor-model/docs/en.md
// Run: npx tsx phases/14-agent-engineering/14-autogen-actor-model/code/main.ts

export {};

class RuntimeError extends Error {
  name = "RuntimeError";
}

class NotImplementedError extends Error {
  name = "NotImplementedError";
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return quote + out + quote;
}

function pyRepr(v: unknown): string {
  if (typeof v === "string") return pyStrRepr(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (v === null || v === undefined) return "None";
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  if (typeof v === "object") {
    return "{" + Object.entries(v as Record<string, unknown>).map(([k, x]) => `${pyStrRepr(k)}: ${pyRepr(x)}`).join(", ") + "}";
  }
  return String(v);
}

function pyFormat(v: unknown): string {
  return typeof v === "string" ? v : pyRepr(v);
}

const mid3 = (n: number): string => String(n).padStart(3, "0");

interface Message {
  sender: string;
  recipient: string;
  topic: string;
  body: unknown;
  mid: number;
}

class Actor {
  constructor(public name: string) {}

  receive(_message: Message, _runtime: Runtime): void {
    throw new NotImplementedError("");
  }
}

class Runtime {
  actors = new Map<string, Actor>();
  queue: Message[] = [];
  deadLetters: Array<[Message, string]> = [];
  counter = 0;
  trace: string[] = [];
  maxMessages = 100;

  register(actor: Actor): void {
    this.actors.set(actor.name, actor);
  }

  send(sender: string, recipient: string, topic: string, body: unknown): void {
    this.counter += 1;
    const msg: Message = { sender, recipient, topic, body, mid: this.counter };
    this.queue.push(msg);
    this.trace.push(`[send m${mid3(msg.mid)}] ${sender} -> ${recipient} topic=${topic} body=${pyFormat(body)}`);
  }

  runUntilIdle(): void {
    let processed = 0;
    while (this.queue.length > 0 && processed < this.maxMessages) {
      const msg = this.queue.shift() as Message;
      const actor = this.actors.get(msg.recipient);
      if (actor === undefined) {
        this.deadLetters.push([msg, `no actor ${pyStrRepr(msg.recipient)}`]);
        this.trace.push(`[DLQ m${mid3(msg.mid)}] no actor ${pyStrRepr(msg.recipient)}`);
        continue;
      }
      try {
        actor.receive(msg, this);
        this.trace.push(`[recv m${mid3(msg.mid)}] ${actor.name} handled topic=${msg.topic}`);
      } catch (e) {
        const err = e as Error;
        this.deadLetters.push([msg, `${err.name}: ${err.message}`]);
        this.trace.push(`[FAIL m${mid3(msg.mid)}] ${actor.name} raised ${err.name}: ${err.message}  (others keep running)`);
      }
      processed += 1;
    }
  }
}

interface ReviewResult {
  ok: boolean;
  issues: string[];
}

class ReviewerAgent extends Actor {
  verdicts: Array<[string, boolean]> = [];

  receive(message: Message, runtime: Runtime): void {
    if (message.topic === "review") {
      const code = pyFormat(message.body);
      const issues: string[] = [];
      if (code.includes("eval(")) issues.push("uses eval");
      if (code.includes("except:")) issues.push("bare except");
      const ok = issues.length === 0;
      this.verdicts.push([code, ok]);
      const body: ReviewResult = { ok, issues };
      runtime.send(this.name, message.sender, "review_result", body);
    } else if (message.topic === "crash_me") {
      throw new RuntimeError("simulated handler failure");
    }
  }
}

class ChecklistAgent extends Actor {
  results: ReviewResult[] = [];
  consensus: boolean | null = null;

  constructor(name: string, public partner: string) {
    super(name);
  }

  receive(message: Message, runtime: Runtime): void {
    if (message.topic === "start") {
      for (const snippet of message.body as string[]) runtime.send(this.name, this.partner, "review", snippet);
    } else if (message.topic === "review_result") {
      this.results.push({ ...(message.body as ReviewResult) });
      if (this.results.every((r) => r.ok)) this.consensus = true;
      if (this.results.length === 3) this.consensus = this.results.every((r) => r.ok);
    }
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("AUTOGEN V0.4 ACTOR RUNTIME (STDLIB): Phase 14, Lesson 14");
  console.log("=".repeat(70));

  const runtime = new Runtime();
  const reviewer = new ReviewerAgent("reviewer");
  const checklist = new ChecklistAgent("checklist", "reviewer");
  runtime.register(reviewer);
  runtime.register(checklist);

  runtime.send("__user__", "checklist", "start", [
    "def add(a, b): return a + b",
    "def hazard(): eval('1+1')",
    "def silent(): \n    try:\n        f()\n    except:\n        pass",
  ]);

  runtime.send("__user__", "reviewer", "crash_me", {});

  runtime.runUntilIdle();

  console.log("\nmessage trace");
  for (const line of runtime.trace) console.log(`  ${line}`);

  console.log(`\nchecklist consensus: ${pyRepr(checklist.consensus)}`);
  console.log(`dead-letter queue:   ${runtime.deadLetters.length} message(s)`);
  for (const [msg, reason] of runtime.deadLetters) {
    console.log(`  DLQ m${mid3(msg.mid)} (${reason}) ${msg.sender} -> ${msg.recipient} topic=${msg.topic}`);
  }

  console.log();
  console.log("property: reviewer's crash on 'crash_me' did not stop");
  console.log("the 'review' messages from being processed. fault isolation.");
}

main();
