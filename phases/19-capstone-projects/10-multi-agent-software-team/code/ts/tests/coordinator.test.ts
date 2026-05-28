import { strict as assert } from "node:assert";
import { test } from "node:test";
import { Agent, CoderAgent, PlannerAgent, ReviewerAgent } from "../src/agent.js";
import { Coordinator } from "../src/coordinator.js";
import type { Message, Role } from "../src/types.js";

test("coordinator rotation はすべての role を cycle する", () => {
  const c = new Coordinator();
  const first = c.rotation();
  assert.equal(first.length, 3);
  assert.equal(new Set(first).size, 3);
});

test("coordinator rotation は tick 後に変わる", () => {
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

test("issue は 12 turn 以内に approved になる", () => {
  const c = new Coordinator();
  const result = c.run({
    from: "user",
    to: "planner",
    topic: "issue.opened",
    body: "edge rounding case で refund amount が 1 cent ずれる",
    ts: 0,
  });
  assert.equal(result.approved, true);
  assert.ok(result.turns <= 12);
});

test("approval message は log に残る", () => {
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

test("workspace は plan と refund file を含む", () => {
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

test("rotation は custom agent set でもすべての role を訪問する", () => {
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

test("PlannerAgent、CoderAgent、ReviewerAgent は role を expose する", () => {
  assert.equal(new PlannerAgent().role, "planner");
  assert.equal(new CoderAgent().role, "coder");
  assert.equal(new ReviewerAgent().role, "reviewer");
});
