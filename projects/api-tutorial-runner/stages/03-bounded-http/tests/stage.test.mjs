import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
import { createServer } from "node:http";
async function withServer(handler, fn) {
  const s = createServer(handler);
  await new Promise((r) => s.listen(0, "127.0.0.1", r));
  try {
    await fn("http://127.0.0.1:" + s.address().port);
  } finally {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
}
const step = (id, path = "/") => ({
  id,
  method: "GET",
  path,
  status: 200,
  assert: {},
  capture: {},
  line: 1,
});
test("real HTTP response and typed capture", async () =>
  withServer(
    (q, r) => {
      r.end('{"id":7}');
    },
    async (url) => {
      const r = await m.runTutorial(
        [{ ...step("a"), capture: { id: { path: "id", type: "number" } } }],
        url,
      );
      assert.equal(r[0].status, "pass");
      assert.equal(r[0].variables.id, 7);
    },
  ));
test("assertion failure stops later requests", async () => {
  let count = 0;
  await withServer(
    (q, r) => {
      count++;
      r.end('{"title":"new"}');
    },
    async (url) => {
      const r = await m.runTutorial(
        [{ ...step("a"), assert: { bookName: "old" } }, step("b")],
        url,
      );
      assert.equal(r[0].status, "fail");
      assert.equal(r[1].status, "skip");
    },
  );
  assert.equal(count, 1);
});
test("byte cap aborts response", async () =>
  withServer(
    (q, r) => r.end(JSON.stringify({ x: "x".repeat(100) })),
    async (url) => {
      const r = await m.runTutorial([step("a")], url, { maxBytes: 20 });
      assert.match(r[0].message, /byte limit/);
    },
  ));
test("redirect is not followed", async () =>
  withServer(
    (q, r) => {
      r.writeHead(302, { location: "/elsewhere" });
      r.end();
    },
    async (url) =>
      assert.equal((await m.runTutorial([step("a")], url))[0].status, "fail"),
  ));
test("heldout remote origin requires opt-in", async () =>
  assert.rejects(
    () => m.runTutorial([], "https://example.invalid"),
    /allowNetwork/,
  ));
test("deadline bounds stalled response", async () =>
  withServer(
    (q, r) => {},
    async (url) =>
      assert.equal(
        (await m.runTutorial([step("a")], url, { timeoutMs: 25 }))[0].status,
        "fail",
      ),
  ));
