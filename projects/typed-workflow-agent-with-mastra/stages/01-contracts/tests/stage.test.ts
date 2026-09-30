import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("valid ticket trimmed", () =>
  assert.deepEqual(m.parseTicket({ id: " T1 ", message: " hello " }), {
    id: "T1",
    message: "hello",
  }));
test("missing message rejected", () =>
  assert.throws(() => m.parseTicket({ id: "T1" })));
test("oversized message rejected", () =>
  assert.throws(() => m.parseTicket({ id: "T", message: "x".repeat(10001) })));
test("read intent", () =>
  assert.equal(
    m.classify({ id: "T", message: "find billing policy" }).intent,
    "read",
  ));
test("write intent", () =>
  assert.equal(
    m.classify({ id: "T", message: "update account name" }).intent,
    "write",
  ));
test("topic separated from intent", () =>
  assert.equal(
    m.classify({ id: "T", message: "find account policy" }).topic,
    "account",
  ));
