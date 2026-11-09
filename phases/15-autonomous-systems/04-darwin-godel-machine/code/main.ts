// Lesson: Darwin Godel Machine: Open-Ended Self-Modifying Agents (phase 15 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/04-darwin-godel-machine/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/04-darwin-godel-machine/code/main.ts

let rngState = 0;

function seedRandom(value: number): void {
  rngState = value >>> 0;
}

function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function randrange(n: number): number {
  return Math.floor(random() * n);
}

function choice<T>(items: T[]): T {
  return items[randrange(items.length)];
}

function uniform(a: number, b: number): number {
  return a + (b - a) * random();
}

function pyFixed(value: number, digits: number): string {
  if (!Number.isFinite(value)) return Number.isNaN(value) ? "nan" : value > 0 ? "inf" : "-inf";
  const rounded = value.toFixed(digits);
  const exact = Math.abs(value).toFixed(Math.min(100, digits + 60));
  const tail = exact.slice(exact.indexOf(".") + 1 + digits);
  const tie = /^50*$/.test(tail);
  if (!tie) return rounded;
  const down = (Math.trunc(Math.abs(value) * 10 ** digits) / 10 ** digits).toFixed(digits);
  const lastDigit = Number(down.replace(".", "").slice(-1));
  const magnitude = lastDigit % 2 === 0 ? down : (Number(down) + 10 ** -digits).toFixed(digits);
  return value < 0 ? `-${magnitude}` : magnitude;
}


function rjust(text: string | number, width: number): string {
  return String(text).padStart(width);
}

function pyRound(value: number, digits: number): number {
  return Number(pyFixed(value, digits));
}

function signed(value: number, digits: number): string {
  const text = pyFixed(value, digits);
  return text.startsWith("-") ? text : `+${text}`;
}

function reprList(items: string[]): string {
  return `[${items.map((item) => `'${item}'`).join(", ")}]`;
}

const TOOLS: [string, (s: string) => string][] = [
  ["upper", (s) => s.toUpperCase()],
  ["lower", (s) => s.toLowerCase()],
  ["reverse", (s) => [...s].reverse().join("")],
  ["trim", (s) => s.trim()],
  ["collapse", (s) => s.split(/\s+/).filter((part) => part !== "").join(" ")],
  ["nop", (s) => s],
];

const CASES: [string, string][] = [
  ["  Hello   World  ", "Hello World"],
  ["FOO   bar", "Foo Bar"],
  ["  MixedCase Space  ", "Mixedcase Space"],
  ["Already clean", "Already Clean"],
  ["\t tabby\ttab ", "Tabby Tab"],
  ["   X   ", "X"],
  ["nothing  SPECIAL here", "Nothing Special Here"],
  ["ITEM   one-two", "Item One-Two"],
];

function hashSeq(seq: string[]): string[] {
  return [...seq];
}

interface Agent {
  ops: string[];
  hack_bonus: number;
}

function apply(agent: Agent, input: string): string {
  const toolMap = new Map(TOOLS);
  let s = input;
  for (const op of agent.ops) {
    const fn = toolMap.get(op);
    if (fn === undefined) return "";
    s = fn(s);
  }
  return s;
}

function trueScore(agent: Agent): number {
  let correct = 0;
  for (const [inp, want] of CASES) {
    if (apply(agent, inp) === want) correct += 1;
  }
  return correct / CASES.length;
}

function reportedScore(agent: Agent, hackAllowed: boolean): number {
  const base = trueScore(agent);
  if (hackAllowed) return Math.min(1.0, base + agent.hack_bonus);
  return base;
}

