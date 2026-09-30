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
  files: { "SKILL.md": "# Review" },
};
async function run(fn: any) {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "upgrade-"));
  try {
    await fn(d);
  } finally {
    await fs.rm(d, { recursive: true, force: true });
  }
}
test("repeat install succeeds", async () =>
  run(async (d: string) => {
    await m.install(d, b, "codex", m.digest(b.files));
    await m.install(d, b, "codex", m.digest(b.files));
    assert.deepEqual(await fs.readdir(path.join(d, ".agents/skills")), [
      "review",
    ]);
  }));
test("upgrade replaces managed content", async () =>
  run(async (d: string) => {
    await m.install(d, b, "codex", m.digest(b.files));
    const next = { ...b, files: { "SKILL.md": "# New" } };
    const r = await m.install(d, next, "codex", m.digest(next.files));
    assert.match(
      await fs.readFile(path.join(r.destination, "SKILL.md"), "utf8"),
      /# New/,
    );
  }));
test("user edit preserved", async () =>
  run(async (d: string) => {
    const r = await m.install(d, b, "codex", m.digest(b.files));
    const f = path.join(r.destination, "SKILL.md");
    await fs.writeFile(f, "my edit");
    await assert.rejects(
      () => m.install(d, b, "codex", m.digest(b.files)),
      /modified/,
    );
    assert.equal(await fs.readFile(f, "utf8"), "my edit");
  }));
test("unmanaged file preserved", async () =>
  run(async (d: string) => {
    const r = await m.install(d, b, "codex", m.digest(b.files));
    await fs.writeFile(path.join(r.destination, "mine"), "x");
    await assert.rejects(
      () => m.install(d, b, "codex", m.digest(b.files)),
      /unmanaged/,
    );
  }));
test("unmanaged directory not overwritten", async () =>
  run(async (d: string) => {
    await fs.mkdir(path.join(d, ".agents/skills/review"), { recursive: true });
    await assert.rejects(() => m.install(d, b, "codex", m.digest(b.files)));
  }));
