/**
 * Code Migration Agent: dashboard skeleton entry point (TypeScript).
 *
 * docs/en.md の dashboard layer に対応します。agent は sandbox 内で走り、
 * この server は operator 向けに progress を render します。Hono routes は
 * HTML root、/migrations、/migrations/:id を serve します。state machine は
 * migrations.ts、budget + cost は cost.ts、type は types.ts です。
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
  console.log("[dashboard] agent progress の 40 ticks を simulate します...");
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
      "[dashboard] HTTP dashboard を PORT (default 8009) で起動するには SERVE=1 を設定してください",
    );
  }
}

main();
