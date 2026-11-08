import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const c = {
  services: [
    {
      id: "a",
      name: "A",
      root: "a",
      owners: ["@a"],
      runbook: "r.md",
      dependencies: ["b"],
    },
    {
      id: "b",
      name: "B",
      root: "b",
      owners: ["@b"],
      runbook: "b.md",
      dependencies: [],
    },
  ],
  rules: [],
  runbooks: { "r.md": "# Start", "b.md": "# B" },
};
test("packet has version and selected path", () => {
  const p = m.handoffPacket(c, "a/main.ts");
  assert.equal(p.schemaVersion, 1);
  assert.equal(p.ownership.path, "a/main.ts");
});
test("dependency handoff resolves owners", () =>
  assert.deepEqual(m.handoffPacket(c, "a/main.ts").dependencies, [
    { id: "b", owners: ["@b"] },
  ]));
test("runbook report is included", () =>
  assert.equal(m.handoffPacket(c, "a/main.ts").runbook.exists, true));
test("unknown path gives null runbook", () =>
  assert.equal(m.handoffPacket(c, "z/main.ts").runbook, null));
test("heldout directory text escaped", () => {
  const d = structuredClone(c);
  d.services[0].name = "<script>bad()</script>";
  assert.ok(
    !m
      .renderDirectory(d, m.handoffPacket(d, "a/main.ts"))
      .includes("<script>bad()"),
  );
});
test("packet JSON roundtrip retains citations", () =>
  assert.equal(
    JSON.parse(JSON.stringify(m.handoffPacket(c, "a/main.ts"))).ownership
      .evidence[0].source,
    "catalog.json",
  ));
