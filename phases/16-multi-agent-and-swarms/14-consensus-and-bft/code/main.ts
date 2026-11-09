// Lesson: Consensus and Byzantine Fault Tolerance for Agents (phase 16 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/14-consensus-and-bft/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/14-consensus-and-bft/code/main.ts

export {};

class Vote {
  constructor(public agent: string, public answer: string, public confidence: number) {}

  canonical(): string {
    return [...this.answer.toLowerCase().trim()]
      .filter((c) => /[\p{L}\p{N}]/u.test(c) || c === "." || c === "%")
      .join("");
  }
}

function pyStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
  if (q === "'") out = out.replace(/'/g, "\\'");
  return q + out + q;
}

function argmax(m: Map<string, number>): string {
  let best = "";
  let bestVal = -Infinity;
  for (const [k, v] of m) {
    if (v > bestVal) {
      best = k;
      bestVal = v;
    }
  }
  return best;
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const n = s.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function plurality(votes: Vote[]): [string, Map<string, number>] {
  const counts = new Map<string, number>();
  const rep = new Map<string, string>();
  for (const v of votes) {
    const key = v.canonical();
    counts.set(key, (counts.get(key) ?? 0) + 1);
    if (!rep.has(key)) rep.set(key, v.answer);
  }
  return [rep.get(argmax(counts))!, counts];
}

function cpWbft(votes: Vote[], threshold = 0.5): [string | null, Map<string, number>] {
  const weights = new Map<string, number>();
  const rep = new Map<string, string>();
  for (const v of votes) {
    const key = v.canonical();
    weights.set(key, (weights.get(key) ?? 0.0) + v.confidence);
    if (!rep.has(key)) rep.set(key, v.answer);
  }
  let total = 0;
  for (const w of weights.values()) total += w;
  if (total === 0) total = 1.0;
  const winnerKey = argmax(weights);
  if (weights.get(winnerKey)! / total < threshold) return [null, weights];
  return [rep.get(winnerKey)!, weights];
}

function decentllms(votes: Vote[]): [string | null, Map<string, number>] {
  const clusters = new Map<string, Vote[]>();
  for (const v of votes) {
    const key = v.canonical();
    if (!clusters.has(key)) clusters.set(key, []);
    clusters.get(key)!.push(v);
  }

  const scores = new Map<string, number>();
  for (const [key, cluster] of clusters) {
    const med = median(cluster.map((v) => v.confidence));
    const dist = cluster.reduce((s, v) => s + Math.abs(v.confidence - med), 0);
    scores.set(key, cluster.length * Math.max(0.0, 1.0 - dist));
  }

  const winnerKey = argmax(scores);
  return [clusters.get(winnerKey)![0].answer, scores];
}

function scenario(name: string, correct: string, votes: Vote[]): void {
  console.log("\n" + "=".repeat(72));
  console.log(`SCENARIO: ${name}`);
  console.log(`  correct answer: ${pyStr(correct)}`);
  console.log("=".repeat(72));
  for (const v of votes) {
    console.log(`  ${v.agent.padEnd(12)} -> ${pyStr(v.answer).padEnd(20)}  conf=${v.confidence.toFixed(2)}`);
  }

  const [plural] = plurality(votes);
  const [cp] = cpWbft(votes);
  const [dec] = decentllms(votes);

  const mark = (a: string | null): string => {
    if (a === null) return "[rejected below threshold]";
    return a === correct ? "[CORRECT]" : "[WRONG]";
  };

  console.log(`\n  plurality    -> ${pyStr(plural).padEnd(22)} ${mark(plural)}`);
  console.log(`  CP-WBFT      -> ${pyStr(cp === null ? "None" : cp).padEnd(22)} ${mark(cp)}`);
  console.log(`  DecentLLMs   -> ${(dec === null ? "None" : pyStr(dec)).padEnd(22)} ${mark(dec)}`);
}

function main(): void {
  scenario("no attack", "4.2%", [
    new Vote("agent-a", "4.2%", 0.85),
    new Vote("agent-b", "4.2%", 0.80),
    new Vote("agent-c", "4.2%", 0.75),
    new Vote("agent-d", "5%", 0.40),
    new Vote("agent-e", "4.2%", 0.70),
  ]);

  scenario("byzantine lie", "4.2%", [
    new Vote("agent-a", "4.2%", 0.75),
    new Vote("agent-b", "4.2%", 0.70),
    new Vote("agent-c", "4.2%", 0.80),
    new Vote("agent-d", "42%", 0.95),
    new Vote("agent-e", "4.2%", 0.65),
  ]);

  scenario("sycophantic conformity", "4.2%", [
    new Vote("agent-a", "42%", 0.35),
    new Vote("agent-b", "42%", 0.30),
    new Vote("agent-c", "4.2%", 0.85),
    new Vote("agent-d", "4.2%", 0.80),
    new Vote("agent-e", "4.2%", 0.82),
  ]);

  scenario("monoculture (correlated errors)", "4.2%", [
    new Vote("agent-a", "42%", 0.70),
    new Vote("agent-b", "42%", 0.68),
    new Vote("agent-c", "42%", 0.72),
    new Vote("agent-d", "4.2%", 0.85),
    new Vote("agent-e", "4.2%", 0.82),
  ]);

  console.log("\nTakeaways:");
  console.log("  plurality is wrong whenever a correlated cluster is >= half the votes.");
  console.log("  CP-WBFT mitigates sycophancy because conformers have low confidence.");
  console.log("  DecentLLMs scoring penalizes high-variance clusters -- helps on monoculture when");
  console.log("  the dissenting agents are at least as confident as the majority.");
  console.log("  no aggregator solves monoculture when the wrong cluster is both larger AND more");
  console.log("  confident than the right cluster. That case needs diversity or verification.");
}

main();
