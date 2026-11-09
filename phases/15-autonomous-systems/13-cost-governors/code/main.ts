// Lesson: Action Budgets, Iteration Caps, and Cost Governors (phase 15 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/13-cost-governors/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/13-cost-governors/code/main.ts

const NORMAL_TURN_TOKENS = 2_500;
const LOOP_TURN_TOKENS = 8_000;
const LOOP_STARTS_AT = 30;

const DOLLARS_PER_KTOK = 0.003;

function turnCost(turn: number): number {
  return turn >= LOOP_STARTS_AT ? LOOP_TURN_TOKENS : NORMAL_TURN_TOKENS;
}

class Governor {
  max_tokens_per_request = 10_000;
  max_turns = 200;
  max_budget_usd = 50.0;
  velocity_usd_per_min = 0.03;
  velocity_window_min = 10.0;
  monthly_cap_usd = 500.0;

  enable_request_cap = true;
  enable_iter_cap = true;
  enable_velocity = true;
  enable_session_cap = true;
  enable_monthly_cap = true;

  seconds_per_turn = 30.0;

  constructor(overrides: Partial<Governor> = {}) {
    Object.assign(this, overrides);
  }
}

class Run {
  turns = 0;
  tokens = 0;
  dollars = 0.0;
  history: [number, number][] = [];
  stopped_by = "";
}

const EPSILON_MIN = 1e-9;

function velocityExceeded(run: Run, gov: Governor, nowMin: number): boolean {
  if (run.history.length === 0) {
    return false;
  }
  const cutoff = nowMin - gov.velocity_window_min;
  const window = run.history.filter(([t]) => t >= cutoff);
  if (window.length === 0) {
    return false;
  }
  const [startMin, startDollars] = window[0];
  const windowDollars = run.dollars - startDollars;
  const elapsed = Math.max(nowMin - startMin, EPSILON_MIN);
  const rate = windowDollars / elapsed;
  return rate > gov.velocity_usd_per_min;
}

function simulate(gov: Governor, label: string): Run {
  const run = new Run();
  let nowMin = 0.0;

  for (let turn = 1; turn < 10_001; turn++) {
    let tok = turnCost(turn);
    if (gov.enable_request_cap && tok > gov.max_tokens_per_request) {
      tok = gov.max_tokens_per_request;
    }
    run.turns = turn;
    run.tokens += tok;
    run.dollars += (tok / 1000.0) * DOLLARS_PER_KTOK;
    nowMin += gov.seconds_per_turn / 60.0;
    run.history.push([nowMin, run.dollars]);

    if (gov.enable_iter_cap && turn >= gov.max_turns) {
      run.stopped_by = "max_turns";
      break;
    }
    if (gov.enable_session_cap && run.dollars >= gov.max_budget_usd) {
      run.stopped_by = "max_budget_usd";
      break;
    }
    if (gov.enable_velocity && velocityExceeded(run, gov, nowMin)) {
      run.stopped_by = "velocity_limit";
      break;
    }
    if (gov.enable_monthly_cap && run.dollars >= gov.monthly_cap_usd) {
      run.stopped_by = "monthly_cap";
      break;
    }
  }

  if (!run.stopped_by) {
    run.stopped_by = "ran out of simulated turns";
  }

  console.log(
    `  ${label.padEnd(24)}  turns=${String(run.turns).padStart(5)}  tokens=${run.tokens.toLocaleString("en-US").padStart(8)}  ` +
      `dollars=$${run.dollars.toFixed(2).padStart(7)}  stopped_by=${run.stopped_by}`,
  );
  return run;
}

function main(): void {
  console.log("=".repeat(85));
  console.log("LAYERED COST GOVERNORS (Phase 15, Lesson 13)");
  console.log("=".repeat(85));
  console.log();
  console.log("Agent enters a polling loop at turn 30.");
  console.log("-".repeat(85));

  let g = new Governor({
    enable_request_cap: false,
    enable_iter_cap: false,
    enable_velocity: false,
    enable_session_cap: false,
    enable_monthly_cap: false,
  });
  g.max_turns = 10_000;
  g.enable_iter_cap = true;
  simulate(g, "no caps (iter 10k sim)");

  g = new Governor({
    enable_request_cap: false,
    enable_iter_cap: false,
    enable_velocity: false,
    enable_session_cap: false,
    enable_monthly_cap: true,
  });
  simulate(g, "monthly cap only");

  g = new Governor();
  simulate(g, "layered stack");

  console.log();
  console.log("=".repeat(85));
  console.log("HEADLINE: caps must layer, because failure modes differ by time scale");
  console.log("-".repeat(85));
  console.log("  Monthly cap fires too late: it does not trip within 10k simulated turns.");
  console.log("  Velocity limit ($0.03/min rolling) catches a loop within minutes.");
  console.log("  Iteration cap prevents any single run from exceeding N turns.");
  console.log("  Per-request cap prevents any one completion from being unbounded.");
  console.log("  Session dollar cap (max_budget_usd) closes the seatbelt on cost.");
  console.log("  Each layer covers a different failure (loop, leak, surge, release).");
}

main();

export {};
