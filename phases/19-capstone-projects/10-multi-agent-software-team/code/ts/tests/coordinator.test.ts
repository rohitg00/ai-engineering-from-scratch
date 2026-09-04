import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Agent, CoderAgent, PlannerAgent, ReviewerAgent } from "../src/agent.js";
import { Coordinator } from "../src/coordinator.js";
import type { Message, Role } from "../src/types.js";

test("coordinator rotation cycles through every role", () => {
  const c = new Coordinator();
  const first = c.rotation();
  assert.equal(first.length, 3);
  assert.equal(new Set(first).size, 3);
});

test("coordinator rotation differs after a tick", () => {
  const c = new Coordinator();
  const before = c.rotation().join(",");
  c.run(
    {
      from: "user",
      to: "planner",
      topic: "issue.opened",
      body: "refund bug",
      ts: 0,
    },
    1,
  );
  const after = c.rotation().join(",");
  assert.notEqual(before, after);
});

test("issue is approved within twelve turns", () => {
  const c = new Coordinator();
  const result = c.run({
    from: "user",
    to: "planner",
    topic: "issue.opened",
    body: "refund amounts off-by-one cent on edge rounding cases",
    ts: 0,
  });
  assert.equal(result.approved, true);
  assert.ok(result.turns <= 12);
});

test("approval message lives in the log", () => {
  const c = new Coordinator();
  c.run({
    from: "user",
    to: "planner",
    topic: "issue.opened",
    body: "fix",
    ts: 0,
  });
  const topics = c.messageLog().map((m) => m.topic);
  assert.ok(topics.includes("review.approved"));
});

test("workspace contains the plan and the refund file", () => {
  const c = new Coordinator();
  c.run({
    from: "user",
    to: "planner",
    topic: "issue.opened",
    body: "fix",
    ts: 0,
  });
  const files = c.workspaceFiles().map((f) => f.path);
  assert.ok(files.includes("PLAN.md"));
  assert.ok(files.includes("refunds.py"));
});

test("rotation visits all roles given a custom agent set", () => {
  class StubAgent extends Agent {
    constructor(public readonly role: Role) {
      super();
    }
    step(): Message | null {
      return null;
    }
  }
  const c = new Coordinator([
    new StubAgent("planner"),
    new StubAgent("coder"),
    new StubAgent("reviewer"),
  ]);
  const seen = new Set<Role>();
  for (let i = 0; i < 3; i++) {
    seen.add(c.rotation()[0]!);
    c.run(
      {
        from: "user",
        to: "planner",
        topic: "noop",
        body: "",
        ts: 0,
      },
      1,
    );
  }
  assert.equal(seen.size, 3);
});

test("PlannerAgent, CoderAgent, ReviewerAgent expose their roles", () => {
  assert.equal(new PlannerAgent().role, "planner");
  assert.equal(new CoderAgent().role, "coder");
  assert.equal(new ReviewerAgent().role, "reviewer");
});
