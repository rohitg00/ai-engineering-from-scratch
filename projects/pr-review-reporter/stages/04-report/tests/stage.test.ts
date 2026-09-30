import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

test("escape script", () =>
  assert.equal(m.escapeHTML("<script>"), "&lt;script&gt;"));
test("escape quotes", () => assert.equal(m.escapeHTML("\"'"), "&quot;&#39;"));
test("empty report", () => assert.match(m.render([]), /0 findings/));
test("rejected count visible", () =>
  assert.match(m.render([], 3), /3 rejected/));
test("untrusted message escaped", () =>
  assert.ok(
    !m
      .render([
        {
          file: "x",
          line: 1,
          severity: "low",
          message: "<img onerror=x>",
          quote: "x",
          rule: "r",
        },
      ])
      .includes("<img"),
  ));
test("location visible", () =>
  assert.match(
    m.render([
      {
        file: "src/a.ts",
        line: 4,
        severity: "low",
        message: "m",
        quote: "x",
        rule: "r",
      },
    ]),
    /src\/a.ts:4/,
  ));
