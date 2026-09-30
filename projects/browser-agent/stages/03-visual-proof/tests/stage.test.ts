import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const root = path.join(process.env.PROJECT_ROOT!, "solution");
test("valid green fixture dimensions", () =>
  assert.equal(m.inspectPNG(path.join(root, "success.png")).width, 4));
test("green fraction one", () =>
  assert.equal(m.inspectPNG(path.join(root, "success.png")).greenFraction, 1));
test("red fixture has no success pixels", () =>
  assert.equal(m.inspectPNG(path.join(root, "failure.png")).greenFraction, 0));
test("invalid signature rejected", async () => {
  const f = path.join(os.tmpdir(), crypto.randomUUID() + ".png");
  try {
    await fs.writeFile(f, "not png");
    assert.throws(() => m.inspectPNG(f));
  } finally {
    await fs.rm(f, { force: true });
  }
});
test("CRC corruption rejected", async () => {
  const f = path.join(os.tmpdir(), crypto.randomUUID() + ".png");
  try {
    const b = await fs.readFile(path.join(root, "success.png"));
    b[20] ^= 1;
    await fs.writeFile(f, b);
    assert.throws(() => m.inspectPNG(f));
  } finally {
    await fs.rm(f, { force: true });
  }
});
test("DOM success with red pixels rejected", async () => {
  const d = new m.FixtureDriver(path.join(root, "failure.png"));
  d.observation.done = true;
  d.observation.fields[0].value = "Ada";
  d.observation.fields[1].value = "ada@example.test";
  assert.equal(
    (
      await m.runAgent(d, {
        name: "Ada",
        email: "ada@example.test",
        allowedOrigin: "http://127.0.0.1:8877",
      })
    ).status,
    "visual-mismatch",
  );
});
