// Lesson: Agent Framework Tradeoffs: Graph, Role, and Actor Orchestration (phase 11 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/11-llm-engineering/17-agent-framework-tradeoffs/docs/en.md
// Run: npx tsx phases/11-llm-engineering/17-agent-framework-tradeoffs/code/main.ts

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

interface Problem {
  has_typed_state: boolean;
  has_roles: boolean;
  has_dialogue: boolean;
  has_parallel_fanout: boolean;
  needs_resume: boolean;
  needs_human_interrupt: boolean;
  total_llm_calls: number;
  needs_session_memory: boolean;
}

function problem(p: Partial<Problem> = {}): Problem {
  return Object.freeze({
    has_typed_state: false,
    has_roles: false,
    has_dialogue: false,
    has_parallel_fanout: false,
    needs_resume: false,
    needs_human_interrupt: false,
    total_llm_calls: 1,
    needs_session_memory: false,
    ...p,
  });
}

interface Recommendation {
  framework: string;
  reason: string;
}

function recommendation(framework: string, reason: string): Recommendation {
  return Object.freeze({ framework, reason });
}

function recommend(p: Problem): Recommendation {
  if (
    p.total_llm_calls <= 2 &&
    ![p.has_roles, p.has_dialogue, p.needs_resume, p.has_parallel_fanout, p.needs_human_interrupt].some(Boolean)
  ) {
    return recommendation(
      "plain python",
      "Two or fewer LLM calls with no state, roles, dialogue, fanout, " + "or resume needs; a framework is pure overhead.",
    );
  }

  if (p.needs_resume || p.needs_human_interrupt || p.has_parallel_fanout) {
    return recommendation(
      "langgraph",
      "Typed state, checkpointer, interrupts, and Send fanout are only " + "first-class in LangGraph.",
    );
  }

  if (p.has_dialogue && !p.has_typed_state) {
    return recommendation(
      "autogen",
      "Proposer-critic or teacher-student dialogue is AutoGen's native " + "shape; GroupChat selects speakers without hand-wiring.",
    );
  }

  if (p.has_roles && !p.has_typed_state) {
    return recommendation(
      "crewai",
      "Specialist roles with a short sequential or hierarchical plan " + "are cheapest to express in CrewAI.",
    );
  }

  if (p.needs_session_memory && !p.has_roles && !p.has_dialogue) {
    return recommendation(
      "agno",
      "Single agent with tools and persistent session memory; Agno's " + "storage drivers are built in.",
    );
  }

  if (p.has_typed_state) {
    return recommendation(
      "langgraph",
      "Typed state is LangGraph's core abstraction; map your TypedDict " + "onto a StateGraph.",
    );
  }

  return recommendation(
    "langgraph",
    "Default for multi-step agents with any uncertainty about future state " + "or branching needs.",
  );
}

function check(label: string, actual: Recommendation, expectedFramework: string): boolean {
  const ok = actual.framework === expectedFramework;
  const tag = ok ? "OK " : "FAIL";
  console.log(`[${tag}] ${label.padEnd(60)}  -> ${actual.framework.padEnd(14)} // ${actual.reason}`);
  return ok;
}

function runTests(): number {
  const cases: [string, Problem, string][] = [
    ["two-call summarizer, no state", problem({ total_llm_calls: 2 }), "plain python"],
    [
      "long-running workflow with human approval",
      problem({ has_typed_state: true, needs_human_interrupt: true, total_llm_calls: 8 }),
      "langgraph",
    ],
    [
      "research with parallel fanout to three retrievers",
      problem({ has_typed_state: true, has_parallel_fanout: true, total_llm_calls: 5 }),
      "langgraph",
    ],
    ["proposer-critic coding loop", problem({ has_dialogue: true, total_llm_calls: 10 }), "autogen"],
    ["marketing pipeline with researcher/writer/editor roles", problem({ has_roles: true, total_llm_calls: 4 }), "crewai"],
    ["chat assistant with persistent user memory", problem({ needs_session_memory: true, total_llm_calls: 6 }), "agno"],
    [
      "workflow that must resume after crash",
      problem({ has_typed_state: true, needs_resume: true, total_llm_calls: 12 }),
      "langgraph",
    ],
  ];

  let failures = 0;
  for (const [label, prob, expected] of cases) {
    if (!check(label, recommend(prob), expected)) failures += 1;
  }
  console.log();
  console.log(`${cases.length - failures}/${cases.length} cases passed.`);
  return failures === 0 ? 0 : 1;
}

function pyInt(text: string): number {
  const t = text.trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error(`invalid literal for int() with base 10: '${text}'`);
  return parseInt(t, 10);
}

function lineReader(): (prompt: string) => Promise<string> {
  const rl = createInterface({ input: stdin, terminal: false });
  const lines: string[] = [];
  const waiters: ((line: string | null) => void)[] = [];
  let closed = false;
  rl.on("line", (line) => {
    const waiter = waiters.shift();
    if (waiter) waiter(line);
    else lines.push(line);
  });
  rl.on("close", () => {
    closed = true;
    for (const waiter of waiters.splice(0)) waiter(null);
  });
  return async (prompt: string): Promise<string> => {
    stdout.write(prompt);
    const line =
      lines.length > 0 ? lines.shift()! : closed ? null : await new Promise<string | null>((resolve) => waiters.push(resolve));
    if (line === null) {
      rl.close();
      throw new Error("EOF when reading a line");
    }
    return line;
  };
}

async function runInteractive(): Promise<number> {
  const input = lineReader();
  const yes = async (prompt: string): Promise<boolean> => (await input(`${prompt} [y/N] `)).trim().toLowerCase().startsWith("y");

  const p = problem({
    has_typed_state: await yes("Typed state / explicit state schema?"),
    has_roles: await yes("Specialist roles with distinct goals?"),
    has_dialogue: await yes("Multi-agent dialogue (speaker-ordering emergent)?"),
    has_parallel_fanout: await yes("Parallel fanout across N sub-workers?"),
    needs_resume: await yes("Must resume after process restart?"),
    needs_human_interrupt: await yes("Needs human approval mid-run?"),
    total_llm_calls: pyInt((await input("Approx LLM calls per run? ")).trim() || "1"),
    needs_session_memory: await yes("Needs durable per-user session memory?"),
  });
  stdin.destroy();
  const r = recommend(p);
  console.log();
  console.log(JSON.stringify({ framework: r.framework, reason: r.reason }, null, 2));
  return 0;
}

const USAGE = "usage: main.ts [-h] [--ask]";

async function main(): Promise<number> {
  let ask = false;
  for (const arg of process.argv.slice(2)) {
    if (arg === "--ask") {
      ask = true;
    } else if (arg === "-h" || arg === "--help") {
      console.log(`${USAGE}\n\noptions:\n  -h, --help  show this help message and exit\n  --ask       interactive mode`);
      return 0;
    } else {
      console.error(`${USAGE}\nmain.ts: error: unrecognized arguments: ${arg}`);
      return 2;
    }
  }
  return ask ? runInteractive() : runTests();
}

main().then((code) => {
  process.exitCode = code;
});
