// Lesson: Long-Running Background Agents: Durable Execution (phase 15 / lesson 12)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/12-durable-execution/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/12-durable-execution/code/main.ts

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type Arg = string | number;
type Result = string | number;

interface Event {
  name: string;
  args: Arg[];
  status: string;
  result?: Result;
}

class EventLog {
  constructor(public path: string) {
    if (!fs.existsSync(this.path)) {
      fs.writeFileSync(this.path, JSON.stringify([]));
    }
  }

  events(): Event[] {
    return JSON.parse(fs.readFileSync(this.path, "utf8")) as Event[];
  }

  append(ev: Event): void {
    const evs = this.events();
    evs.push(ev);
    fs.writeFileSync(this.path, JSON.stringify(evs));
  }

  lookup(name: string, args: Arg[]): Event | null {
    for (const ev of this.events()) {
      if (
        ev.name === name &&
        JSON.stringify(ev.args) === JSON.stringify(args) &&
        ev.status === "done"
      ) {
        return ev;
      }
    }
    return null;
  }
}

function pyRepr(v: Arg): string {
  return typeof v === "string" ? `'${v}'` : String(v);
}

function pyTuple(args: Arg[]): string {
  if (args.length === 1) {
    return `(${pyRepr(args[0])},)`;
  }
  return `(${args.map(pyRepr).join(", ")})`;
}

function activity<A extends Arg, R extends Result>(
  name: string,
  fn: (arg: A) => R,
): (log: EventLog, arg: A) => R {
  return (log: EventLog, arg: A): R => {
    const args: Arg[] = [arg];
    const hit = log.lookup(name, args);
    if (hit) {
      console.log(`    [replay] ${name}(${pyTuple(args)}) -> ${hit.result} (from log)`);
      return hit.result as R;
    }
    log.append({ name, args, status: "started" });
    const result = fn(arg);
    log.append({ name, args, status: "done", result });
    console.log(`    [run]    ${name}(${pyTuple(args)}) -> ${result}`);
    return result;
  };
}

const fetchDocs = activity("fetch_docs", (query: string): number => query.length * 3);

const callLlm = activity("call_llm", (docCount: number): string => `summary(${docCount}_docs)`);

const writeReport = activity("write_report", (summary: string): string => `report://${summary}`);

class RuntimeError extends Error {}

function workflow(log: EventLog, query: string, crashAfter: number = -1): string {
  const docCount = fetchDocs(log, query);
  if (crashAfter === 1) {
    throw new RuntimeError("simulated crash after fetch_docs");
  }
  const summary = callLlm(log, docCount);
  if (crashAfter === 2) {
    throw new RuntimeError("simulated crash after call_llm");
  }
  const report = writeReport(log, summary);
  return report;
}

function resetLog(p: string): EventLog {
  if (fs.existsSync(p)) {
    fs.rmSync(p);
  }
  return new EventLog(p);
}

function countRuns(log: EventLog): number {
  return log.events().filter((ev) => ev.status === "started").length;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("DURABLE EXECUTION (Phase 15, Lesson 12)");
  console.log("=".repeat(70));

  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), "durable-"));

  console.log("\nNaive retry (no event log persisted)");
  console.log("-".repeat(70));
  for (let attempt = 1; attempt < 4; attempt++) {
    const log = resetLog(path.join(tmpdir, "naive.json"));
    console.log(`  attempt ${attempt}:`);
    try {
      const crash = attempt === 1 ? 2 : -1;
      const r = workflow(log, "hello", crash);
      console.log(`    -> result ${r}`);
      console.log(`    -> ${countRuns(log)} activity starts this attempt`);
      break;
    } catch (e) {
      if (!(e instanceof RuntimeError)) {
        throw e;
      }
      console.log(`    -> crash: ${e.message}; ${countRuns(log)} activity starts wasted`);
    }
  }

  console.log("\nDurable retry (event log preserved across attempts)");
  console.log("-".repeat(70));
  const durablePath = path.join(tmpdir, "durable.json");
  if (fs.existsSync(durablePath)) {
    fs.rmSync(durablePath);
  }

  for (let attempt = 1; attempt < 4; attempt++) {
    const log = new EventLog(durablePath);
    console.log(`  attempt ${attempt}:`);
    try {
      const crash = attempt === 1 ? 2 : -1;
      const r = workflow(log, "hello", crash);
      console.log(`    -> result ${r}`);
      console.log(`    -> ${countRuns(log)} total activity starts across attempts`);
      break;
    } catch (e) {
      if (!(e instanceof RuntimeError)) {
        throw e;
      }
      console.log(`    -> crash: ${e.message}`);
    }
  }

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: durability makes long-horizon runs affordable to fail");
  console.log("-".repeat(70));
  console.log("  Naive retry re-executes every activity on every attempt.");
  console.log("  Durable retry replays completed activities from the log;");
  console.log("  only the missing activity actually runs. Same design used");
  console.log("  by Temporal, LangGraph checkpointing, Microsoft Agent");
  console.log("  Framework, and Claude Code Routines. The LLM call is");
  console.log("  just another non-deterministic activity in the log.");
}

main();
