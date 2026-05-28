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

test("toolReadFile: sandbox 内を読む", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "p19-01-"));
  try {
    writeFileSync(path.join(dir, "hello.txt"), "hi there", "utf8");
    const out = toolReadFile(dir, { path: "hello.txt" });
    assert.equal(out, "hi there");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("toolReadFile: path traversal を拒否する", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "p19-01-"));
  try {
    assert.throws(() => toolReadFile(dir, { path: "../../../etc/passwd" }), /sandbox 外/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("toolRunShell: deterministic stub output を返す", () => {
  const out = toolRunShell("/tmp", { cmd: "ls" });
  assert.match(out, /^exit=0/);
  assert.match(out, /README\.md/);
});

test("zod schema は empty input を拒否する", () => {
  assert.throws(() => ReadFileArgs.parse({ path: "" }));
  assert.throws(() => RunShellArgs.parse({ cmd: "" }));
});

test("TOOLS registry は両方の function を公開する", () => {
  assert.equal(typeof TOOLS.read_file, "function");
  assert.equal(typeof TOOLS.run_shell, "function");
});
