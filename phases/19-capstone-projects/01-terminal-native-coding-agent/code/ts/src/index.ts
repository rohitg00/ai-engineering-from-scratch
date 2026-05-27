// Capstone 19/01: terminal-native coding agent harness (multi-file TypeScript).
//
// Sources:
//   This lesson's docs/en.md (the Bun + Ink TUI harness with eight 2026 hooks)
//   Claude Code docs            https://docs.anthropic.com/en/docs/claude-code
//   Model Context Protocol      https://blog.modelcontextprotocol.io/posts/2026-mcp-roadmap/
//   OpenTelemetry GenAI semconv https://opentelemetry.io/docs/specs/semconv/gen-ai/
//
// The harness side of the capstone: REPL command parser (repl.ts), tool dispatcher
// with read_file/run_shell (tools.ts), scripted offline model (model.ts), eight-event
// hook bus (hooks.ts), plan state rewritten whole each turn (plan.ts), and a tiny
// pass/fail eval counter (eval.ts). The non-interactive path asserts the eval
// passes before exiting, so the binary is self-validating.

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
  const task = "demonstrate the plan-act-observe loop without network calls";
  const result = runAgent(task, sandbox);
  console.log(result.plan);
  console.log("---");
  console.log(
    `turns=${result.budget.turnsUsed} tokens=${result.budget.tokensUsed} ` +
      `dollars=$${result.budget.dollarsUsed.toFixed(3)}`,
  );
  console.log("---");
  console.log(`trace events: ${result.trace.length}`);
  for (const ev of result.trace) console.log(" ", JSON.stringify(ev));
  console.log("---");
  const e = runEval(sandbox);
  console.log(`eval: passed=${e.passed} failed=${e.failed}`);
  if (e.passed !== 3 || e.failed !== 0) {
    throw new Error(`eval regression: passed=${e.passed} failed=${e.failed}`);
  }
  if (!result.passed) {
    throw new Error("scripted demo run did not converge to all-done plan");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
