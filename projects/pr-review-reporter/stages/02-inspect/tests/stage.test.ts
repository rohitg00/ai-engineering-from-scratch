import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const line = (text: string) => [{ file: "a.ts", line: 3, text }];
test("eval candidate", () =>
  assert.equal(m.inspect(line("eval(input)"))[0].rule, "dynamic-eval"));
test("shell candidate", () =>
  assert.equal(m.inspect(line("exec(command)"))[0].severity, "high"));
test("TLS candidate", () =>
  assert.equal(
    m.inspect(line("rejectUnauthorized: false"))[0].rule,
    "tls-disabled",
  ));
test("empty catch candidate", () =>
  assert.equal(m.inspect(line("work.catch(() => {})"))[0].severity, "medium"));
test("safe line ignored", () =>
  assert.deepEqual(m.inspect(line("JSON.parse(input)")), []));
test("quote preserves original source", () =>
  assert.equal(m.inspect(line("  eval(input);"))[0].quote, "  eval(input);"));
