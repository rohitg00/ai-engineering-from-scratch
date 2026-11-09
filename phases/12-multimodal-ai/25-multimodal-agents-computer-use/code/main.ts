// Lesson: Multimodal Agents and Computer-Use (Capstone) (phase 12 / lesson 25)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/12-multimodal-ai/25-multimodal-agents-computer-use/docs/en.md
// Run: npx tsx phases/12-multimodal-ai/25-multimodal-agents-computer-use/code/main.ts

export {};

const ACTION_SCHEMA: [string, string[]][] = [
  ["click", ["x", "y", "element_desc"]],
  ["type", ["text", "x", "y"]],
  ["scroll", ["direction", "amount"]],
  ["drag", ["x0", "y0", "x1", "y1"]],
  ["select", ["option_index"]],
  ["hover", ["x", "y"]],
  ["navigate", ["url"]],
  ["wait", ["ms"]],
  ["screenshot_region", ["x0", "y0", "x1", "y1"]],
  ["done", ["success", "explanation"]],
];

type ActionValue = string | number | boolean;
type Action = Record<string, ActionValue>;

class BrowserState {
  constructor(
    public url: string = "https://mock-booking/",
    public page: string = "home",
    public filled: Map<ActionValue, ActionValue> = new Map(),
  ) {}
}

class Task {
  constructor(public goal: string, public plan: Action[], public expectedPage: string) {}
}

function mockTasks(): Task[] {
  return [
    new Task(
      "Book flight NYC to Tokyo April 15",
      [
        { action: "click", x: 120, y: 200, element_desc: "Search" },
        { action: "type", text: "Tokyo", x: 300, y: 240 },
        { action: "click", x: 400, y: 240, element_desc: "date" },
        { action: "select", option_index: 15 },
        { action: "click", x: 500, y: 400, element_desc: "Book" },
        { action: "done", success: true, explanation: "booked" },
      ],
      "confirmation",
    ),
    new Task(
      "Reset password for user alice@x.com",
      [
        { action: "click", x: 50, y: 50, element_desc: "Login" },
        { action: "click", x: 100, y: 200, element_desc: "Forgot password" },
        { action: "type", text: "alice@x.com", x: 200, y: 300 },
        { action: "click", x: 300, y: 400, element_desc: "Submit" },
        { action: "done", success: true, explanation: "reset sent" },
      ],
      "reset_sent",
    ),
  ];
}

function applyAction(state: BrowserState, action: Action): BrowserState {
  const next = new BrowserState(state.url, state.page, new Map(state.filled));
  const act = action["action"];
  if (act === "click") {
    const desc = String(action["element_desc"] ?? "");
    if (desc.includes("Submit") && state.page === "reset_sent") {
      next.page = "reset_sent";
    } else if (desc.includes("Book") || desc.includes("Submit")) {
      next.page = "confirmation";
    } else if (desc.includes("Login") || desc.includes("Forgot")) {
      next.page = desc.includes("Forgot") ? "reset_sent" : "login";
    } else if (desc.includes("Search")) {
      next.page = "search";
    }
  } else if (act === "type") {
    next.filled.set(action["x"] ?? 0, action["text"] ?? "");
  } else if (act === "select") {
    next.filled.set("select_idx", action["option_index"] ?? 0);
  }
  return next;
}

interface TaskResult {
  goal: string;
  trace: [number, string, string][];
  finalPage: string;
  success: boolean;
}

function runTask(task: Task): TaskResult {
  let state = new BrowserState();
  const trace: [number, string, string][] = [];
  task.plan.forEach((action, idx) => {
    trace.push([idx + 1, String(action["action"]), String(action["element_desc"] ?? "")]);
    state = applyAction(state, action);
  });
  const success = state.page === task.expectedPage;
  return { goal: task.goal, trace, finalPage: state.page, success };
}

function printSchema(): void {
  console.log("\nACTION SCHEMA");
  console.log("-".repeat(60));
  for (const [act, params] of ACTION_SCHEMA) {
    console.log(`  ${act.padEnd(18)}[${params.map((p) => `'${p}'`).join(", ")}]`);
  }
}

function runBenchmark(): void {
  console.log("\nBENCHMARK: 2 sample tasks");
  console.log("-".repeat(60));
  const tasks = mockTasks();
  const total = tasks.length;
  let passed = 0;
  for (const task of tasks) {
    const r = runTask(task);
    const status = r.success ? "PASS" : "FAIL";
    console.log(`  [${status}] ${r.goal}`);
    for (const [step, act, desc] of r.trace) console.log(`    step ${step}: ${act.padEnd(10)} ${desc}`);
    if (r.success) passed += 1;
  }
  console.log(`\n  score: ${passed}/${total}`);
}

function benchmarkLeaderboard(): void {
  console.log("\n2026 MULTIMODAL AGENT BENCHMARK SNAPSHOT");
  console.log("-".repeat(60));
  const rows: [string, string, string][] = [
    ["ScreenSpot-Pro", "Qwen2.5-VL-72B 85", "Claude Opus 4.7 ~90"],
    ["VisualWebArena", "open ~20", "Gemini 3 Pro ~27"],
    ["WebArena", "open ~35", "saturated ~60"],
    ["AgentVista", "open ~10-20", "frontier 27-40"],
    ["Ferret-UI mobile", "Qwen2.5-VL ~70", "GPT-5 ~82"],
  ];
  console.log(`  ${"benchmark".padEnd(20)}${"open model".padEnd(26)}frontier`);
  for (const r of rows) console.log(`  ${r[0].padEnd(20)}${r[1].padEnd(26)}${r[2]}`);
}

function main(): void {
  console.log("=".repeat(60));
  console.log("MULTIMODAL AGENTS CAPSTONE (Phase 12, Lesson 25)");
  console.log("=".repeat(60));

  printSchema();
  runBenchmark();
  benchmarkLeaderboard();

  console.log("\nMEMORY COMPRESSION STRATEGIES");
  console.log("-".repeat(60));
  console.log("  summary-chain : periodic text summary, drop old screenshots");
  console.log("  skip-frame    : keep first + last + every 3rd");
  console.log("  log only      : only action log in context (Claude computer-use)");
  console.log("  best: hybrid of log + last-2 screenshots + summary");

  console.log("\nYOU NOW COMPLETE PHASE 12");
  console.log("-".repeat(60));
  console.log("  from patches to agents. 25 lessons span:");
  console.log("  perception -> fusion -> generation -> audio -> robotics -> RAG -> agents");
  console.log("  every primitive traces back to a specific arxiv paper you can read.");
}

main();
