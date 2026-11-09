// Lesson: Parallel Tool Calls and Streaming with Tools (phase 13 / lesson 03)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/03-parallel-and-streaming-tool-calls/code/main.ts

import { performance } from "node:perf_hooks";
import { setTimeout as sleep } from "node:timers/promises";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === quote) out += "\\" + c;
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else out += c;
  }
  return quote + out + quote;
}

function pyRepr(value: Json): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyStrRepr(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  return "{" + Object.keys(value).map((k) => pyStrRepr(k) + ": " + pyRepr(value[k])).join(", ") + "}";
}

function stableHash(s: string): number {
  let h = 0;
  for (const c of s) h = (Math.imul(h, 31) + c.charCodeAt(0)) >>> 0;
  return h;
}

const SIMULATED_LATENCY_MS: Record<string, number> = { Bengaluru: 400, Tokyo: 600, Zurich: 800 };

async function executor_weather(city: string): Promise<JsonObject> {
  const latency = SIMULATED_LATENCY_MS[city] ?? 500;
  await sleep(latency);
  return { city, temp_c: stableHash(city) % 35 };
}

async function run_sequential(cities: string[]): Promise<[number, JsonObject[]]> {
  const start = performance.now();
  const results: JsonObject[] = [];
  for (const c of cities) results.push(await executor_weather(c));
  const dt_ms = performance.now() - start;
  return [dt_ms, results];
}

async function run_parallel(cities: string[]): Promise<[number, JsonObject[]]> {
  const start = performance.now();
  const results = await Promise.all(cities.map((c) => executor_weather(c)));
  const dt_ms = performance.now() - start;
  return [dt_ms, results];
}

class CallBuffer {
  constructor(
    public id: string,
    public name: string = "",
    public args_buf: string = "",
    public done: boolean = false,
  ) {}

  try_parse(): JsonObject | null {
    if (!this.done) return null;
    return JSON.parse(this.args_buf);
  }
}

type StreamEvent = { type: string; id?: string; name?: string; chunk?: string };

class StreamAccumulator {
  buffers: Map<string, CallBuffer> = new Map();

  on_event(event: StreamEvent): CallBuffer[] {
    const kind = event.type;
    const idx = event.id as string;
    const completed: CallBuffer[] = [];
    if (kind === "call_start") {
      this.buffers.set(idx, new CallBuffer(idx, event.name as string));
    } else if (kind === "args_delta") {
      const buf = this.buffers.get(idx) as CallBuffer;
      buf.args_buf += event.chunk as string;
    } else if (kind === "call_stop") {
      const buf = this.buffers.get(idx) as CallBuffer;
      buf.done = true;
      completed.push(buf);
    }
    return completed;
  }
}

function* fake_openai_stream(): Generator<StreamEvent> {
  yield { type: "call_start", id: "call_A", name: "get_weather" };
  yield { type: "call_start", id: "call_B", name: "get_weather" };
  yield { type: "call_start", id: "call_C", name: "get_weather" };
  yield { type: "args_delta", id: "call_A", chunk: '{"city"' };
  yield { type: "args_delta", id: "call_B", chunk: '{"city' };
  yield { type: "args_delta", id: "call_A", chunk: ':"Beng' };
  yield { type: "args_delta", id: "call_C", chunk: '{"city":"Zu' };
  yield { type: "args_delta", id: "call_A", chunk: 'aluru"}' };
  yield { type: "call_stop", id: "call_A" };
  yield { type: "args_delta", id: "call_B", chunk: '":"Tokyo"}' };
  yield { type: "call_stop", id: "call_B" };
  yield { type: "args_delta", id: "call_C", chunk: 'rich"}' };
  yield { type: "call_stop", id: "call_C" };
}

async function replay_and_execute(): Promise<Map<string, JsonObject>> {
  const acc = new StreamAccumulator();
  const results: Map<string, JsonObject> = new Map();
  const in_flight: Map<string, Promise<JsonObject>> = new Map();
  for (const event of fake_openai_stream()) {
    const completed = acc.on_event(event);
    for (const buf of completed) {
      const args = buf.try_parse() as JsonObject;
      console.log(`  call ${buf.id} args complete -> ${pyRepr(args)}`);
      in_flight.set(buf.id, executor_weather(args["city"] as string));
    }
  }
  for (const [cid, fut] of in_flight) results.set(cid, await fut);
  return results;
}

async function main(): Promise<void> {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 03 - PARALLEL AND STREAMING TOOL CALLS");
  console.log("=".repeat(72));

  const cities = ["Bengaluru", "Tokyo", "Zurich"];
  const latencies = Object.values(SIMULATED_LATENCY_MS);
  const sum_lat = latencies.reduce((a, b) => a + b, 0);
  const max_lat = Math.max(...latencies);

  console.log("\n--- demo 1: three-city weather (simulated) ---");
  console.log(`per-city simulated latency : ${pyRepr(SIMULATED_LATENCY_MS)}`);
  console.log(`theoretical sequential     : ${sum_lat} ms  (sum)`);
  console.log(`theoretical parallel       : ${max_lat} ms  (max)`);

  const [seq_ms] = await run_sequential(cities);
  const [par_ms] = await run_parallel(cities);
  console.log(`\nactual sequential : ${seq_ms.toFixed(0)} ms`);
  console.log(`actual parallel   : ${par_ms.toFixed(0)} ms`);
  const speedup = par_ms ? seq_ms / par_ms : 0;
  console.log(`speedup           : ${speedup.toFixed(2)}x`);

  console.log("\n--- demo 2: stream accumulator ---");
  console.log("replaying fake interleaved stream of three parallel calls ...");
  const results = await replay_and_execute();
  console.log("\nfinal results (keyed by tool_call_id):");
  for (const [cid, r] of results) console.log(`  ${cid} -> ${pyRepr(r)}`);
}

void main();
