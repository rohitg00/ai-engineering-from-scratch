import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("fill passes literal value as argv", async () => {
  let args: string[] = [];
  const d = new m.GstackDriver("browse", "out.png", (a: string[]) => {
    args = a;
    return "";
  });
  await d.act({ kind: "fill", id: "name", value: "$(touch /tmp/no)" });
  assert.deepEqual(args, ["fill", "#name", "$(touch /tmp/no)"]);
});
test("click targets validated id", async () => {
  let args: string[] = [];
  const d = new m.GstackDriver("browse", "out.png", (a: string[]) => {
    args = a;
    return "";
  });
  await d.act({ kind: "click", id: "save" });
  assert.deepEqual(args, ["click", "#save"]);
});
test("selector injection rejected", async () => {
  const d = new m.GstackDriver("browse", "out.png", () => {
    throw new Error("called");
  });
  await assert.rejects(
    () => d.act({ kind: "click", id: "save;script" }),
    /invalid element/,
  );
});
test("blocked action never sent", async () => {
  const d = new m.GstackDriver("browse", "out.png", () => {
    throw new Error("called");
  });
  await assert.rejects(
    () => d.act({ kind: "blocked", reason: "x" }),
    /not executable/,
  );
});
test("success rate counts only complete", () =>
  assert.deepEqual(m.scoreRuns(["complete", "blocked", "visual-mismatch"]), {
    tasks: 3,
    completed: 1,
    successRate: 1 / 3,
  }));
test("empty benchmark is zero", () =>
  assert.equal(m.scoreRuns([]).successRate, 0));
