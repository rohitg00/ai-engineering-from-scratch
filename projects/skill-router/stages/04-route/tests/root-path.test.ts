import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href);

test("root test file routes through the built-in test skill", () => {
  const result = m.route(m.catalog, "", ["main.test.ts"], ["read"]);
  assert.equal(result.status, "ready");
  assert.deepEqual(result.plan, ["tests"]);
  assert.equal(result.ranked[0].score, 3);
  assert.deepEqual(result.ranked[0].reasons, ["path:main.test.ts"]);
});
