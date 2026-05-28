// Capstone 19/01: terminal-native coding agent harness (multi-file TypeScript).
//
// Sources:
//   この lesson の docs/en.md (2026年版8 hook を備えた Bun + Ink TUI harness)
//   Claude Code docs            https://docs.anthropic.com/en/docs/claude-code
//   Model Context Protocol      https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/
//   OpenTelemetry GenAI semconv https://opentelemetry.io/docs/specs/semconv/gen-ai/
//
// capstone の harness 側: REPL command parser (repl.ts)、read_file/run_shell を持つ
// tool dispatcher (tools.ts)、scripted offline model (model.ts)、eight-event hook bus
// (hooks.ts)、毎 turn 全体を書き換える plan state (plan.ts)、小さな pass/fail eval
// counter (eval.ts)。non-interactive path は exit 前に eval 通過を assert するため、
// binary は self-validating です。

import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { runAgent } from "./harness.ts";
import { runEval } from "./eval.ts";
import { isInteractive, repl } from "./repl.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main(): Promise<void> {
  const sandbox = path.resolve(__dirname, "..");
  if (isInteractive()) {
    await repl(sandbox);
    return;
  }
  const task = "network call なしで plan-act-observe loop をデモする";
  const result = runAgent(task, sandbox);
  console.log(result.plan);
  console.log("---");
  console.log(
    `turns=${result.budget.turnsUsed} tokens=${result.budget.tokensUsed} ` +
      `dollars=$${result.budget.dollarsUsed.toFixed(3)}`,
  );
  console.log("---");
  console.log(`trace event 数: ${result.trace.length}`);
  for (const ev of result.trace) console.log(" ", JSON.stringify(ev));
  console.log("---");
  const e = runEval(sandbox);
  console.log(`eval: passed=${e.passed} failed=${e.failed}`);
  if (e.passed !== 3 || e.failed !== 0) {
    throw new Error(`eval regression: passed=${e.passed} failed=${e.failed}`);
  }
  if (!result.passed) {
    throw new Error("scripted demo run が all-done plan に収束しませんでした");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
