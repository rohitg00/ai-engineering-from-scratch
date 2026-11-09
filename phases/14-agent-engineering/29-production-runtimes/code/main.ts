// Lesson: Production Runtimes: Queue, Event, Cron (phase 14 / lesson 29)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/29-production-runtimes/docs/en.md
// Run: npx tsx phases/14-agent-engineering/29-production-runtimes/code/main.ts

function agentFn(inputText: string): string[] {
  return [
    `parse: ${inputText.slice(0, 40)}`,
    "plan: 3-step plan",
    "step 1: search",
    "step 2: read",
    `final: answered ${inputText.slice(0, 20)}`,
  ];
}

function requestResponse(inputText: string): string {
  const steps = agentFn(inputText);
  return steps[steps.length - 1]!;
}

function* streaming(inputText: string): Generator<string> {
  for (const step of agentFn(inputText)) yield step;
}

class Job {
  attempt = 0;

  constructor(
    public jid: string,
    public payload: string,
  ) {}
}

class QueueRuntime {
  queue: Job[] = [];
  dlq: Job[] = [];
  failRate = 0;
  counter = 0;

  enqueue(payload: string): string {
    this.counter += 1;
    const jid = `j${String(this.counter).padStart(3, "0")}`;
    this.queue.push(new Job(jid, payload));
    return jid;
  }

  worker(failPolicy: (job: Job) => boolean): [string, string][] {
    const results: [string, string][] = [];
    while (this.queue.length > 0) {
      const job = this.queue.shift()!;
      job.attempt += 1;
      if (failPolicy(job) && job.attempt < 3) {
        this.queue.push(job);
        results.push([job.jid, "retry"]);
        continue;
      }
      if (failPolicy(job)) {
        this.dlq.push(job);
        results.push([job.jid, "DLQ"]);
        continue;
      }
      const steps = agentFn(job.payload);
      results.push([job.jid, steps[steps.length - 1]!]);
    }
    return results;
  }
}

class EventBus {
  subscribers = new Map<string, ((payload: string) => string)[]>();

  subscribe(eventType: string, handler: (payload: string) => string): void {
    let list = this.subscribers.get(eventType);
    if (list === undefined) {
      list = [];
      this.subscribers.set(eventType, list);
    }
    list.push(handler);
  }

  publish(eventType: string, payload: string): [string, string][] {
    return (this.subscribers.get(eventType) ?? []).map((handler) => [eventType, handler(payload)]);
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("PRODUCTION RUNTIME SHAPES: Phase 14, Lesson 29");
  console.log("=".repeat(70));

  console.log("\n1. request-response (synchronous)");
  const out = requestResponse("list project files");
  console.log(`  result: ${out}`);

  console.log("\n2. streaming (generator)");
  for (const step of streaming("review this PR")) console.log(`  chunk: ${step}`);

  console.log("\n3. queue-based (with retry and DLQ)");
  const rt = new QueueRuntime();
  rt.enqueue("long job A");
  rt.enqueue("long job B");
  rt.enqueue("long job C");

  const failB = (job: Job): boolean => job.payload === "long job B";

  const results = rt.worker(failB);
  for (const [jid, status] of results) console.log(`  ${jid}: ${status}`);
  console.log(`  queue: ${rt.queue.length}   dlq: ${rt.dlq.length}`);

  console.log("\n4. event-driven (subscriber pattern)");
  const bus = new EventBus();

  const onPrOpened = (payload: string): string => `ran checks on ${payload}`;
  const onMemoryConsolidate = (payload: string): string => `consolidated ${payload}`;

  bus.subscribe("pr.opened", onPrOpened);
  bus.subscribe("memory.consolidate", onMemoryConsolidate);

  for (const [evt, res] of bus.publish("pr.opened", "#123 add feature")) console.log(`  ${evt} -> ${res}`);
  for (const [evt, res] of bus.publish("memory.consolidate", "session_001")) console.log(`  ${evt} -> ${res}`);

  console.log("\n5. scheduled (cron stand-in)");
  const schedule: [string, string][] = [
    ["02:00", "memory.consolidate"],
    ["03:00", "eval.nightly"],
  ];
  for (const [when, event] of schedule) console.log(`  ${when}: would fire ${event}`);

  console.log();
  console.log("same agent logic, four outer shells. pick by task shape.");
  console.log("observability (Lesson 23/24) is load-bearing at every shape.");
}

main();
