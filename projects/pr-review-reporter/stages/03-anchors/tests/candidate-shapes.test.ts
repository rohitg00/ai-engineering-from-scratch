import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href);
const line = { file: "a.ts", line: 1, text: "eval(x)" };
const valid = { ...line, quote: "eval(x)", rule: "eval", severity: "high", message: "Inspect this call" };

test("malformed candidates stay rejected while valid neighbors survive", () => {
  const malformed = [null, [], 1, "text", ...["file", "quote", "rule", "message"].map((key) => ({ ...valid, [key]: 1 })),
    { ...valid, rule: {} }, { ...valid, message: "  " }, { ...valid, rule: "\t" },
    { ...valid, line: "1" }, { ...valid, line: 1.5 }, { ...valid, line: 0 }];
  const checked = m.verify([malformed[0], valid, ...malformed.slice(1)], [line]);
  assert.deepEqual(checked.accepted, [valid]);
  assert.deepEqual(checked.rejected, malformed);
});

test("outer candidates container must be an array", () => {
  for (const value of [null, {}, "[]"])
    assert.throws(() => m.verify(value, [line]), /candidates must be an array/);
});
