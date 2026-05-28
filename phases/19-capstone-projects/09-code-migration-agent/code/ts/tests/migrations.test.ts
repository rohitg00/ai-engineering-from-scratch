import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  advanceFile,
  defaultSeed,
  fileDiff,
  migrationDone,
  rolledUpStats,
  tickOne,
} from "../src/migrations.js";

test("seed は running migration を3つ生成する", () => {
  const migrations = defaultSeed();
  assert.equal(migrations.length, 3);
  for (const m of migrations) {
    assert.equal(m.state, "running");
    assert.ok(m.files.length > 0);
  }
});

test("advanceFile は queued から rewriting、building、passed へ進める", () => {
  const f = fileDiff("foo.java", "openrewrite");
  const noFail = () => 0.99;
  advanceFile(f, noFail);
  assert.equal(f.status, "rewriting");
  advanceFile(f, noFail);
  assert.equal(f.status, "building");
  advanceFile(f, noFail);
  assert.equal(f.status, "passed");
});

test("advanceFile は terminal state では no-op", () => {
  const f = fileDiff("foo.java", "openrewrite");
  f.status = "passed";
  advanceFile(f);
  assert.equal(f.status, "passed");
  f.status = "failed";
  advanceFile(f);
  assert.equal(f.status, "failed");
});

test("tickOne は全 file が pass すると migration を passed に進められる", () => {
  const m = defaultSeed()[0]!;
  const det = () => 0.99;
  for (let i = 0; i < 200; i++) tickOne(m, det);
  assert.equal(migrationDone(m), true);
  assert.ok(m.state === "passed" || m.state === "failed");
});

test("rolledUpStats は state を正しく count する", () => {
  const m = defaultSeed();
  m[0]!.state = "passed";
  m[1]!.state = "failed";
  const stats = rolledUpStats(m);
  assert.equal(stats.passed, 1);
  assert.equal(stats.failed, 1);
  assert.equal(stats.running, 1);
  assert.equal(stats.total, 3);
});
