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

test("pending right after creation", () => {
  const created = 1_000_000_000_000;
  const job = freshJob(created);
  advanceJob(job, created);
  assert.equal(overallStatus(job), "pending");
  assert.ok(job.stages.every((s) => s.status === "pending"));
});

test("running while first stage in progress", () => {
  const created = 1_000_000_000_000;
  const job = freshJob(created);
  advanceJob(job, created + 600);
  const first = job.stages[0];
  assert.ok(first);
  assert.equal(first.status, "running");
  assert.equal(overallStatus(job), "running");
});

test("done once total elapsed exceeds sum of durations", () => {
  const created = 1_000_000_000_000;
  const job = freshJob(created);
  const total = STAGES.reduce((acc, s) => acc + STAGE_DURATIONS_MS[s], 0);
  advanceJob(job, created + total + 1);
  assert.equal(overallStatus(job), "done");
  assert.ok(job.stages.every((s) => s.status === "done"));
});

test("seedFixture populates store with three jobs", () => {
  const store = new JobStore();
  seedFixture(store);
  assert.equal(store.list().length, 3);
  const detail = store.detail("job-001");
  assert.ok(detail);
  assert.equal(detail.id, "job-001");
});

test("detail returns null for unknown id", () => {
  const store = new JobStore();
  seedFixture(store);
  assert.equal(store.detail("missing"), null);
});
