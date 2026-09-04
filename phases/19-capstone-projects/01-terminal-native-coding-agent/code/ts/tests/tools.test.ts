import { test } from "node:test";
import { strict as assert } from "node:assert";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import {
  TOOLS,
  ReadFileArgs,
  RunShellArgs,
  toolReadFile,
  toolRunShell,
} from "../src/tools.ts";

test("toolReadFile: reads inside sandbox", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "p19-01-"));
  try {
    writeFileSync(path.join(dir, "hello.txt"), "hi there", "utf8");
    const out = toolReadFile(dir, { path: "hello.txt" });
    assert.equal(out, "hi there");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("toolReadFile: rejects path traversal", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "p19-01-"));
  try {
    assert.throws(() => toolReadFile(dir, { path: "../../../etc/passwd" }), /escapes sandbox/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("toolRunShell: returns deterministic stub output", () => {
  const out = toolRunShell("/tmp", { cmd: "ls" });
  assert.match(out, /^exit=0/);
  assert.match(out, /README\.md/);
});

test("zod schemas reject empty inputs", () => {
  assert.throws(() => ReadFileArgs.parse({ path: "" }));
  assert.throws(() => RunShellArgs.parse({ cmd: "" }));
});

test("TOOLS registry exposes both functions", () => {
  assert.equal(typeof TOOLS.read_file, "function");
  assert.equal(typeof TOOLS.run_shell, "function");
});
