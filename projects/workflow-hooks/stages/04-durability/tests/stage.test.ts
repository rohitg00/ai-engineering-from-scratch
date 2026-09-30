import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const r = {
  key: "k",
  scope: "repo",
  text: "run tests",
  sourceIds: ["a"],
  sessions: ["s"],
  state: "candidate",
};
async function dir() {
  return fs.mkdtemp(path.join(os.tmpdir(), "hooks-"));
}
test("round trip", async () => {
  const d = await dir();
  try {
    await m.save(path.join(d, "r.json"), [r]);
    assert.deepEqual(await m.load(path.join(d, "r.json")), [r]);
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
});
test("missing store empty", async () =>
  assert.deepEqual(
    await m.load(path.join(os.tmpdir(), crypto.randomUUID())),
    [],
  ));
test("corrupt store fails", async () => {
  const d = await dir();
  try {
    const f = path.join(d, "r");
    await fs.writeFile(f, "bad");
    await assert.rejects(() => m.load(f));
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
});
test("unsupported version fails", async () => {
  const d = await dir();
  try {
    const f = path.join(d, "r");
    await fs.writeFile(f, '{"version":2,"rules":[]}');
    await assert.rejects(() => m.load(f));
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
});
test("overwrite leaves no temp files", async () => {
  const d = await dir();
  try {
    const f = path.join(d, "r");
    await m.save(f, [r]);
    await m.save(f, []);
    assert.deepEqual(await fs.readdir(d), ["r"]);
    assert.deepEqual(await m.load(f), []);
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
});
