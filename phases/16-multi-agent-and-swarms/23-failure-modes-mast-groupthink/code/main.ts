// Lesson: Failure Modes: MAST, Groupthink, Monoculture, Cascading Errors (phase 16 / lesson 23)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/23-failure-modes-mast-groupthink/code/main.ts

import { performance } from "node:perf_hooks";

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

function monotonic(): number {
  return performance.now() / 1000;
}

const MAST_CATEGORIES: Record<string, string> = {
  spec: "Specification Problem (41.77% of failures)",
  coord: "Coordination Failure (36.94% of failures)",
  verify: "Verification Gap (21.30% of failures)",
};

const GROUPTHINK: Record<string, string> = {
  monoculture: "monoculture collapse (same base model → correlated errors)",
  conformity: "conformity bias (agents align with loudest peer)",
  tom: "deficient theory of mind (cannot model each other)",
  mixed_motive: "mixed-motive drift (compromise-middle satisfies no one)",
  cascade: "cascading reliability failures (retry storms)",
};

type Symptoms = Record<string, boolean | string>;

function categorizeIncident(symptoms: Symptoms): [string, string] {
  if (symptoms.role_conflict || symptoms.task_ambiguity) {
    return ["spec", MAST_CATEGORIES.spec];
  }
  if (symptoms.state_drift || symptoms.message_lost || symptoms.sync_error) {
    return ["coord", MAST_CATEGORIES.coord];
  }
  if (symptoms.no_verifier || symptoms.hallucination_propagation) {
    return ["verify", MAST_CATEGORIES.verify];
  }
  return ["unknown", "no MAST category matched"];
}

function detectGroupthink(symptoms: Symptoms): [string, string][] {
  const hits: [string, string][] = [];
  if (symptoms.correlated_errors) {
    hits.push(["monoculture", GROUPTHINK.monoculture]);
  }
  if (symptoms.agreement_rate_spike) {
    hits.push(["conformity", GROUPTHINK.conformity]);
  }
  if (symptoms.coordination_drop_long_horizon) {
    hits.push(["tom", GROUPTHINK.tom]);
  }
  if (symptoms.compromise_outputs) {
    hits.push(["mixed_motive", GROUPTHINK.mixed_motive]);
  }
  if (symptoms.retry_amplification) {
    hits.push(["cascade", GROUPTHINK.cascade]);
  }
  return hits;
}

enum BreakerState {
  CLOSED = "closed",
  OPEN = "open",
  HALF_OPEN = "half_open",
}

class CircuitBreaker {
  state: BreakerState = BreakerState.CLOSED;
  outcomes: boolean[] = [];
  openedAt = 0.0;

  constructor(
    public failureThreshold = 0.5,
    public windowSize = 20,
    public openCooldownS = 0.5,
  ) {}

  private errorRate(): number {
    if (this.outcomes.length === 0) {
      return 0.0;
    }
    const recent = this.outcomes.slice(-this.windowSize);
    return 1.0 - recent.filter((o) => o).length / recent.length;
  }

  allow(): boolean {
    if (this.state === BreakerState.OPEN) {
      if (monotonic() - this.openedAt >= this.openCooldownS) {
        this.state = BreakerState.HALF_OPEN;
      } else {
        return false;
      }
    }
    return true;
  }

  record(success: boolean): void {
    this.outcomes.push(success);
    if (this.state === BreakerState.HALF_OPEN) {
      if (success) {
        this.state = BreakerState.CLOSED;
      } else {
        this.state = BreakerState.OPEN;
        this.openedAt = monotonic();
      }
    } else if (this.state === BreakerState.CLOSED) {
      if (this.errorRate() > this.failureThreshold && this.outcomes.length >= this.windowSize) {
        this.state = BreakerState.OPEN;
        this.openedAt = monotonic();
      }
    }
  }
}

class DownstreamService {
  load = 0;

  constructor(public baseFailureRate = 0.1) {}

  handle(rng: Random): boolean {
    let effectiveRate = this.baseFailureRate + this.load * 0.02;
    effectiveRate = Math.min(effectiveRate, 0.99);
    return rng() > effectiveRate;
  }
}

function simulateRetryStorm(requests: number, useBreaker: boolean, seed = 0): [number, number, number] {
  const rng = mulberry32(seed);
  const service = new DownstreamService();
  const breaker = new CircuitBreaker();
  let totalCalls = 0;
  let successes = 0;
  let shortCircuits = 0;

  for (let r = 0; r < requests; r++) {
    let attemptsForReq = 0;
    while (attemptsForReq < 4) {
      if (useBreaker && !breaker.allow()) {
        shortCircuits += 1;
        break;
      }
      service.load = Math.min(Math.floor(totalCalls / 10), 50);
      totalCalls += 1;
      const ok = service.handle(rng);
      if (useBreaker) {
        breaker.record(ok);
      }
      if (ok) {
        successes += 1;
        break;
      }
      attemptsForReq += 1;
    }
  }
  return [totalCalls, successes, shortCircuits];
}

function demoIncidentCategorization(): void {
  console.log("=".repeat(72));
  console.log("INCIDENT CATEGORIZATION: map symptoms to MAST + Groupthink families");
  console.log("=".repeat(72));
  const incidents: Symptoms[] = [
    { role_conflict: true, name: "two agents both reviewing" },
    { state_drift: true, name: "agent A thinks done; agent B still running" },
    { no_verifier: true, hallucination_propagation: true, name: "hallucinated fact crosses agents" },
    { correlated_errors: true, agreement_rate_spike: true, name: "3 agents all give same wrong answer" },
    { retry_amplification: true, name: "payment retries cascade to inventory" },
  ];
  for (const inc of incidents) {
    const name = inc.name;
    delete inc.name;
    const [cat, desc] = categorizeIncident(inc);
    const gt = detectGroupthink(inc);
    console.log(`\n  incident: ${name}`);
    console.log(`    MAST:       ${cat}: ${desc}`);
    for (const [code, d] of gt) {
      console.log(`    Groupthink: ${code}: ${d}`);
    }
  }
}

function pad4(n: number): string {
  return String(n).padStart(4);
}

function demoRetryStorm(): void {
  console.log("\n" + "=".repeat(72));
  console.log("RETRY STORM: 200 requests against a 10% baseline-failing service");
  console.log("=".repeat(72));
  const [totalNoCb, succNoCb] = simulateRetryStorm(200, false, 0);
  const [totalCb, succCb, sc] = simulateRetryStorm(200, true, 0);
  console.log(`  no circuit breaker:  total_calls=${pad4(totalNoCb)}  success=${pad4(succNoCb)}`);
  console.log(
    `  with circuit breaker: total_calls=${pad4(totalCb)}  success=${pad4(succCb)}  short_circuited=${sc}`,
  );
  console.log("  the breaker short-circuits once failure rate exceeds the threshold,");
  console.log("  stopping the amplification. Success count may drop, but downstream survives.");
}

function main(): void {
  demoIncidentCategorization();
  demoRetryStorm();
  console.log("\nTakeaways:");
  console.log("  MAST categories give names to the failures; categorization is the first fix.");
  console.log("  Circuit breakers are the canonical cascade mitigation -- same as distributed systems.");
  console.log("  STRATUS-style detection / diagnosis / validation adds 1.5x mitigation success.");
  console.log("  Slow-failure proxies (agreement rate, retry rate) catch drift before loud errors.");
}

main();
