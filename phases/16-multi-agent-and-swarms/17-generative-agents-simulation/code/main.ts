// Lesson: Generative Agents and Emergent Simulation (phase 16 / lesson 17)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/17-generative-agents-simulation/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/17-generative-agents-simulation/code/main.ts

export {};

class Memory {
  constructor(public ts: number, public kind: string, public content: string, public importance: number) {}
}

class Plan {
  constructor(public tick: number, public where: string, public note: string) {}
}

class Agent {
  stream: Memory[] = [];
  plans: Plan[] = [];
  beliefs: string[] = [];

  constructor(public name: string, public location: string) {}

  observe(tick: number, content: string, importance = 3): void {
    this.stream.push(new Memory(tick, "observation", content, importance));
  }

  reflect(tick: number): void {
    const recentImportant = this.stream.filter((m) => m.importance >= 6 && tick - m.ts <= 5);
    for (const m of recentImportant) {
      if (m.content.includes("invited") && m.content.includes("party at")) {
        const belief = "there is a party I was invited to";
        if (!this.beliefs.includes(belief)) {
          this.beliefs.push(belief);
          this.stream.push(new Memory(tick, "reflection", belief, 8));
        }
      }
    }
  }

  updatePlan(tick: number): void {
    void tick;
    if (this.beliefs.includes("there is a party I was invited to")) {
      if (!this.plans.some((p) => p.where === "HobbsCafe")) {
        this.plans.push(new Plan(5, "HobbsCafe", "attend the party"));
      }
    }
  }

  act(tick: number): string {
    for (const p of this.plans) {
      if (p.tick === tick) {
        this.location = p.where;
        return `${this.name} moves to ${p.where} (${p.note})`;
      }
    }
    return `${this.name} remains at ${this.location}`;
  }
}

function retrieveTopK(stream: Memory[], query: string, tick: number, k = 3): Memory[] {
  const words = query.toLowerCase().split(/\s+/).filter((w) => w !== "");
  const score = (m: Memory): number => {
    const recency = Math.exp(-0.3 * (tick - m.ts));
    const importance = m.importance / 10.0;
    const relevance = words.some((w) => m.content.toLowerCase().includes(w)) ? 0.6 : 0.1;
    return recency + importance + relevance;
  };
  return [...stream].sort((a, b) => score(b) - score(a)).slice(0, k);
}

function runSimulation(nAgents = 5, ticks = 6): void {
  const agents: Agent[] = [];
  for (let i = 0; i < nAgents; i++) agents.push(new Agent(`agent-${i}`, "home"));

  agents[0].stream.push(new Memory(0, "goal", "host a Valentine's party at HobbsCafe at tick 5", 10));
  agents[0].plans.push(new Plan(5, "HobbsCafe", "host the party"));
  agents[0].beliefs.push("there is a party I was invited to");

  console.log("=".repeat(72));
  console.log(`GENERATIVE AGENTS (miniature): ${nAgents} agents, ${ticks} ticks`);
  console.log("=".repeat(72));

  for (let tick = 0; tick < ticks; tick++) {
    console.log(`\n--- tick ${tick} ---`);
    if (tick === 0) {
      for (const i of [1, 2]) {
        agents[i].observe(tick, "agent-0 invited me to a party at HobbsCafe at tick 5", 8);
        console.log(`  agent-0 -> agent-${i}: invitation`);
      }
    }
    if (tick === 1) {
      agents[3].observe(tick, "agent-1 invited me to a party at HobbsCafe at tick 5", 7);
      console.log("  agent-1 -> agent-3: second-degree invitation");
    }
    if (tick === 2) {
      agents[4].observe(tick, "agent-2 invited me to a party at HobbsCafe at tick 5", 7);
      console.log("  agent-2 -> agent-4: second-degree invitation");
    }

    for (const a of agents) {
      a.reflect(tick);
      a.updatePlan(tick);
      const action = a.act(tick);
      if (action.startsWith(a.name + " moves")) console.log(`  ${action}`);
    }
  }

  console.log("\n" + "=".repeat(72));
  console.log("final locations:");
  for (const a of agents) console.log(`  ${a.name.padEnd(10)} at ${a.location}`);

  const atParty = agents.filter((a) => a.location === "HobbsCafe").length;
  console.log(`\n${atParty}/${nAgents} agents converged at HobbsCafe for the party.`);
  console.log("No orchestrator. One seed. The rest is memory + reflection + plan.");
}

function demoRetrieval(): void {
  console.log("\n" + "=".repeat(72));
  console.log("RETRIEVAL DEMO: top-k by recency + importance + relevance");
  console.log("=".repeat(72));
  const stream = [
    new Memory(0, "observation", "saw Isabella at the cafe", 4),
    new Memory(1, "observation", "Isabella said she is planning a party", 7),
    new Memory(2, "reflection", "I would enjoy a party at the cafe", 6),
    new Memory(3, "observation", "Klaus mentioned he is writing a paper", 3),
  ];
  const top = retrieveTopK(stream, "party cafe", 4, 3);
  console.log("  query: 'party cafe' at tick 4");
  for (const m of top) {
    console.log(`  [t=${m.ts}] ${m.kind.padEnd(11)} imp=${m.importance} :: ${m.content}`);
  }
}

function main(): void {
  runSimulation();
  demoRetrieval();
  console.log("\nTakeaways:");
  console.log("  one seed + three components = coordinated arrival without an orchestrator.");
  console.log("  reflection is load-bearing: dropping it stops belief formation.");
  console.log("  retrieval combines recency, importance, relevance -- no single score is enough.");
}

main();
