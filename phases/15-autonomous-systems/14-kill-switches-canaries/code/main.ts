// Lesson: Kill Switches, Circuit Breakers, and Canary Tokens (phase 15 / lesson 14)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/14-kill-switches-canaries/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/14-kill-switches-canaries/code/main.ts

const EXTERNAL_KILL_SWITCH: { enabled: boolean } = { enabled: false };

const CANARY_FILES: Record<string, string> = {
  "~/.env.canary": ["AWS_SECRET_ACCESS_KEY", "canary-xxxxxxxxxxxxxxxx"].join("="),
  "~/notes/fake-credentials.txt": ["token", "=", "'canary-sk-ABC-NEVER-USE'"].join(" "),
};

function pyBool(b: boolean): string {
  return b ? "True" : "False";
}

function pyStr(s: string): string {
  if (s.includes("'") && !s.includes('"')) {
    return `"${s}"`;
  }
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

class CircuitBreaker {
  state = "closed";
  tripped: string | null = null;
  recent: string[] = [];

  constructor(public threshold: number = 5) {}

  record(actionKey: string): boolean {
    if (this.state === "open" && actionKey === this.tripped) {
      return false;
    }
    this.recent.push(actionKey);
    if (this.recent.length >= this.threshold) {
      const tail = this.recent.slice(-this.threshold);
      if (tail.every((a) => a === tail[0])) {
        this.state = "open";
        this.tripped = actionKey;
        return false;
      }
    }
    return true;
  }
}

class Canary {
  triggered: [number, string][] = [];

  checkRead(turn: number, path: string): boolean {
    if (Object.prototype.hasOwnProperty.call(CANARY_FILES, path)) {
      this.triggered.push([turn, path]);
      return true;
    }
    return false;
  }
}

class Action {
  constructor(
    public kind: string,
    public payload: string,
  ) {}
}

function runTrajectory(traj: Action[], killSwitch: { enabled: boolean }): void {
  const breaker = new CircuitBreaker(5);
  const canary = new Canary();
  let killFired = false;
  let breakerFired = false;

  for (let idx = 0; idx < traj.length; idx++) {
    const i = idx + 1;
    const a = traj[idx];
    const n = String(i).padStart(2);
    if (killSwitch.enabled) {
      console.log(`  ${n}. [KILL SWITCH engaged] refusing action ${a.kind}:${a.payload}`);
      killFired = true;
      break;
    }

    const allowed = breaker.record(`${a.kind}:${a.payload}`);
    if (!allowed) {
      console.log(`  ${n}. [CIRCUIT BREAKER open] ${a.kind}:${a.payload}  reason=5x identical calls`);
      breakerFired = true;
      continue;
    }

    if (a.kind === "read") {
      const hit = canary.checkRead(i, a.payload);
      if (hit) {
        console.log(`  ${n}. [CANARY TRIPPED] read of ${pyStr(a.payload)}  -> alert fired`);
        continue;
      }
    }

    console.log(`  ${n}. ok  ${a.kind}:${a.payload}`);
  }

  console.log(
    `  summary: kill_fired=${pyBool(killFired)}  breaker_fired=${pyBool(breakerFired)}  ` +
      `canary_hits=${canary.triggered.length}`,
  );
}

function main(): void {
  console.log("=".repeat(80));
  console.log("TRIPWIRES: KILL SWITCH, CIRCUIT BREAKER, CANARY (Phase 15, Lesson 14)");
  console.log("=".repeat(80));

  const traj = [
    new Action("tool", "read:src/app.py"),
    new Action("tool", "edit:src/app.py"),
    new Action("tool", "read:logs/app.log"),
    new Action("tool", "read:logs/app.log"),
    new Action("tool", "read:logs/app.log"),
    new Action("tool", "read:logs/app.log"),
    new Action("tool", "read:logs/app.log"),
    new Action("read", "~/notes/checklist.md"),
    new Action("read", "~/.env.canary"),
  ];

  console.log("\nKill switch OFF");
  console.log("-".repeat(80));
  runTrajectory(traj, EXTERNAL_KILL_SWITCH);

  console.log("\nKill switch ON (operator flipped it externally)");
  console.log("-".repeat(80));
  EXTERNAL_KILL_SWITCH.enabled = true;
  runTrajectory(traj, EXTERNAL_KILL_SWITCH);
  EXTERNAL_KILL_SWITCH.enabled = false;

  console.log();
  console.log("=".repeat(80));
  console.log("HEADLINE: three detectors, three different failure classes");
  console.log("-".repeat(80));
  console.log("  Kill switch stops the whole agent on operator action.");
  console.log("  Circuit breaker pauses a specific pattern, not the whole agent.");
  console.log("  Canary tokens detect intent without requiring detection of content.");
  console.log("  None of these catches a semantic composite attack (see Lesson 10).");
  console.log("  Hard constitutional limits complete the defense (Lesson 17).");
}

main();

export {};
