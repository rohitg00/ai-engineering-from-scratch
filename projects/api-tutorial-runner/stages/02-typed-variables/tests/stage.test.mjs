import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("exact variable preserves numeric type", () =>
  assert.deepEqual(m.resolveValue({ id: "{{id}}" }, { id: 41 }), { id: 41 }));
test("embedded variable becomes text", () =>
  assert.equal(m.resolveValue("/loans/{{id}}", { id: 41 }), "/loans/41"));
test("nested arrays resolve without mutation", () => {
  const v = ["{{x}}", { active: "{{ok}}" }];
  assert.deepEqual(m.resolveValue(v, { x: "a", ok: true }), [
    "a",
    { active: true },
  ]);
  assert.equal(v[0], "{{x}}");
});
test("capture dotted response path", () =>
  assert.deepEqual(
    m.captureVariables(
      { loan: { id: 7 } },
      { id: { path: "loan.id", type: "number" } },
    ),
    { id: 7 },
  ));
test("heldout wrong capture type rejected", () =>
  assert.throws(
    () =>
      m.captureVariables({ id: "7" }, { id: { path: "id", type: "number" } }),
    /expected number/,
  ));
test("unknown variables and overwrites rejected", () => {
  assert.throws(() => m.resolveValue("{{missing}}", {}), /Undeclared/);
  assert.throws(
    () =>
      m.captureVariables(
        { id: 2 },
        { id: { path: "id", type: "number" } },
        { id: 1 },
      ),
    /overwrite/,
  );
});
