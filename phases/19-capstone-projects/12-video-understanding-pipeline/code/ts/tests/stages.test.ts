import { test } from "node:test";
import { strict as assert } from "node:assert";
import { JobStore, seedFixture } from "../src/jobs.js";
import { advanceJob, overallStatus } from "../src/stages.js";
import type { Job } from "../src/types.js";
import { STAGE_DURATIONS_MS, STAGES } from "../src/types.js";

function freshJob(createdAt: number): Job {
  const store = new JobStore();
  return store.create("t-1", "vid", "q", createdAt);
}

test("作成直後は pending", () => {
  const created = 1_000_000_000_000;
  const job = freshJob(created);
  advanceJob(job, created);
  assert.equal(overallStatus(job), "pending");
  assert.ok(job.stages.every((s) => s.status === "pending"));
});

test("first stage の進行中は running", () => {
  const created = 1_000_000_000_000;
  const job = freshJob(created);
  advanceJob(job, created + 600);
  const first = job.stages[0];
  assert.ok(first);
  assert.equal(first.status, "running");
  assert.equal(overallStatus(job), "running");
});

test("total elapsed が duration 合計を超えると done", () => {
  const created = 1_000_000_000_000;
  const job = freshJob(created);
  const total = STAGES.reduce((acc, s) => acc + STAGE_DURATIONS_MS[s], 0);
  advanceJob(job, created + total + 1);
  assert.equal(overallStatus(job), "done");
  assert.ok(job.stages.every((s) => s.status === "done"));
});

test("seedFixture は store に 3 job を投入する", () => {
  const store = new JobStore();
  seedFixture(store);
  assert.equal(store.list().length, 3);
  const detail = store.detail("job-001");
  assert.ok(detail);
  assert.equal(detail.id, "job-001");
});

test("unknown id の detail は null を返す", () => {
  const store = new JobStore();
  seedFixture(store);
  assert.equal(store.detail("missing"), null);
});
