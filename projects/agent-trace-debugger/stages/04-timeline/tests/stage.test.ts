import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const a = { id: "a", name: "tool", start: 0, end: 10, status: "ok", tokens: 2 };
test("title present", () => assert.match(m.render([a]), /<title>Agent trace/));
test("token summary visible", () => assert.match(m.render([a]), /2 tokens/));
test("own timing visible", () => assert.match(m.render([a]), /10 ms own/));
test("error class visible", () =>
  assert.match(m.render([{ ...a, status: "error" }]), /class="bar error"/));
test("injection escaped", () =>
  assert.ok(
    !m.render([{ ...a, name: "<script>bad</script>" }]).includes("<script>"),
  ));
test("empty trace renderable", () => assert.match(m.render([]), /0 tokens/));
