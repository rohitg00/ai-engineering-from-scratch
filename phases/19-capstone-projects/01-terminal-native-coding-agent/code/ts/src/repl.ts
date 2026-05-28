import * as readline from "node:readline";
import { runAgent } from "./harness.ts";
import { runEval } from "./eval.ts";

export type Command =
  | { kind: "run"; task: string }
  | { kind: "eval" }
  | { kind: "help" }
  | { kind: "quit" }
  | { kind: "unknown"; raw: string };

export function parseCommand(line: string): Command {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "help" };
  if (trimmed === "quit" || trimmed === "exit") return { kind: "quit" };
  if (trimmed === "help" || trimmed === "?") return { kind: "help" };
  if (trimmed === "eval") return { kind: "eval" };
  const m = /^run\s+(.+)$/.exec(trimmed);
  if (m) return { kind: "run", task: m[1] };
  return { kind: "unknown", raw: trimmed };
}

export function helpText(): string {
  return [
    "harness commands:",
    "  run <task>   scripted model に対して 1 task の plan/act/observe loop を実行",
    "  eval         offline eval を実行し、pass/fail 数を表示",
    "  help         この message を表示",
    "  quit         終了",
  ].join("\n");
}

export function isInteractive(): boolean {
  return process.stdin.isTTY === true && process.argv.includes("--repl");
}

export async function repl(sandbox: string): Promise<void> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  console.log(helpText());
  const ask = (prompt: string): Promise<string> =>
    new Promise((resolve) => rl.question(prompt, resolve));
  while (true) {
    const line = await ask("agent> ");
    const cmd = parseCommand(line);
    if (cmd.kind === "quit") break;
    if (cmd.kind === "help") {
      console.log(helpText());
      continue;
    }
    if (cmd.kind === "eval") {
      const e = runEval(sandbox);
      console.log(`eval: passed=${e.passed} failed=${e.failed}`);
      continue;
    }
    if (cmd.kind === "run") {
      const r = runAgent(cmd.task, sandbox);
      console.log(r.plan);
      console.log("---");
      console.log(
        `turns=${r.budget.turnsUsed} tokens=${r.budget.tokensUsed} ` +
          `dollars=$${r.budget.dollarsUsed.toFixed(3)} passed=${r.passed}`,
      );
      continue;
    }
    console.log(`unknown command: ${cmd.raw}; 'help' と入力してください`);
  }
  rl.close();
}
