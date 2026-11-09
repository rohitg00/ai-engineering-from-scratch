// Lesson: The Harness as a Library: Subagents and Session Store (phase 14 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/17-claude-agent-sdk/docs/en.md
// Run: npx tsx phases/14-agent-engineering/17-claude-agent-sdk/code/main.ts

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

function sortedKeys(m: Map<string, unknown>): string[] {
  return [...m.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

class Tool {
  constructor(
    public name: string,
    public description: string,
    public fn: (args: Args) => string,
  ) {}
}

class ToolRegistry {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    this.tools.set(tool.name, tool);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  names(): string[] {
    return sortedKeys(this.tools);
  }
}

class Hooks {
  preToolUse: ((name: string, args: Args) => void)[] = [];
  postToolUse: ((name: string, result: string) => void)[] = [];
  sessionStart: ((sid: string) => void)[] = [];
  sessionEnd: ((sid: string) => void)[] = [];

  constructor(init: Partial<Hooks> = {}) {
    Object.assign(this, init);
  }
}

class Turn {
  constructor(
    public role: string,
    public content: string,
  ) {}
}

class SessionStore {
  private sessions = new Map<string, Turn[]>();
  private subkeys = new Map<string, string[]>();

  append(sessionId: string, turn: Turn): void {
    let list = this.sessions.get(sessionId);
    if (list === undefined) {
      list = [];
      this.sessions.set(sessionId, list);
    }
    list.push(turn);
  }

  load(sessionId: string): Turn[] {
    return [...(this.sessions.get(sessionId) ?? [])];
  }

  listSessions(): string[] {
    return sortedKeys(this.sessions);
  }

  delete(sessionId: string): void {
    this.sessions.delete(sessionId);
    for (const sub of this.subkeys.get(sessionId) ?? []) {
      this.sessions.delete(sub);
    }
    this.subkeys.delete(sessionId);
  }

  listSubkeys(sessionId: string): string[] {
    return [...(this.subkeys.get(sessionId) ?? [])];
  }

  linkSub(parent: string, sub: string): void {
    let list = this.subkeys.get(parent);
    if (list === undefined) {
      list = [];
      this.subkeys.set(parent, list);
    }
    list.push(sub);
  }
}

class AgentRun {
  contextTokens = 0;
  toolCalls: [string, Args, string][] = [];
  output = "";

  constructor(public sessionId: string) {}
}

function wordCount(s: string): number {
  return s.split(/\s+/).filter((w) => w.length > 0).length;
}

type Call = [string, Args];

class Harness {
  private subCounter = 0;

  constructor(
    public tools: ToolRegistry,
    public hooks: Hooks,
    public store: SessionStore,
  ) {}

  private dispatch(toolName: string, args: Args): string {
    for (const hook of this.hooks.preToolUse) hook(toolName, args);
    const tool = this.tools.get(toolName);
    let result: string;
    if (tool === undefined) {
      result = `error: unknown tool ${pyStr(toolName)}`;
    } else {
      try {
        result = tool.fn(args);
      } catch (e) {
        const err = e as Error;
        result = `error: ${err.name}: ${err.message}`;
      }
    }
    for (const hook of this.hooks.postToolUse) hook(toolName, result);
    return result;
  }

  runAgent(sessionId: string, prompt: string, toolCalls: Call[], parentSession: string | null = null): AgentRun {
    for (const hook of this.hooks.sessionStart) hook(sessionId);
    if (parentSession !== null) this.store.linkSub(parentSession, sessionId);

    const run = new AgentRun(sessionId);
    this.store.append(sessionId, new Turn("user", prompt));
    run.contextTokens += wordCount(prompt);

    for (const [toolName, args] of toolCalls) {
      const result = this.dispatch(toolName, args);
      run.toolCalls.push([toolName, args, result]);
      this.store.append(sessionId, new Turn("tool", `${toolName}: ${result}`));
      run.contextTokens += wordCount(result);
    }

    const output = `processed ${toolCalls.length} tools; session=${sessionId}`;
    run.output = output;
    this.store.append(sessionId, new Turn("assistant", output));
    run.contextTokens += wordCount(output);

    for (const hook of this.hooks.sessionEnd) hook(sessionId);
    return run;
  }

  spawnSubagents(parentSession: string, tasks: [string, Call[]][]): AgentRun[] {
    const runs: AgentRun[] = [];
    for (const [prompt, toolCalls] of tasks) {
      this.subCounter += 1;
      const subSession = `${parentSession}.sub${String(this.subCounter).padStart(2, "0")}`;
      runs.push(this.runAgent(subSession, prompt, toolCalls, parentSession));
    }
    return runs;
  }
}

function readFileDemo(args: Args): string {
  return `[content of ${args.path}: 42 lines]`;
}

function listDirDemo(args: Args): string {
  return `[${args.path}: 7 files]`;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("CLAUDE AGENT SDK SHAPE: Phase 14, Lesson 17");
  console.log("=".repeat(70));

  const tools = new ToolRegistry();
  tools.register(new Tool("read_file", "read a file", readFileDemo));
  tools.register(new Tool("list_dir", "list a directory", listDirDemo));

  const hookLog: string[] = [];
  const hooks = new Hooks({
    preToolUse: [(n, a) => hookLog.push(`pre[${n}]: ${pyDict(a)}`)],
    postToolUse: [(n, r) => hookLog.push(`post[${n}]: ${r.slice(0, 30)}`)],
    sessionStart: [(s) => hookLog.push(`session_start[${s}]`)],
    sessionEnd: [(s) => hookLog.push(`session_end[${s}]`)],
  });

  const store = new SessionStore();
  const harness = new Harness(tools, hooks, store);

  const parent = "session_main";
  console.log("\norchestrator starts");
  const orchestratorRun = harness.runAgent(parent, "review these three modules", [["list_dir", { path: "/project" }]]);
  console.log(`  orchestrator context tokens: ${orchestratorRun.contextTokens}`);

  console.log("\nspawn three subagents (context isolation)");
  const subRuns = harness.spawnSubagents(parent, [
    ["review module a", [["read_file", { path: "a.py" }]]],
    ["review module b", [["read_file", { path: "b.py" }]]],
    ["review module c", [["read_file", { path: "c.py" }]]],
  ]);
  for (const run of subRuns) {
    console.log(`  sub ${run.sessionId}  tokens=${run.contextTokens}  tool_calls=${run.toolCalls.length}`);
  }
  console.log(`  orchestrator context tokens remain: ${orchestratorRun.contextTokens}`);

  console.log("\nsession store");
  for (const sid of store.listSessions()) {
    console.log(`  ${sid}  turns=${store.load(sid).length}`);
  }
  console.log(`  subkeys of ${parent}: ${pyList(store.listSubkeys(parent))}`);

  console.log("\nhooks fired");
  for (const line of hookLog.slice(0, 10)) console.log(`  ${line}`);
  console.log(`  ... ${hookLog.length} hook events total`);

  console.log("\ndelete parent (cascades to subs)");
  store.delete(parent);
  console.log(`  remaining sessions: ${pyList(store.listSessions())}`);

  console.log();
  console.log("subagent results return to orchestrator; orchestrator context is preserved.");
}

main();
