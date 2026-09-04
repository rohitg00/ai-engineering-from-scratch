/**
 * Code Migration Agent: dashboard skeleton entry point (TypeScript).
 *
 * Mirrors the dashboard layer from docs/en.md: agent runs in a sandbox; this
 * server renders progress for the operator. Hono routes serve HTML root,
 * /migrations, and /migrations/:id. State machine in migrations.ts; budget
 * + cost in cost.ts; types in types.ts.
 *
 * Source: phases/19-capstone-projects/09-code-migration-agent/docs/en.md
 * Recipe specs: https://docs.openrewrite.org and the libcst Python parser.
 */

import { serve } from "@hono/node-server";
import { buildApp } from "./server.js";
import { defaultSeed, rolledUpStats, tickAll } from "./migrations.js";

function summarise(migrations: ReturnType<typeof defaultSeed>): void {
  const stats = rolledUpStats(migrations);
  console.log("[dashboard] migrations seeded:", migrations.length);
  for (const m of migrations) {
    const passed = m.files.filter((f) => f.status === "passed").length;
    console.log(
      `[dashboard] ${m.repo} ${m.sourceRuntime}->${m.targetRuntime} ` +
        `state=${m.state} files=${passed}/${m.files.length} ` +
        `turns=${m.turns}/${m.maxTurns} cost=$${m.spentUsd.toFixed(2)}`,
    );
  }
  console.log("[dashboard] roll-up:", stats);
}

export function runDemoTicks(rounds: number): ReturnType<typeof defaultSeed> {
  const migrations = defaultSeed();
  for (let i = 0; i < rounds; i++) tickAll(migrations);
  return migrations;
}

function main(): void {
  console.log("[dashboard] simulating 40 ticks of agent progress...");
  const migrations = runDemoTicks(40);
  summarise(migrations);
  if (process.env["SERVE"] === "1") {
    const port = Number(process.env["PORT"] ?? 8009);
    const app = buildApp(migrations);
    serve({ fetch: app.fetch, port }, (info) => {
      console.log(`[dashboard] serving on http://localhost:${info.port}`);
    });
    setInterval(() => tickAll(migrations), 750).unref();
  } else {
    console.log(
      "[dashboard] set SERVE=1 to start the HTTP dashboard on PORT (default 8009)",
    );
  }
}

main();
