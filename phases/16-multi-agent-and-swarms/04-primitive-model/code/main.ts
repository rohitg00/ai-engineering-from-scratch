// Lesson: The Multi-Agent Primitive Model (phase 16 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/04-primitive-model/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/04-primitive-model/code/main.ts

export {};

interface Message {
  from?: string;
  content: string;
  handoff?: string;
}

class SharedState {
  messages: Message[] = [];

  append(msg: Message): void {
    this.messages.push(msg);
  }

  snapshot(): Message[] {
    return [...this.messages];
  }

  lastBy(name: string): Message | null {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      if (this.messages[i].from === name) return this.messages[i];
    }
    return null;
  }
}

class Agent {
  constructor(
    public name: string,
    public systemPrompt: string,
    public policy: (state: SharedState) => Message,
  ) {}

  run(state: SharedState): Message {
    const msg = this.policy(state);
    if (msg.from === undefined) msg.from = this.name;
    return msg;
  }
}

function researcherPolicy(state: SharedState): Message {
  const n = state.snapshot().filter((m) => m.from === "researcher").length;
  const notes = `note ${n + 1}: FIPA-ACL ratified 2000; 20 performatives.`;
  return { content: notes, handoff: n === 0 ? "writer" : "done" };
}

function writerPolicy(state: SharedState): Message {
  const research = state.snapshot().filter((m) => m.from === "researcher").map((m) => m.content);
  const draft = research.length > 0 ? "Draft summarizing: " + research.join(" | ") : "Draft with no research yet.";
  return { content: draft, handoff: "reviewer" };
}

function reviewerPolicy(state: SharedState): Message {
  const last = state.lastBy("writer");
  const verdict = last && last.content.includes("summarizing") ? "approved" : "needs revision";
  return { content: `Review verdict: ${verdict}.`, handoff: "done" };
}

type Team = Map<string, Agent>;

function makeTeam(): Team {
  return new Map([
    ["researcher", new Agent("researcher", "Gather facts.", researcherPolicy)],
    ["writer", new Agent("writer", "Draft from research.", writerPolicy)],
    ["reviewer", new Agent("reviewer", "Critique the draft.", reviewerPolicy)],
  ]);
}

class StaticOrchestrator {
  constructor(public order: string[]) {}

  run(team: Team, state: SharedState, maxSteps = 10): void {
    for (const name of this.order.slice(0, maxSteps)) {
      const msg = team.get(name)!.run(state);
      state.append(msg);
    }
  }
}

class HandoffOrchestrator {
  constructor(public start: string) {}

  run(team: Team, state: SharedState, maxSteps = 10): void {
    let current = this.start;
    for (let i = 0; i < maxSteps; i++) {
      const agent = team.get(current);
      if (!agent) return;
      const msg = agent.run(state);
      state.append(msg);
      const nxt = msg.handoff ?? "done";
      if (nxt === "done") return;
      current = nxt;
    }
  }
}

type Selector = (state: SharedState, team: Team) => string | null;

class LLMSelectorOrchestrator {
  constructor(public start: string, public selector: Selector) {}

  run(team: Team, state: SharedState, maxSteps = 10): void {
    let current: string | null = this.start;
    for (let i = 0; i < maxSteps; i++) {
      if (current === null || !team.has(current)) return;
      const msg = team.get(current)!.run(state);
      state.append(msg);
      current = this.selector(state, team);
    }
  }
}

function roundRobinSelector(state: SharedState, team: Team): string | null {
  if (state.messages.length === 0) return null;
  const last = state.messages[state.messages.length - 1].from!;
  const names = [...team.keys()];
  const idx = (names.indexOf(last) + 1) % names.length;
  if (state.messages.filter((m) => m.from === "reviewer").length >= 1) return null;
  return names[idx];
}

function renderPool(label: string, state: SharedState): void {
  console.log(`\n=== ${label} ===`);
  state.snapshot().forEach((m, i) => {
    const ho = m.handoff !== undefined ? ` -> ${m.handoff}` : "";
    console.log(`  [${i}] ${m.from!.padEnd(10)} | ${m.content}${ho}`);
  });
}

function main(): void {
  console.log("Four multi-agent primitives demo");
  console.log("-".repeat(42));

  let team = makeTeam();
  const stateA = new SharedState();
  new StaticOrchestrator(["researcher", "writer", "reviewer"]).run(team, stateA);
  renderPool("Static (LangGraph-style)", stateA);

  team = makeTeam();
  const stateB = new SharedState();
  new HandoffOrchestrator("researcher").run(team, stateB);
  renderPool("Handoff-driven (OpenAI Swarm-style)", stateB);

  team = makeTeam();
  const stateC = new SharedState();
  new LLMSelectorOrchestrator("researcher", roundRobinSelector).run(team, stateC);
  renderPool("LLM-selected (AutoGen-style)", stateC);

  console.log("\nTakeaway: agents and state are identical across runs;");
  console.log("only the orchestrator choice changes who speaks when.");
}

main();
