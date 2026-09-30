import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const valid = {
  id: "lint",
  description: "Lint code",
  keywords: ["lint"],
  paths: [],
  priority: 1,
  requires: [],
  permissions: [],
};
test("parse valid skill", () =>
  assert.equal(m.parseSkill(JSON.stringify(valid)).id, "lint"));
test("reject missing arrays", () =>
  assert.throws(() => m.parseSkill('{"id":"lint","description":"x"}')));
test("reject unsafe id", () =>
  assert.throws(() => m.parseSkill(JSON.stringify({ ...valid, id: "../x" }))));
test("deduplicate tokens", () =>
  assert.deepEqual(m.tokens("Test TEST!"), ["test"]));
test("empty tokens", () => assert.deepEqual(m.tokens("..."), []));
test("non-string keyword rejected", () =>
  assert.throws(() =>
    m.parseSkill(JSON.stringify({ ...valid, keywords: [4] })),
  ));
