import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const r = { id: "m1", namespace: "docs", text: "memory", source: "a:1" };
async function run(fn: any) {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "memory-test-"));
  try {
    await fn(path.join(d, "log"));
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
}
test("record survives reopen", async () =>
  run(async (f: string) => {
    await new m.MemoryStore(f).put(r);
    assert.equal((await new m.MemoryStore(f).list("docs"))[0].revision, 1);
  }));
test("stale revision rejected", async () =>
  run(async (f: string) => {
    const s = new m.MemoryStore(f);
    await s.put(r);
    await assert.rejects(() => s.put(r), /conflict/);
  }));
test("concurrent creates one winner", async () =>
  run(async (f: string) => {
    const s = new m.MemoryStore(f);
    const results = await Promise.allSettled([s.put(r), s.put(r)]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  }));
test("namespace isolation", async () =>
  run(async (f: string) => {
    const s = new m.MemoryStore(f);
    await s.put(r);
    assert.deepEqual(await s.list("private"), []);
  }));
test("update advances revision", async () =>
  run(async (f: string) => {
    const s = new m.MemoryStore(f);
    await s.put(r);
    assert.equal((await s.put({ ...r, text: "updated" }, 1)).revision, 2);
  }));
test("corrupt log fails closed", async () =>
  run(async (f: string) => {
    await fs.writeFile(f, "broken\n");
    await assert.rejects(() => new m.MemoryStore(f).list("docs"));
  }));
