// Phase 14 Lesson 13 — LangGraph-shaped stateful graph, in TypeScript.
//
// Mirrors code/main.py: State is a plain object, nodes return Update objects,
// the runtime serializes state after every node so resume picks up exactly
// where it left off. Human gate pauses; an external approval lets resume()
// continue from the next node.
//
// References:
//   LangGraph (TS)         https://langchain-ai.github.io/langgraphjs/
//   StateGraph reference   https://langchain-ai.github.io/langgraphjs/reference/classes/langgraph.StateGraph.html
//
// Run: npx tsx code/main.ts

type State = Record<string, unknown>;
type Update = Record<string, unknown>;
type NodeFn = (state: State) => Update;
type Router = (state: State) => string;
type Predicate = (state: State) => boolean;

const END = "__end__";

type Edge = {
  src: string;
  dst: string;
  predicate: Predicate | null;
};

class StateGraph {
  nodes = new Map<string, NodeFn>();
  edges = new Map<string, Edge[]>();
  entry: string | null = null;

  addNode(name: string, fn: NodeFn): void {
    this.nodes.set(name, fn);
  }

  setEntry(name: string): void {
    this.entry = name;
  }

  addEdge(src: string, dst: string): void {
    const list = this.edges.get(src) ?? [];
    list.push({ src, dst, predicate: null });
    this.edges.set(src, list);
  }

  addConditionalEdges(
    src: string,
    router: Router,
    targets: Record<string, string>,
  ): void {
    for (const [value, dst] of Object.entries(targets)) {
      const predicate: Predicate = (state) => router(state) === value;
      const list = this.edges.get(src) ?? [];
      list.push({ src, dst, predicate });
      this.edges.set(src, list);
    }
  }

  next(current: string, state: State): string | null {
    for (const edge of this.edges.get(current) ?? []) {
      if (edge.predicate === null || edge.predicate(state)) return edge.dst;
    }
    return null;
  }
}

class InMemoryCheckpointer {
  private store = new Map<string, Array<[string, State]>>();

  save(sessionId: string, stepName: string, state: State): void {
    const list = this.store.get(sessionId) ?? [];
    list.push([stepName, structuredClone(state)]);
    this.store.set(sessionId, list);
  }

  loadLatest(sessionId: string): [string, State] | null {
    const list = this.store.get(sessionId);
    if (!list || list.length === 0) return null;
    return list[list.length - 1];
  }

  history(sessionId: string): Array<[string, State]> {
    return [...(this.store.get(sessionId) ?? [])];
  }
}

class PausedAtNode extends Error {
  constructor(public node: string, public state: State) {
    super(node);
    this.name = "PausedAtNode";
  }
}

type RunOptions = {
  sessionId: string;
  initialState: State;
  resumeFrom?: string;
  stateOverride?: State;
};

class Runner {
  constructor(public graph: StateGraph, public checkpointer: InMemoryCheckpointer) {}

  run(opts: RunOptions): State {
    const { sessionId, initialState, resumeFrom, stateOverride } = opts;
    let state: State = structuredClone(stateOverride ?? initialState);
    let current = resumeFrom ?? this.graph.entry;
    if (!current) throw new Error("no entry node set");

    while (current && current !== END) {
      const fn = this.graph.nodes.get(current);
      if (!fn) throw new Error(`unknown node ${JSON.stringify(current)}`);
      const update = fn(state) ?? {};
      state = { ...state, ...update };
      this.checkpointer.save(sessionId, current, state);
      if (state._pause_reason) {
        const reason = state._pause_reason;
        delete state._pause_reason;
        void reason;
        throw new PausedAtNode(current, state);
      }
      const nxt = this.graph.next(current, state);
      current = nxt;
    }
    return state;
  }
}

function classify(state: State): Update {
  const text = String(state.input).toLowerCase();
  let route: string;
  if (text.includes("refund") || text.includes("money back")) route = "refund";
  else if (text.includes("crash") || text.includes("bug") || text.includes("error")) route = "bug";
  else if (text.includes("pricing") || text.includes("quote")) route = "sales";
  else route = "sales";
  return { route, step: (state.step as number ?? 0) + 1 };
}

function refund(state: State): Update {
  return { ticket: `REF-${String(state.input ?? "").slice(0, 12)}`, step: (state.step as number ?? 0) + 1 };
}

function bug(state: State): Update {
  return { ticket: `BUG-${String(state.input ?? "").slice(0, 12)}`, step: (state.step as number ?? 0) + 1 };
}

function sales(state: State): Update {
  return { ticket: `SAL-${String(state.input ?? "").slice(0, 12)}`, step: (state.step as number ?? 0) + 1 };
}

function humanGate(state: State): Update {
  if (!state.human_approval) {
    return { _pause_reason: "awaiting human approval", step: (state.step as number ?? 0) + 1 };
  }
  return { step: (state.step as number ?? 0) + 1 };
}

function send(state: State): Update {
  return { output: `sent ${state.ticket as string | undefined}`, step: (state.step as number ?? 0) + 1 };
}

function buildGraph(): StateGraph {
  const g = new StateGraph();
  g.addNode("classify", classify);
  g.addNode("refund", refund);
  g.addNode("bug", bug);
  g.addNode("sales", sales);
  g.addNode("human_gate", humanGate);
  g.addNode("send", send);
  g.setEntry("classify");

  g.addConditionalEdges(
    "classify",
    (s) => String(s.route),
    { refund: "refund", bug: "bug", sales: "sales" },
  );
  g.addEdge("refund", "human_gate");
  g.addEdge("bug", "human_gate");
  g.addEdge("sales", "human_gate");
  g.addEdge("human_gate", "send");
  g.addEdge("send", END);
  return g;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("LANGGRAPH STATE MACHINE — Phase 14, Lesson 13 (TypeScript port)");
  console.log("=".repeat(70));

  const graph = buildGraph();
  const ckpt = new InMemoryCheckpointer();
  const runner = new Runner(graph, ckpt);

  const session = "s001";
  const initial: State = {
    input: "the CLI crashes on ctrl-c, please fix",
    step: 0,
    human_approval: false,
  };

  console.log("\nfirst run (will pause at human_gate)");
  try {
    const final = runner.run({ sessionId: session, initialState: initial });
    console.log(`  final: ${JSON.stringify(final)}`);
  } catch (err) {
    if (err instanceof PausedAtNode) {
      console.log(`  PAUSED at ${err.node}`);
      console.log(`  state at pause: ${JSON.stringify(err.state)}`);
    } else {
      throw err;
    }
  }

  console.log("\ncheckpoint history");
  for (const [node, snap] of ckpt.history(session)) {
    console.log(
      `  ${node}  route=${snap.route as string | undefined}  ` +
        `ticket=${snap.ticket as string | undefined}  step=${snap.step as number | undefined}`,
    );
  }

  console.log("\nhuman approves; resume from next node after human_gate");
  const latest = ckpt.loadLatest(session);
  if (!latest) throw new Error("no checkpoint");
  const [lastNode, lastState] = latest;
  const approved: State = { ...lastState, human_approval: true };
  delete approved._pause_reason;
  ckpt.save(session, `${lastNode}_reviewed`, approved);

  const final = runner.run({
    sessionId: session,
    initialState: initial,
    resumeFrom: "send",
    stateOverride: approved,
  });
  console.log(`  final: ${JSON.stringify(final)}`);

  console.log();
  console.log("property: state serializes after every node; resume is exact.");
  console.log("no fresh re-runs after step 38 fails; pick up at step 39.");
}

main();
