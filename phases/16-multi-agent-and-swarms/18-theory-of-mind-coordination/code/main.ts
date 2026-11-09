// Lesson: Theory of Mind and Emergent Coordination (phase 16 / lesson 18)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/18-theory-of-mind-coordination/code/main.ts

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function choice<T>(rng: Random, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

class World {
  constructor(public nBoxes: number, public boxesWithTokens: Set<number>) {}

  static create(n: number): World {
    return new World(n, new Set(Array.from({ length: n }, (_, i) => i)));
  }
}

class Agent {
  target: number | null = null;
  collected = false;
  observations: [string, number][] = [];

  constructor(public name: string, public tom: boolean) {}

  chooseTarget(world: World, rng: Random): number {
    if (this.collected) {
      return -1;
    }
    const available = [...world.boxesWithTokens].sort((a, b) => a - b);
    if (available.length === 0) {
      return -1;
    }
    if (!this.tom) {
      return choice(rng, available);
    }
    const lastTurnTargets = new Set(
      this.observations.slice(-(world.boxesWithTokens.size + 2)).map(([, box]) => box),
    );
    const options = available.filter((b) => !lastTurnTargets.has(b));
    return options.length > 0 ? choice(rng, options) : choice(rng, available);
  }

  observe(other: string, box: number): void {
    this.observations.push([other, box]);
  }
}

function runTrial(
  nAgents: number,
  nBoxes: number,
  tom: boolean,
  seed: number,
  maxTurns = 10,
): [number, number, number] {
  const rng = mulberry32(seed);
  const world = World.create(nBoxes);
  const agents = Array.from({ length: nAgents }, (_, i) => new Agent(`agent-${i}`, tom));

  if (tom) {
    agents.forEach((a, i) => {
      agents.forEach((other, j) => {
        if (i !== j) {
          a.observe(other.name, j % nBoxes);
        }
      });
    });
  }

  let duplications = 0;
  let turns = 0;
  for (let t = 0; t < maxTurns; t++) {
    turns = t + 1;
    const commitments = new Map<string, number>();
    for (const a of agents) {
      if (a.collected) {
        continue;
      }
      const c = a.chooseTarget(world, rng);
      if (c < 0) {
        continue;
      }
      commitments.set(a.name, c);
    }

    for (const observer of agents) {
      for (const [other, box] of commitments) {
        if (other === observer.name) {
          continue;
        }
        observer.observe(other, box);
      }
    }

    const choices = [...commitments.values()];
    for (const box of new Set(choices)) {
      const n = choices.filter((c) => c === box).length;
      if (n >= 2) {
        duplications += n - 1;
      }
    }

    const taken = new Set<number>();
    for (const [name, box] of commitments) {
      if (taken.has(box)) {
        continue;
      }
      if (world.boxesWithTokens.has(box)) {
        world.boxesWithTokens.delete(box);
        for (const a of agents) {
          if (a.name === name) {
            a.collected = true;
          }
        }
        taken.add(box);
      }
    }

    if (agents.every((a) => a.collected)) {
      break;
    }
  }

  const completions = agents.filter((a) => a.collected).length;
  return [completions, duplications, turns];
}

function bench(tom: boolean, trials = 200): void {
  const label = tom ? "first-order ToM" : "zeroth-order";
  let totCompletions = 0;
  let totDup = 0;
  let totTurns = 0;
  let fullTrials = 0;
  for (let t = 0; t < trials; t++) {
    const [c, d, turns] = runTrial(3, 3, tom, t + 14);
    totCompletions += c;
    totDup += d;
    totTurns += turns;
    if (c === 3) {
      fullTrials += 1;
    }
  }
  console.log(
    `  ${label.padEnd(16)} full-completion=${fullTrials}/${trials} ` +
      `  duplications/trial=${(totDup / trials).toFixed(2)}` +
      `  avg_turns=${(totTurns / trials).toFixed(2)}`,
  );
}

function main(): void {
  console.log("=".repeat(72));
  console.log("TOKEN-COLLECTION: 3 agents, 3 boxes, 10-turn budget, 200 trials each");
  console.log("agents cannot communicate; they observe each other's movements");
  console.log("=".repeat(72));
  bench(false);
  bench(true);
  console.log("\nTakeaways:");
  console.log("  zeroth-order agents collide on a shared box ~1x per trial (0.96 duplications).");
  console.log("  first-order ToM agents, given a cheap preference prime, eliminate collisions");
  console.log("  and finish in 1 turn instead of ~2.");
  console.log("  the delta is the *measurable* coordination effect -- not a prompt-dressing story.");
  console.log("  remove the prime (comment out the observe loop) to see how the effect vanishes;");
  console.log("  Riedl 2025 (arXiv:2510.05174) shows this is why ToM prompting is load-bearing.");
  console.log("  long-horizon degradation is documented in Li et al. 2023 with max_turns=30.");
}

main();

export {};
