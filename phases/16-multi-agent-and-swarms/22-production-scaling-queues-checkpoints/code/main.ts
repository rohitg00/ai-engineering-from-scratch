// Lesson: Production Scaling: Queues, Checkpoints, Durability (phase 16 / lesson 22)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/22-production-scaling-queues-checkpoints/code/main.ts

import { mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";
import { Worker } from "node:worker_threads";

type State = Record<string, number>;

interface Row {
  thread_id: string;
  super_step: number;
  state_json: string;
}

function pyRepr(state: State): string {
  return "{" + Object.entries(state).map(([k, v]) => `'${k}': ${v}`).join(", ") + "}";
}

class CheckpointStore {
  constructor(public path: string) {
    if (!existsSync(path)) {
      writeFileSync(path, "[]");
    }
  }

  private rows(): Row[] {
    return JSON.parse(readFileSync(this.path, "utf8")) as Row[];
  }

  write(threadId: string, superStep: number, state: State): void {
    const rows = this.rows().filter((r) => !(r.thread_id === threadId && r.super_step === superStep));
    rows.push({ thread_id: threadId, super_step: superStep, state_json: JSON.stringify(state) });
    writeFileSync(this.path, JSON.stringify(rows));
  }

  latest(threadId: string): [number, State] | null {
    const rows = this.rows()
      .filter((r) => r.thread_id === threadId)
      .sort((a, b) => b.super_step - a.super_step);
    if (rows.length === 0) {
      return null;
    }
    return [rows[0].super_step, JSON.parse(rows[0].state_json) as State];
  }
}

function runAgentWithCheckpoint(
  store: CheckpointStore,
  threadId: string,
  start = 0,
  crashAt: number | null = null,
  goal = 5,
): number {
  const restored = store.latest(threadId);
  let superStep: number;
  let state: State;
  if (restored) {
    [superStep, state] = restored;
    superStep += 1;
  } else {
    superStep = 0;
    state = { counter: start };
  }

  while (state.counter < goal) {
    if (crashAt !== null && superStep === crashAt) {
      console.log(`    worker crashes at super_step=${superStep}`);
      throw new Error("simulated crash");
    }
    state.counter += 1;
    store.write(threadId, superStep, { ...state });
    superStep += 1;
  }
  return state.counter;
}

enum AgentState {
  IDLE = "idle",
  PROCESSING = "processing",
  RESPONSE = "response",
}

type Msg = Record<string, string>;

class AgentQueue {
  state: AgentState = AgentState.IDLE;
  inQueue: Msg[] = [];
  outQueue: { reply_to: Msg; body: string }[] = [];

  constructor(public agentId: string) {}

  enqueue(msg: Msg): void {
    this.inQueue.push(msg);
  }

  step(): void {
    if (this.state === AgentState.IDLE && this.inQueue.length > 0) {
      this.state = AgentState.PROCESSING;
    } else if (this.state === AgentState.PROCESSING) {
      const msg = this.inQueue.shift()!;
      const repr = "{" + Object.entries(msg).map(([k, v]) => `'${k}': '${v}'`).join(", ") + "}";
      this.outQueue.push({ reply_to: msg, body: `${this.agentId} processed ${repr}` });
      this.state = AgentState.RESPONSE;
    } else if (this.state === AgentState.RESPONSE) {
      this.state = AgentState.IDLE;
    }
  }
}

function demoQueue(): void {
  console.log("\n" + "=".repeat(72));
  console.log("PER-AGENT QUEUE: 3-state machine (idle / processing / response)");
  console.log("=".repeat(72));
  const a = new AgentQueue("agent-a");
  a.enqueue({ task: "compress logs" });
  a.enqueue({ task: "write summary" });
  console.log(`  initial: ${a.state}  in_queue=${a.inQueue.length}`);
  for (let i = 0; i < 7; i++) {
    a.step();
    console.log(`  state=${a.state.padEnd(11)} in=${a.inQueue.length} out=${a.outQueue.length}`);
  }
}

async function simLlmCallAsync(delay = 0.05): Promise<void> {
  await sleep(delay * 1000);
}

function simLlmCallSync(delay = 0.05): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delay * 1000);
}

const SYNC_CALLS_SOURCE = `
const { workerData } = require("node:worker_threads");
const simLlmCallSync = ${simLlmCallSync.toString()};
for (let i = 0; i < workerData.calls; i++) {
  simLlmCallSync(workerData.delay);
}
`;

const MAX_THREADS = 32;

async function benchAsync(n: number): Promise<number> {
  const t0 = performance.now();
  await Promise.all(Array.from({ length: n }, () => simLlmCallAsync()));
  return (performance.now() - t0) / 1000;
}

async function benchThreads(n: number, delay = 0.05): Promise<number> {
  const t0 = performance.now();
  const pool = Math.min(n, MAX_THREADS);
  const threads = Array.from({ length: pool }, (_, i) => {
    const calls = Math.floor(n / pool) + (i < n % pool ? 1 : 0);
    return new Worker(SYNC_CALLS_SOURCE, { eval: true, workerData: { calls, delay } });
  });
  await Promise.all(threads.map((t) => new Promise((resolve) => t.on("exit", resolve))));
  return (performance.now() - t0) / 1000;
}

async function demoAsyncVsThreads(): Promise<void> {
  console.log("\n" + "=".repeat(72));
  console.log("ASYNC vs THREADS: 500 concurrent 'LLM calls' (50ms each)");
  console.log("=".repeat(72));

  const asyncElapsed = await benchAsync(500);
  console.log(`  async (asyncio):  ${asyncElapsed.toFixed(3)} s`);

  const threadElapsed = await benchThreads(500);
  console.log(`  threads:          ${threadElapsed.toFixed(3)} s`);

  const ratio = asyncElapsed > 0 ? threadElapsed / asyncElapsed : Infinity;
  console.log(
    `  ratio: threads are ${ratio.toFixed(1)}x slower (pool capped at ${MAX_THREADS} workers, so calls run in series per worker)`,
  );
}

function demoCheckpointResume(): void {
  console.log("=".repeat(72));
  console.log("CHECKPOINT RESUME: worker crashes mid-run, second worker resumes");
  console.log("=".repeat(72));
  const dir = mkdtempSync(join(tmpdir(), "checkpoints-"));
  const dbPath = join(dir, "checkpoints.json");
  try {
    const store = new CheckpointStore(dbPath);

    console.log("  worker 1 starts thread t-1, targeting counter=5");
    try {
      runAgentWithCheckpoint(store, "t-1", 0, 3, 5);
    } catch (err) {
      if (!(err instanceof Error)) {
        throw err;
      }
    }

    const last = store.latest("t-1");
    if (last === null) {
      throw new Error("no checkpoint");
    }
    console.log(`  last checkpoint: super_step=${last[0]}, state=${pyRepr(last[1])}`);

    console.log("  worker 2 resumes thread t-1");
    const final = runAgentWithCheckpoint(store, "t-1", 0, null, 5);
    console.log(`  worker 2 completed; final counter = ${final}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<void> {
  demoCheckpointResume();
  demoQueue();
  await demoAsyncVsThreads();
  console.log("\nTakeaways:");
  console.log("  durable execution = persist state per super-step + idempotent resume.");
  console.log("  per-agent queues with 3-state machines scale to thousands of concurrent agents.");
  console.log("  async is structural for I/O-bound LLM workloads, not just an optimization.");
  console.log("  Bedi's rule: FastAPI + Postgres covers most teams; escalate on measured need.");
}

void main();
