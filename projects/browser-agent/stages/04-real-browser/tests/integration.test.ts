import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
const W = process.env.PROJECT_WORKSPACE!;
const m = await import(pathToFileURL(path.join(W, "main.ts")).href);
function cli(args: string[], cwd: string) {
  return execFileSync(
    process.execPath,
    ["--experimental-strip-types", path.join(W, "cli.ts"), ...args],
    { cwd, encoding: "utf8" },
  );
}
function temporary(fn: (dir: string) => void) {
  const d = mkdtempSync(path.join(tmpdir(), "learning-integration-"));
  try {
    fn(d);
  } finally {
    rmSync(d, { recursive: true, force: true });
  }
}

const task = {
  name: "Mira",
  email: "mira@example.test",
  allowedOrigin: "http://127.0.0.1:8877",
};
test("DOM completion cannot hide wrong values", async () => {
  const d = new m.FixtureDriver(path.join(W, "success.png"));
  d.observation.done = true;
  assert.equal((await m.runAgent(d, task)).status, "blocked");
});
test("custom field labels use exact matches", () => {
  const d = new m.FixtureDriver("unused");
  d.observation.fields[0].label = "Full name confirmation";
  assert.equal(m.choose(d.observation, task).kind, "blocked");
});
test("duplicate requested fields reject before mutation", () => {
  const d = new m.FixtureDriver("unused");
  assert.equal(
    m.choose(d.observation, {
      ...task,
      fields: [
        { label: "Email address", value: "a" },
        { label: "email address", value: "b" },
      ],
    }).kind,
    "blocked",
  );
});
test("task-file CLI actually uses supplied identity", () =>
  temporary((d) => {
    const r = JSON.parse(
      cli(
        [
          "--task",
          path.join(W, "samples/contact.json"),
          "--output",
          path.join(d, "run.json"),
        ],
        d,
      ),
    );
    assert.equal(r.trace[0].action.value, "Mira Chen");
    assert.equal(r.status, "complete");
  }));
test("second fixture skips already-complete field", () =>
  temporary((d) => {
    const r = JSON.parse(
      cli(
        [
          "--task",
          path.join(W, "samples/accessibility.json"),
          "--output",
          path.join(d, "run.json"),
        ],
        d,
      ),
    );
    assert.equal(r.trace[0].action.id, "email");
  }));
