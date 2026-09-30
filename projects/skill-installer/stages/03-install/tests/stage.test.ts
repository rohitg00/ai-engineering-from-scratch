import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const b = {
  name: "review",
  description: "Review",
  files: { "SKILL.md": "# Review", "references/a.md": "A" },
};
async function run(fn: any) {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "installer-"));
  try {
    await fn(d);
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
}
test("installs body and references", async () =>
  run(async (d: string) => {
    const r = await m.install(d, b, "codex", m.digest(b.files));
    assert.equal(
      await fs.readFile(path.join(r.destination, "references/a.md"), "utf8"),
      "A",
    );
  }));
test("wrong digest rejected", async () =>
  run(async (d: string) => {
    await assert.rejects(() => m.install(d, b, "codex", "wrong"), /integrity/);
    assert.deepEqual(await fs.readdir(d), []);
  }));
test("claude destination", async () =>
  run(async (d: string) =>
    assert.match(
      (await m.install(d, b, "claude", m.digest(b.files))).destination,
      /\.claude\/skills\/review$/,
    ),
  ));
test("cursor destination", async () =>
  run(async (d: string) =>
    assert.match(
      (await m.install(d, b, "cursor", m.digest(b.files))).destination,
      /\.cursor\/skills\/review$/,
    ),
  ));
test("symlink parent rejected", async () =>
  run(async (d: string) => {
    await fs.symlink(os.tmpdir(), path.join(d, ".agents"));
    await assert.rejects(
      () => m.install(d, b, "codex", m.digest(b.files)),
      /unsafe/,
    );
  }));
