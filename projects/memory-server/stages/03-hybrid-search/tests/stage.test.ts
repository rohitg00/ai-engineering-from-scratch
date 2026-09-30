import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("identical vectors score one", () =>
  assert.equal(m.cosineScores([1, 0], [[1, 0]])[0], 1));
test("orthogonal vectors score zero", () =>
  assert.equal(m.cosineScores([1, 0], [[0, 1]])[0], 0));
test("zero norm safe", () =>
  assert.equal(m.cosineScores([0, 0], [[1, 0]])[0], 0));
test("dimension mismatch rejected", () =>
  assert.throws(() => m.cosineScores([1, 0], [[1]]), /vectors/));
test("NaN rejected", () =>
  assert.throws(() => m.cosineScores([NaN], [[1]]), /vectors/));
test("search retains source and ranks relevant first", async () => {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "hybrid-"));
  try {
    const s = new m.MemoryStore(path.join(d, "log"));
    await s.put({
      id: "a",
      namespace: "n",
      text: "memory search",
      source: "a:1",
    });
    await s.put({
      id: "b",
      namespace: "n",
      text: "orange bicycle",
      source: "b:1",
    });
    const found = await s.search("n", "memory search");
    assert.equal(found[0].id, "a");
    assert.equal(found[0].source, "a:1");
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
});
