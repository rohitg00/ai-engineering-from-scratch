import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

import { createServer } from "node:http";
async function withServer(handler, fn) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}
const one = 'id: 1\ndata: {"type":"text","text":"A"}\n\n';
test("real wire completion", () =>
  withServer(
    (q, r) => {
      r.setHeader("Content-Type", "text/event-stream");
      r.end(one + 'id: 2\ndata: {"type":"complete"}\n\n');
    },
    async (u) => {
      assert.equal(
        (await m.connect(u, m.initial(), () => {})).status,
        "completed",
      );
    },
  ));
test("real wire interruption", () =>
  withServer(
    (q, r) => {
      r.setHeader("Content-Type", "text/event-stream");
      r.end(one);
    },
    async (u) => {
      const s = await m.connect(u, m.initial(), () => {});
      assert.equal(s.status, "interrupted");
      assert.equal(s.text, "A");
    },
  ));
test("resume header", () =>
  withServer(
    (q, r) => {
      assert.equal(q.headers["last-event-id"], "1");
      r.setHeader("Content-Type", "text/event-stream");
      r.end('id: 2\ndata: {"type":"complete"}\n\n');
    },
    async (u) => {
      const s = m.apply(m.initial(), {
        id: "1",
        event: "message",
        data: '{"type":"text","text":"A"}',
      });
      assert.equal((await m.connect(u, s, () => {})).status, "completed");
    },
  ));
test("HTTP failure", () =>
  withServer(
    (q, r) => {
      r.statusCode = 503;
      r.end();
    },
    async (u) =>
      assert.equal(
        (await m.connect(u, m.initial(), () => {})).status,
        "interrupted",
      ),
  ));
test("aborted", () =>
  withServer(
    (q, r) => r.end(),
    async (u) => {
      const c = new AbortController();
      c.abort();
      assert.equal(
        (await m.connect(u, m.initial(), () => {}, c.signal)).status,
        "cancelled",
      );
    },
  ));

test("malformed stream is cancelled", async (t) => {
  let cancelled = false;
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode("id: 1\ndata: not-json\n\n"));
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  const s = await m.connect("http://fixture.invalid", m.initial(), () => {});
  assert.equal(s.status, "interrupted");
  assert.equal(cancelled, true);
});
test("completion closes an otherwise open stream", async (t) => {
  let cancelled = false;
  t.mock.method(
    globalThis,
    "fetch",
    async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(
              new TextEncoder().encode('id: 1\ndata: {"type":"complete"}\n\n'),
            );
          },
          cancel() {
            cancelled = true;
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  );
  const s = await m.connect("http://fixture.invalid", m.initial(), () => {});
  assert.equal(s.status, "completed");
  assert.equal(cancelled, true);
});
