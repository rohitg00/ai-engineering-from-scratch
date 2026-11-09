// Lesson: Multi-Agent Debate and Collaboration (phase 14 / lesson 25)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/25-multi-agent-debate/docs/en.md
// Run: npx tsx phases/14-agent-engineering/25-multi-agent-debate/code/main.ts

function mostCommonOne(values: string[]): string {
  const counts = new Map<string, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  let best = "";
  let bestCount = -1;
  for (const [v, c] of counts) {
    if (c > bestCount) {
      best = v;
      bestCount = c;
    }
  }
  return best;
}

interface Debater {
  name: string;
  drift: (question: string, peerAnswers: string[]) => string;
}

function makeDebater(name: string, bias: string, corrections: Record<string, string>): Debater {
  const drift = (question: string, peerAnswers: string[]): string => {
    const current = corrections[question] ?? bias;
    if (peerAnswers.length > 0) {
      const common = mostCommonOne(peerAnswers);
      if (common !== current && common !== bias) return common;
    }
    return current;
  };
  return { name, drift };
}

type Answers = Map<string, string>;

function fullMeshRound(debaters: Debater[], question: string, prior: Answers): [Answers, number] {
  const newAnswers: Answers = new Map();
  let ops = 0;
  for (const debater of debaters) {
    const peers = debaters.filter((d) => d.name !== debater.name).map((d) => prior.get(d.name)!);
    newAnswers.set(debater.name, debater.drift(question, peers));
    ops += peers.length;
  }
  return [newAnswers, ops];
}

function sparseStarRound(hub: Debater, spokes: Debater[], question: string, prior: Answers): [Answers, number] {
  const newAnswers: Answers = new Map();
  let ops = 0;
  const spokeNames = spokes.map((s) => s.name);
  newAnswers.set(
    hub.name,
    hub.drift(
      question,
      spokeNames.map((n) => prior.get(n)!),
    ),
  );
  ops += spokeNames.length;
  for (const spoke of spokes) {
    newAnswers.set(spoke.name, spoke.drift(question, [prior.get(hub.name)!]));
    ops += 1;
  }
  return [newAnswers, ops];
}

function runDebate(debaters: Debater[], question: string, rounds: number, topology: string): [string, number, number] {
  let prior: Answers = new Map();
  for (const debater of debaters) prior.set(debater.name, debater.drift(question, []));

  let totalOps = 0;
  let convergedRound = -1;
  const hub = debaters[0]!;
  const spokes = debaters.slice(1);
  for (let r = 0; r < rounds; r++) {
    const [next, ops] =
      topology === "full_mesh" ? fullMeshRound(debaters, question, prior) : sparseStarRound(hub, spokes, question, prior);
    totalOps += ops;
    const vals = [...next.values()];
    if (vals.every((v) => v === vals[0]) && convergedRound === -1) convergedRound = r + 1;
    prior = next;
  }

  const votes = mostCommonOne([...prior.values()]);
  return [votes, convergedRound, totalOps];
}

function main(): void {
  console.log("=".repeat(70));
  console.log("MULTI-AGENT DEBATE: Phase 14, Lesson 25");
  console.log("=".repeat(70));

  const questionsAndTruth: [string, string][] = [
    ["capital_of_portugal", "Lisbon"],
    ["is_2_plus_2_equal_4", "yes"],
    ["chess_legal_e4", "legal"],
  ];

  const debaters = [
    makeDebater("alpha", "Lisbon", { is_2_plus_2_equal_4: "yes", chess_legal_e4: "legal" }),
    makeDebater("beta", "Madrid", {
      capital_of_portugal: "Lisbon",
      is_2_plus_2_equal_4: "yes",
      chess_legal_e4: "legal",
    }),
    makeDebater("gamma", "Porto", {
      capital_of_portugal: "Lisbon",
      is_2_plus_2_equal_4: "yes",
      chess_legal_e4: "legal",
    }),
  ];

  for (const [q, truth] of questionsAndTruth) {
    console.log(`\n--- ${q}  (truth: ${truth}) ---`);
    for (const topology of ["full_mesh", "sparse_star"]) {
      const [answer, converged, ops] = runDebate(debaters, q, 3, topology);
      const correct = answer === truth ? "CORRECT" : "WRONG";
      console.log(
        `  ${topology.padEnd(12)}  answer=${answer.padEnd(10)}  ` + `converged_round=${converged}  ops=${ops}  ${correct}`,
      );
    }
  }

  console.log();
  console.log("sparse star matches full mesh on accuracy with fewer critique ops.");
  console.log("debate helps factual and rule-based tasks; adds latency and cost.");
}

main();
