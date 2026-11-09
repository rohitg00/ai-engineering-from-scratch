// Lesson: Managed LLM Platforms: Bedrock, Vertex AI, Azure OpenAI (phase 17 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/01-managed-llm-platforms/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/01-managed-llm-platforms/code/main.ts

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
const lj = (s: string, w: number): string => s.padEnd(w);

interface Platform {
  name: string;
  perMtokInput: number;
  perMtokOutput: number;
  ptuHourly: number | null;
  ptuTokensPerHour: number;
  ttftMedianMs: number;
  ttftP99Ms: number;
  ttftMedianPtuMs: number;
  attribution: string;
}

function platform(
  name: string,
  perMtokInput: number,
  perMtokOutput: number,
  ptuHourly: number | null,
  ptuTokensPerHour: number,
  ttftMedianMs: number,
  ttftP99Ms: number,
  ttftMedianPtuMs: number,
  attribution: string,
): Platform {
  return { name, perMtokInput, perMtokOutput, ptuHourly, ptuTokensPerHour, ttftMedianMs, ttftP99Ms, ttftMedianPtuMs, attribution };
}

const PLATFORMS: Platform[] = [
  platform("Bedrock on-demand", 3.0, 15.0, 21.0, 1_200_000, 75, 180, 55, "A (Application Inference Profiles)"),
  platform("Azure OpenAI (PTU)", 2.5, 10.0, 10.0, 2_000_000, 50, 140, 38, "B (scopes + tags + PTU obj)"),
  platform("Vertex AI Gemini", 1.25, 5.0, null, 0, 60, 160, 0, "B+ (BQ billing export)"),
];

function simulate(tokensInPerDay: number, tokensOutPerDay: number, slaTtftMs: number, usePtu: boolean): void {
  console.log(`\nWorkload: ${fixed(tokensInPerDay / 1e6, 1)}M input, ${fixed(tokensOutPerDay / 1e6, 1)}M output per day`);
  console.log(`SLA: TTFT P99 < ${fixed(slaTtftMs, 0)} ms   |   PTU path: ${usePtu ? "enabled" : "off"}\n`);
  const header = `${lj("Platform", 25)}  ${rj("$/day", 9)}  ${rj("TTFT P50", 10)}  ${rj("TTFT P99", 10)}  ${rj("SLA", 6)}  Attribution`;
  console.log(header);
  console.log("-".repeat(header.length));

  for (const p of PLATFORMS) {
    const costOndemand = (tokensInPerDay / 1e6) * p.perMtokInput + (tokensOutPerDay / 1e6) * p.perMtokOutput;

    let cost: number;
    let ttftP50: number;
    let ttftP99: number;
    let path: string;
    if (usePtu && p.ptuHourly !== null) {
      const totalTokens = tokensInPerDay + tokensOutPerDay;
      const dailyCapacityPerPtu = p.ptuTokensPerHour * 24;
      const ptuCount = Math.max(1, Math.floor((totalTokens + dailyCapacityPerPtu - 1) / dailyCapacityPerPtu));
      const costPtu = ptuCount * p.ptuHourly * 24;
      cost = Math.min(costOndemand, costPtu);
      ttftP50 = cost === costPtu ? p.ttftMedianPtuMs : p.ttftMedianMs;
      ttftP99 = cost === costPtu ? ttftP50 * 1.5 : p.ttftP99Ms;
      path = cost === costPtu ? "PTU" : "on-demand";
    } else {
      cost = costOndemand;
      ttftP50 = p.ttftMedianMs;
      ttftP99 = p.ttftP99Ms;
      path = "on-demand";
    }

    const slaOk = ttftP99 < slaTtftMs ? "PASS" : "FAIL";
    console.log(
      `${lj(p.name, 25)}  $${rj(fixed(cost, 2), 8)}  ${rj(fixed(ttftP50, 0), 7)} ms  ${rj(fixed(ttftP99, 0), 7)} ms  ${rj(slaOk, 6)}  ${p.attribution}  [${path}]`,
    );
  }
}

function breakEvenDemo(): void {
  console.log("\n" + "=".repeat(80));
  console.log("PTU BREAK-EVEN SWEEP: Azure OpenAI, GPT-4o class");
  console.log("=".repeat(80));
  const p = PLATFORMS[1];
  const ptuHourly = p.ptuHourly ?? 0;
  console.log(
    `On-demand rate: $${fixed(p.perMtokOutput, 2)}/M output  |  PTU: $${fixed(ptuHourly, 0)}/hr, ${fixed(p.ptuTokensPerHour / 1e6, 1)}M tok/hr\n`,
  );
  console.log(`${rj("Util %", 8)}  ${rj("On-demand $/day", 18)}  ${rj("PTU $/day", 12)}  Winner`);
  for (const utilPct of [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]) {
    const tokensPerDay = Math.trunc(p.ptuTokensPerHour * 24 * (utilPct / 100.0));
    const ondemand = (tokensPerDay / 1e6) * p.perMtokOutput;
    const ptu = 24 * ptuHourly;
    const winner = ptu < ondemand ? "PTU" : "on-demand";
    console.log(`${rj(utilPct, 7)}%  $${rj(fixed(ondemand, 2), 16)}  $${rj(fixed(ptu, 2), 10)}  ${winner}`);
  }
}

function lockInCost(): void {
  console.log("\n" + "=".repeat(80));
  console.log("TWO-PROVIDER MINIMUM: cost uplift for redundancy");
  console.log("=".repeat(80));
  const tokensPerDay = 5_000_000;
  const primaryCost = (tokensPerDay / 1e6) * 10.0;
  const gatewayOverheadPct = 3.0;
  const failoverHeadroomPct = 10.0;
  const uplift = (primaryCost * (gatewayOverheadPct + failoverHeadroomPct)) / 100;
  console.log(`Primary daily spend: $${fixed(primaryCost, 2)}`);
  console.log(`Gateway overhead (${fixed(gatewayOverheadPct, 0)}%): $${fixed((primaryCost * gatewayOverheadPct) / 100, 2)}/day`);
  console.log(`Idle secondary headroom (${fixed(failoverHeadroomPct, 0)}%): $${fixed((primaryCost * failoverHeadroomPct) / 100, 2)}/day`);
  console.log(`Total uplift: $${fixed(uplift, 2)}/day`);
  console.log(`Monthly uplift: $${fixed(uplift * 30, 2)}`);
  console.log("Cost of one multi-hour regional outage without redundancy: customer churn, SLA credits, war-room time");
}

function main(): void {
  console.log("=".repeat(80));
  console.log("MANAGED LLM PLATFORM COMPARATOR: 2026 approximations");
  console.log("=".repeat(80));

  simulate(3_000_000, 1_000_000, 200, false);
  simulate(30_000_000, 15_000_000, 100, true);

  breakEvenDemo();
  lockInCost();
}

main();
