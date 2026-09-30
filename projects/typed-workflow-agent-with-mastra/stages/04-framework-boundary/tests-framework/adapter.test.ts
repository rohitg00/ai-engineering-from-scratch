import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";

const workspace = process.env.PROJECT_WORKSPACE;
assert.ok(
  workspace,
  "PROJECT_WORKSPACE must identify the learner implementation",
);
const { createTicketWorkflow, persistentWorkflow } = await import(
  pathToFileURL(path.join(workspace, "optional-mastra/adapter.ts")).href
);
const { runTicket } = await import(
  pathToFileURL(path.join(workspace, "main.ts")).href
);
const ticket = { id: "T-1", message: "Find billing policy" };
const fake = async () => "Refunds require a receipt.";

test("real Mastra run returns the same business result as the scratch runtime", async () => {
  const run = await createTicketWorkflow(fake).createRun();
  const actual = await run.start({ inputData: ticket });
  const expected = {
    ticketId: "T-1",
    answer: "Refunds require a receipt.",
    calls: 1,
  };
  assert.equal(actual.status, "success");
  assert.deepEqual(actual.result, expected);
  assert.deepEqual((await runTicket(ticket, fake)).result, expected);
});

test("invalid input fails the workflow before invoking a tool", async () => {
  let calls = 0;
  const run = await createTicketWorkflow(async () => {
    calls++;
    return "unexpected";
  }).createRun();
  const status = await run.start({ inputData: { id: "", message: "" } }).then(
    (result: { status: string }) => result.status,
    () => "rejected",
  );
  assert.notEqual(status, "success");
  assert.equal(calls, 0);
});

test("a write without approval suspends without side effects", async () => {
  let calls = 0;
  const run = await createTicketWorkflow(async () => {
    calls++;
    return "unexpected";
  }).createRun();
  const result = await run.start({
    inputData: { id: "T-2", message: "update billing address" },
  });
  assert.equal(result.status, "suspended");
  assert.equal(calls, 0);
});

test("an approved write invokes the selected tool with its original query", async () => {
  const calls: { name: string; query: string }[] = [];
  const run = await createTicketWorkflow(
    async (name: string, query: string) => {
      calls.push({ name, query });
      return "updated";
    },
    true,
  ).createRun();
  const result = await run.start({
    inputData: { id: "T-3", message: "update billing address" },
  });
  assert.equal(result.status, "success");
  assert.deepEqual(calls, [
    { name: "update", query: "update billing address" },
  ]);
  assert.deepEqual(result.result, {
    ticketId: "T-3",
    answer: "updated",
    calls: 1,
  });
});

test("empty tool output exhausts two attempts and fails the workflow", async () => {
  let calls = 0;
  const run = await createTicketWorkflow(async () => {
    calls++;
    return "";
  }).createRun();
  assert.equal((await run.start({ inputData: ticket })).status, "failed");
  assert.equal(calls, 2);
});

test("resume requires approval for the exact suspended plan", async () => {
  let calls = 0;
  const run = await createTicketWorkflow(async () => {
    calls++;
    return "updated";
  }).createRun();
  const paused = await run.start({
    inputData: { id: "bound", message: "update workshop label" },
  });
  const proof = paused.steps.execute.suspendPayload;
  const result = await run.resume({
    step: "execute",
    resumeData: { approved: true, ticketId: proof.ticketId, planHash: "wrong" },
  });
  assert.equal(result.status, "failed");
  assert.equal(calls, 0);
});
test("withheld approval leaves the real framework run suspended", async () => {
  let calls = 0;
  const run = await createTicketWorkflow(async () => {
    calls++;
    return "updated";
  }).createRun();
  const paused = await run.start({
    inputData: { id: "pending", message: "update workshop label" },
  });
  const proof = paused.steps.execute.suspendPayload;
  const again = await run.resume({
    step: "execute",
    resumeData: {
      approved: false,
      ticketId: proof.ticketId,
      planHash: proof.planHash,
    },
  });
  assert.equal(again.status, "suspended");
  assert.equal(calls, 0);
});
test("correct approval resumes once with the original query", async () => {
  const calls = [];
  const run = await createTicketWorkflow(async (name, query) => {
    calls.push({ name, query });
    return "updated";
  }).createRun();
  const paused = await run.start({
    inputData: { id: "resume", message: "update workshop label" },
  });
  const proof = paused.steps.execute.suspendPayload;
  const result = await run.resume({
    step: "execute",
    resumeData: {
      approved: true,
      ticketId: proof.ticketId,
      planHash: proof.planHash,
    },
  });
  assert.equal(result.status, "success");
  assert.deepEqual(calls, [{ name: "update", query: "update workshop label" }]);
  assert.equal(result.result.ticketId, "resume");
});
test("a new workflow instance recovers approval state from local SQLite", async () => {
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const dir = mkdtempSync(path.join(tmpdir(), "mastra-recovery-test-"));
  const calls = [];
  let first, second;
  try {
    first = await persistentWorkflow(
      async (name, query) => {
        calls.push({ name, query });
        return "updated";
      },
      "file:" + path.join(dir, "runs.db"),
    );
    const run = await first.workflow.createRun();
    const paused = await run.start({
      inputData: { id: "stored", message: "update account label" },
    });
    const proof = paused.steps.execute.suspendPayload;
    assert.equal(calls.length, 0);
    await first.storage.close();
    first = null;
    second = await persistentWorkflow(
      async (name, query) => {
        calls.push({ name, query });
        return "updated";
      },
      "file:" + path.join(dir, "runs.db"),
    );
    const recovered = await second.workflow.createRun({ runId: run.runId });
    const result = await recovered.resume({
      step: "execute",
      resumeData: {
        approved: true,
        ticketId: proof.ticketId,
        planHash: proof.planHash,
      },
    });
    assert.equal(result.status, "success");
    assert.deepEqual(calls, [
      { name: "update", query: "update account label" },
    ]);
  } finally {
    if (first) await first.storage.close();
    if (second) await second.storage.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
