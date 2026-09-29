import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href);

test("globstar slash includes zero directories and nested directories", () => {
  for (const [file, rule] of [
    ["main.ts", "**/*.ts"],
    ["src/main.ts", "src/**/*.ts"],
    ["src/lib/main.ts", "src/**/*.ts"],
    ["src\\lib\\main.ts", "src/**/*.ts"],
    ["src/a+b.ts", "**/a+b.ts"],
  ]) assert.equal(m.matchPath(file, rule), true, `${file} against ${rule}`);
  assert.equal(m.matchPath("src/aab.ts", "**/a+b.ts"), false);
  assert.equal(m.matchPath("src/lib/main.ts", "src/*.ts"), false);
});

test("absolute and parent-traversing paths never contribute evidence", () => {
  for (const file of ["/main.ts", "C:/main.ts", "C:\\main.ts", "\\\\server\\main.ts", "../main.ts", "src/../main.ts"])
    assert.equal(m.matchPath(file, "**"), false, file);
});
