import { randomUUID } from "node:crypto";
import { BUDGET_USD, MAX_TURNS, chargeTurn, checkBudget } from "./cost.js";
import type {
  FileDiff,
  FileStatus,
  Migration,
  Recipe,
  RolledUpStats,
} from "./types.js";

const STATE_ORDER: FileStatus[] = [
  "queued",
  "rewriting",
  "building",
  "passed",
];

export function fileDiff(
  path: string,
  recipe: Recipe,
  status: FileStatus = "queued",
): FileDiff {
  return {
    path,
    status,
    recipe,
    linesAdded: 0,
    linesRemoved: 0,
    testsTouched: 0,
  };
}

export function seedMigration(
  repo: string,
  sourceRuntime: string,
  targetRuntime: string,
  files: FileDiff[],
): Migration {
  return {
    id: randomUUID(),
    repo,
    sourceRuntime,
    targetRuntime,
    startedAt: Date.now(),
    budgetUsd: BUDGET_USD,
    spentUsd: 0,
    turns: 0,
    maxTurns: MAX_TURNS,
    files,
    state: "running",
  };
}

export function defaultSeed(): Migration[] {
  return [
    seedMigration("acme/payments-svc", "java-8", "java-17", [
      fileDiff("pom.xml", "openrewrite"),
      fileDiff("src/main/java/Payments.java", "openrewrite"),
      fileDiff("src/main/java/Refunds.java", "openrewrite"),
      fileDiff("src/test/java/PaymentsTest.java", "agent"),
    ]),
    seedMigration("acme/billing-py", "python-2.7", "python-3.12", [
      fileDiff("setup.py", "libcst"),
      fileDiff("billing/core.py", "libcst"),
      fileDiff("billing/dunning.py", "agent"),
      fileDiff("tests/test_core.py", "libcst"),
    ]),
    seedMigration("acme/checkout-svc", "java-8", "java-17", [
      fileDiff("build.gradle", "openrewrite"),
      fileDiff("src/main/java/Checkout.java", "openrewrite"),
      fileDiff("src/main/java/Discount.java", "agent"),
    ]),
  ];
}

export function advanceFile(file: FileDiff, rng: () => number = Math.random): void {
  if (file.status === "passed" || file.status === "failed") return;
  const idx = STATE_ORDER.indexOf(file.status);
  const next = STATE_ORDER[idx + 1];
  if (!next) return;
  file.status = next;
  if (next === "rewriting") {
    file.linesAdded = 4 + Math.floor(rng() * 24);
    file.linesRemoved = 1 + Math.floor(rng() * 14);
  }
  if (next === "building" && rng() < 0.15) {
    file.status = "failed";
    file.lastError =
      "compile error: cannot find symbol javax.annotation.Nullable";
  }
  if (next === "passed" && file.path.includes("test")) {
    file.testsTouched = 2 + Math.floor(rng() * 6);
  }
}

export function migrationDone(m: Migration): boolean {
  return m.files.every((f) => f.status === "passed" || f.status === "failed");
}

export function tickOne(m: Migration, rng: () => number = Math.random): void {
  if (m.state !== "running") return;
  const inFlight = m.files.find(
    (f) => f.status !== "passed" && f.status !== "failed",
  );
  if (!inFlight) {
    m.state = m.files.some((f) => f.status === "failed") ? "failed" : "passed";
    return;
  }
  advanceFile(inFlight, rng);
  chargeTurn(m, rng);
  const verdict = checkBudget(m);
  if (verdict.exhausted) {
    m.state = "failed";
    return;
  }
  if (migrationDone(m)) {
    m.state = m.files.some((f) => f.status === "failed") ? "failed" : "passed";
  }
}

export function tickAll(migrations: Migration[], rng: () => number = Math.random): void {
  for (const m of migrations) {
    tickOne(m, rng);
  }
}

export function rolledUpStats(migrations: Migration[]): RolledUpStats {
  let running = 0;
  let passed = 0;
  let failed = 0;
  let spent = 0;
  for (const m of migrations) {
    if (m.state === "running") running++;
    if (m.state === "passed") passed++;
    if (m.state === "failed") failed++;
    spent += m.spentUsd;
  }
  return {
    total: migrations.length,
    running,
    passed,
    failed,
    spentUsd: Number(spent.toFixed(3)),
  };
}
