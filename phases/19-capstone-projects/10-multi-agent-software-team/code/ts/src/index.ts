/**
 * Multi-Agent Software Team: capstone skeleton entry point (TypeScript)。
 *
 * docs/en.md の role split (planner / coder / reviewer と round-robin で rotate
 * する coordinator) と worktree-launch step に対応します。production では branch ごとの
 * Daytona sandbox、ここでは denylist された shell command を拒否する execFile stub です。
 * shared workspace は in-memory です。
 *
 * Source: phases/19-capstone-projects/10-multi-agent-software-team/docs/en.md
 * Stack reference: SWE-AF factory、MetaGPT roles、AutoGen 0.4 actor graph。
 */

import { Coordinator } from "./coordinator.js";
import { launchWorktree } from "./runtime.js";

async function worktreeDemo(): Promise<void> {
  console.log("[team] worktree stub: denylist 付き execFile");
  const ok = await launchWorktree({
    branch: "feature/refund-rounding",
    command: "node",
    argv: ["-e", "console.log('coder sandbox 準備完了: ' + process.env.BRANCH)"],
  });
  console.log("  node stdout:", ok.stdout.trim());
  if (ok.stderr) console.log("  node stderr:", ok.stderr.trim());

  const refused = await launchWorktree({
    branch: "feature/refund-rounding",
    command: "rm",
    argv: ["-rf", "/"],
  });
  console.log("  rm refused:", refused.refused);

  const shellInjected = await launchWorktree({
    branch: "feature/refund-rounding",
    command: "node",
    argv: ["-e", "1", ";", "echo", "pwned"],
  });
  console.log("  injection refused:", shellInjected.refused);
}

function teamDemo(): void {
  console.log("[team] coordinator demo: issue から merged diff へ");
  const coordinator = new Coordinator();
  const result = coordinator.run({
    from: "user",
    to: "planner",
    topic: "issue.opened",
    body: "edge rounding case で refund amount が 1 cent ずれる",
    ts: Date.now(),
  });
  console.log("  approved:", result.approved, "turns:", result.turns);
  console.log("  files:");
  for (const file of coordinator.workspaceFiles()) {
    console.log(
      `    ${file.path} (writer=${file.lastWriter} rev=${file.revisions})`,
    );
  }
  console.log("  message log:");
  for (const m of coordinator.messageLog()) {
    console.log(`    ${m.from} -> ${m.to} :: ${m.topic}`);
  }
  console.log("  stats:", coordinator.stats());
}

async function main(): Promise<void> {
  teamDemo();
  console.log();
  await worktreeDemo();
}

main().catch((err) => {
  console.error("[team] fatal:", err);
  process.exit(1);
});