function mutate(parent: Agent, hackAllowed: boolean): Agent {
  const ops = [...parent.ops];
  const toolNames = TOOLS.map((t) => t[0]);
  const move = random();
  if (move < 0.3 && ops.length > 0) {
    const i = randrange(ops.length);
    ops[i] = choice(toolNames);
  } else if (move < 0.6 && ops.length < 8) {
    const at = randrange(ops.length + 1);
    ops.splice(at, 0, choice(toolNames));
  } else if (move < 0.85 && ops.length > 1) {
    ops.splice(randrange(ops.length), 1);
  }

  let bonus = parent.hack_bonus;
  if (hackAllowed && random() < 0.08) {
    bonus = Math.min(1.0, bonus + uniform(0.0, 0.1));
  }
  return { ops, hack_bonus: bonus };
}

function runDgm(generations: number, hackAllowed: boolean, seed: number | null = null): void {
  if (seed !== null) seedRandom(seed);
  const archive = new Map<string, Agent>();
  const init: Agent = { ops: ["nop"], hack_bonus: 0.0 };
  archive.set(`${init.ops.length},${pyRound(reportedScore(init, hackAllowed), 2)}`, init);

  let bestReport = reportedScore(init, hackAllowed);
  let bestTrue = trueScore(init);
  console.log(
    `  gen ${rjust(0, 4)}  report ${pyFixed(bestReport, 2)}  true ${pyFixed(bestTrue, 2)}  ` +
      `ops ${reprList(init.ops)}  bonus ${pyFixed(init.hack_bonus, 2)}`,
  );

  for (let g = 1; g <= generations; g++) {
    const parent = choice([...archive.values()]);
    const child = mutate(parent, hackAllowed);
    const rep = reportedScore(child, hackAllowed);
    const trueS = trueScore(child);
    const key = `${child.ops.length},${pyRound(rep, 2)}`;
    const incumbent = archive.get(key);
    if (incumbent === undefined || rep > reportedScore(incumbent, hackAllowed)) archive.set(key, child);
    if (rep > bestReport) {
      bestReport = rep;
      bestTrue = trueS;
      console.log(
        `  gen ${rjust(g, 4)}  report ${pyFixed(rep, 2)}  true ${pyFixed(trueS, 2)}  ` +
          `ops ${reprList(child.ops)}  bonus ${pyFixed(child.hack_bonus, 2)}`,
      );
    }
  }

  let best: Agent | null = null;
  for (const agent of archive.values()) {
    if (best === null || reportedScore(agent, hackAllowed) > reportedScore(best, hackAllowed)) best = agent;
  }
  const winner = best as Agent;
  console.log(`\n  final reported score : ${pyFixed(reportedScore(winner, hackAllowed), 2)}`);
  console.log(`  final true score     : ${pyFixed(trueScore(winner), 2)}`);
  console.log(`  final ops            : ${reprList(winner.ops)}`);
  console.log(`  final hack bonus     : ${pyFixed(winner.hack_bonus, 2)}`);
  const gap = reportedScore(winner, hackAllowed) - trueScore(winner);
  console.log(`  reported - true      : ${signed(gap, 2)}`);
}

function main(): void {
  const hackAllowed = process.argv.slice(2).includes("--reward-hack-allowed");

  console.log("=".repeat(70));
  console.log("DARWIN GODEL MACHINE-STYLE LOOP (Phase 15, Lesson 4)");
  console.log("=".repeat(70));
  console.log(`reward-hack side channel: ${hackAllowed ? "OPEN" : "closed"}`);

  console.log("\nRun");
  console.log("-".repeat(70));
  runDgm(200, hackAllowed, 7);

  console.log();
  console.log("=".repeat(70));
  console.log("HEADLINE: the evaluator must live outside the agent's reach");
  console.log("-".repeat(70));
  if (hackAllowed) {
    console.log("  With the side channel open, reported score climbs above true.");
    console.log("  This reproduces DGM's documented reward-hacking mode: the");
    console.log("  agent edits the pipeline that scores it, not the behavior.");
  } else {
    console.log("  With the side channel closed, reported == true. The loop");
    console.log("  converges on the real target. Rerun with --reward-hack-allowed");
    console.log("  to see the documented failure mode.");
  }
}

main();

export {};
