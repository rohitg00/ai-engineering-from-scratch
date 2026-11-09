// Lesson: FinOps for LLMs: Unit Economics and Multi-Tenant Attribution (phase 17 / lesson 27)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/27-finops-llms/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/27-finops-llms/code/main.ts

function fixed(x: number, digits: number): string {
  const rounded = x.toFixed(digits);
  if (Math.abs(x) >= 1e21) return rounded;
  const exact = x.toFixed(100);
  const dot = exact.indexOf(".");
  if (!/^50*$/.test(exact.slice(dot + 1 + digits))) return rounded;
  const kept = digits === 0 ? exact.slice(0, dot) : exact.slice(0, dot + 1 + digits);
  return Number(kept.slice(-1)) % 2 === 0 ? kept : rounded;
}

const rj = (s: string | number, w: number): string => String(s).padStart(w);

let rngState = 0;

function seed(value: number): void {
  rngState = value >>> 0;
}

function random(): number {
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function uniform(a: number, b: number): number {
  return a + (b - a) * random();
}

function gauss(mu: number, sigma: number): number {
  let u1 = random();
  while (u1 === 0) u1 = random();
  const u2 = random();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function stdev(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((acc, x) => acc + (x - m) ** 2, 0) / (xs.length - 1));
}

interface TenantPolicy {
  contractedDailyUsd: number;
  rateLimitPerMin: number;
  spendCapMultiplier: number;
  killZScore: number;
}

interface TenantState {
  spendTodayUsd: number;
  minuteCount: number;
  dailyHistory: number[];
  paused: boolean;
}

function policy(contractedDailyUsd: number, rateLimitPerMin: number): TenantPolicy {
  return { contractedDailyUsd, rateLimitPerMin, spendCapMultiplier: 2.0, killZScore: 4.0 };
}

function freshState(): TenantState {
  return { spendTodayUsd: 0.0, minuteCount: 0, dailyHistory: [], paused: false };
}

const TENANTS = new Map<string, [TenantPolicy, TenantState, number]>([
  ["tenant_A_normal", [policy(100.0, 120), freshState(), 1.0]],
  ["tenant_B_growing", [policy(50.0, 60), freshState(), 2.5]],
  ["tenant_C_abusive", [policy(20.0, 40), freshState(), 25.0]],
]);

function simulateDay(_day: number, verbose: boolean): void {
  for (const [name, [pol, state, trafficMult]] of TENANTS) {
    if (state.paused) continue;
    const requests = Math.trunc(100 * trafficMult * uniform(0.8, 1.3));
    const tokensPerReq = Math.trunc(gauss(600, 150));
    const costPerReq = (tokensPerReq / 1e6) * 10.0;
    const totalSpend = requests * costPerReq;
    state.spendTodayUsd += totalSpend;

    const cap = pol.contractedDailyUsd * pol.spendCapMultiplier;
    if (state.spendTodayUsd > cap && verbose) {
      console.log(`  [cap breach] ${name}: $${fixed(state.spendTodayUsd, 2)} > cap $${fixed(cap, 2)} → tighten rate + alert CS`);
    }

    if (state.dailyHistory.length >= 5) {
      const m = mean(state.dailyHistory);
      const sd = stdev(state.dailyHistory) || 1;
      const z = (state.spendTodayUsd - m) / sd;
      if (z > pol.killZScore) {
        state.paused = true;
        if (verbose) {
          console.log(
            `  [KILL SWITCH] ${name}: z=${fixed(z, 2)} on spend $${fixed(state.spendTodayUsd, 2)} (baseline $${fixed(m, 2)} ± $${fixed(sd, 2)}) → auto-pause + page on-call`,
          );
        }
      }
    }
  }
}

function main(): void {
  console.log("=".repeat(95));
  console.log("FINOPS ENFORCEMENT: three tenants over 10 days, abusive tenant triggers kill switch");
  console.log("=".repeat(95));
  seed(4);

  for (let day = 1; day <= 10; day++) {
    console.log(`\nDay ${day}:`);
    simulateDay(day, true);
    for (const [name, [pol, state]] of TENANTS) {
      const status = state.paused ? "PAUSED" : "active";
      console.log(`  ${name}: spend=$${rj(fixed(state.spendTodayUsd, 2), 7)}, contract=$${fixed(pol.contractedDailyUsd, 2)}  [${status}]`);
      state.dailyHistory.push(state.spendTodayUsd);
      if (!state.paused) state.spendTodayUsd = 0.0;
    }
  }
  console.log("\nRead: rate limits throttle; caps trigger alerts; kill switch catches blow-ups.");
}

main();
