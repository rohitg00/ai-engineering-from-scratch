// Lesson: Failure Modes: Why Agents Break (phase 14 / lesson 26)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/26-failure-modes-agentic/docs/en.md
// Run: npx tsx phases/14-agent-engineering/26-failure-modes-agentic/code/main.ts

type Args = Record<string, string>;

function pyStr(s: string): string {
  if (s.includes("'") && !s.includes('"')) return `"${s}"`;
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pyDict(d: Args): string {
  return "{" + Object.entries(d).map(([k, v]) => `${pyStr(k)}: ${pyStr(v)}`).join(", ") + "}";
}

function pyList(xs: string[]): string {
  return "[" + xs.map(pyStr).join(", ") + "]";
}

function splitWords(s: string): string[] {
  return s.split(/\s+/).filter((w) => w.length > 0);
}

class TraceStep {
  constructor(
    public kind: string,
    public name: string,
    public args: Args = {},
    public status = "ok",
    public result = "",
  ) {}
}

interface Trace {
  tid: string;
  userRequest: string;
  constraints: string[];
  steps: TraceStep[];
  finalSuccessClaim: boolean;
  targetStateChanged: boolean;
}

const KNOWN_TOOLS = new Set(["search", "read_file", "write_file", "list_dir"]);

function detectHallucinatedAction(trace: Trace): string | null {
  for (const step of trace.steps) {
    if (step.kind === "tool_call" && !KNOWN_TOOLS.has(step.name)) return "hallucinated_action";
  }
  return null;
}

function detectScopeCreep(trace: Trace): string | null {
  const request = trace.userRequest.toLowerCase();
  const writes = trace.steps.filter((s) => s.kind === "tool_call" && s.name === "write_file");
  const explicitWriteWords = ["write", "create", "save", "update", "edit"];
  const wantedWrite = explicitWriteWords.some((w) => request.includes(w));
  if (writes.length > 0 && !wantedWrite) return "scope_creep";
  return null;
}

function detectCascadingErrors(trace: Trace): string | null {
  let sawError = false;
  let downstreamOps = 0;
  for (const step of trace.steps) {
    if (step.kind === "tool_call" && step.status === "error") {
      sawError = true;
      continue;
    }
    if (sawError && step.kind === "tool_call") downstreamOps += 1;
  }
  if (sawError && downstreamOps >= 2) return "cascading_errors";
  return null;
}

function detectContextLoss(trace: Trace): string | null {
  for (const constraint of trace.constraints) {
    const conL = constraint.toLowerCase();
    if (conL.includes("do not")) {
      const parts = conL.split("do not");
      const forbiddenToken = splitWords(parts[parts.length - 1]!.trim())[0]!;
      for (const step of trace.steps) {
        if (step.kind === "tool_call" && pyDict(step.args).toLowerCase().includes(forbiddenToken)) {
          return "context_loss";
        }
      }
    }
  }
  return null;
}

function detectToolMisuse(trace: Trace): string | null {
  const toolArgsSchema: Record<string, string[]> = {
    read_file: ["path"],
    write_file: ["path", "content"],
    list_dir: ["path"],
    search: ["query"],
  };
  for (const step of trace.steps) {
    if (step.kind !== "tool_call") continue;
    const expected = toolArgsSchema[step.name];
    if (expected === undefined) continue;
    if (!expected.every((k) => k in step.args)) return "tool_misuse";
  }
  return null;
}

function detectSuccessHallucination(trace: Trace): string | null {
  const request = trace.userRequest.toLowerCase();
  const writeIntent = ["write", "create", "save", "update", "edit", "make"].some((w) => request.includes(w));
  if (writeIntent && trace.finalSuccessClaim && !trace.targetStateChanged) return "success_hallucination";
  return null;
}

const DETECTORS = [
  detectHallucinatedAction,
  detectScopeCreep,
  detectCascadingErrors,
  detectContextLoss,
  detectToolMisuse,
  detectSuccessHallucination,
];

function tag(trace: Trace): string[] {
  return DETECTORS.map((d) => d(trace)).filter((label): label is string => Boolean(label));
}

function main(): void {
  console.log("=".repeat(70));
  console.log("AGENT FAILURE MODES: Phase 14, Lesson 26");
  console.log("=".repeat(70));

  const traces: Trace[] = [
    {
      tid: "t001",
      userRequest: "find the config file",
      constraints: ["do not modify any files"],
      steps: [
        new TraceStep("tool_call", "search", { query: "config" }),
        new TraceStep("tool_call", "read_file", { path: "config.yml" }),
      ],
      finalSuccessClaim: true,
      targetStateChanged: false,
    },
    {
      tid: "t002",
      userRequest: "find the config file",
      constraints: ["do not modify any files"],
      steps: [
        new TraceStep("tool_call", "search", { query: "config" }),
        new TraceStep("tool_call", "write_file", { path: "config.yml", content: "..." }),
      ],
      finalSuccessClaim: true,
      targetStateChanged: true,
    },
    {
      tid: "t003",
      userRequest: "list project files",
      constraints: [],
      steps: [new TraceStep("tool_call", "magic_scanner", { path: "/" })],
      finalSuccessClaim: true,
      targetStateChanged: false,
    },
    {
      tid: "t004",
      userRequest: "look up invoice 4711",
      constraints: [],
      steps: [
        new TraceStep("tool_call", "search", { query: "invoice 4711" }, "error"),
        new TraceStep("tool_call", "read_file", { path: "/tmp/foo" }),
        new TraceStep("tool_call", "write_file", { path: "/tmp/foo", content: "fabricated" }),
        new TraceStep("tool_call", "list_dir", { path: "/tmp" }),
      ],
      finalSuccessClaim: true,
      targetStateChanged: true,
    },
    {
      tid: "t005",
      userRequest: "update readme with release notes",
      constraints: ["do not modify src/"],
      steps: [
        new TraceStep("tool_call", "read_file", { path: "README.md" }),
        new TraceStep("tool_call", "write_file", { path: "README.md", content: "notes" }),
        new TraceStep("tool_call", "write_file", { path: "src/foo.py", content: "also notes" }),
      ],
      finalSuccessClaim: true,
      targetStateChanged: true,
    },
    {
      tid: "t006",
      userRequest: "read some file",
      constraints: [],
      steps: [new TraceStep("tool_call", "read_file", { file: "/tmp/foo" })],
      finalSuccessClaim: false,
      targetStateChanged: false,
    },
    {
      tid: "t007",
      userRequest: "create a PR",
      constraints: [],
      steps: [new TraceStep("tool_call", "search", { query: "PR template" })],
      finalSuccessClaim: true,
      targetStateChanged: false,
    },
  ];

  const distribution = new Map<string, number>();
  console.log();
  for (const trace of traces) {
    const labels = tag(trace);
    for (const l of labels) distribution.set(l, (distribution.get(l) ?? 0) + 1);
    console.log(`  ${trace.tid}  user=${pyStr(trace.userRequest.slice(0, 40))}`);
    console.log(`    labels: ${labels.length > 0 ? pyList(labels) : "[clean]"}`);
  }

  console.log("\naggregate distribution");
  for (const [label, count] of [...distribution.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${label}: ${count}`);
  }
  console.log();
  console.log("gate at every step: classifier, argument validation, state probe.");
  console.log("cascading is the killer. detect early, stop the loop.");
}

main();
