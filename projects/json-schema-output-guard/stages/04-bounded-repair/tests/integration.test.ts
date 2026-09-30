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

test("unused optional keyword is still rejected", () =>
  assert.throws(
    () =>
      m.validate(
        {},
        { type: "object", properties: { optional: { $ref: "#/bad" } } },
      ),
    /unsupported/,
  ));
test("empty array cannot conceal unsupported items", () =>
  assert.throws(
    () => m.validate([], { type: "array", items: { format: "uri" } }),
    /unsupported/,
  ));
test("required pointer escapes slash and tilde", () =>
  assert.equal(
    m.validate({}, { type: "object", required: ["a/b~c"] })[0].path,
    "$/a~1b~0c",
  ));
test("malformed nested schema fails explicitly", () =>
  assert.throws(() => m.validate({}, { properties: { x: null } }), /schema/));
test("recorded repair CLI creates accepted artifact", () =>
  temporary((d) => {
    const r = JSON.parse(
      cli(
        [
          "--schema",
          path.join(W, "samples/schema.json"),
          "--attempts",
          path.join(W, "samples/attempts.json"),
          "--output",
          path.join(d, "result.json"),
        ],
        d,
      ),
    );
    assert.equal(r.status, "accepted");
    assert.equal(r.trace.length, 2);
  }));

test("schema preflight prevents a wasted generator call", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      m.repair(
        async () => {
          calls++;
          return "{}";
        },
        { properties: { unused: { $ref: "#x" } } },
        2,
      ),
    /unsupported/,
  );
  assert.equal(calls, 0);
});
