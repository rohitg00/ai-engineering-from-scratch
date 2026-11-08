import { test } from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const enc = new TextEncoder();
test("dispatch blank line", () =>
  assert.deepEqual(
    new m.SSEDecoder().push(enc.encode("id: 1\ndata: hello\n\n")),
    [{ id: "1", event: "message", data: "hello" }],
  ));
test("split Unicode", () => {
  const d = new m.SSEDecoder(),
    b = enc.encode("data: café\n\n");
  let out = [];
  for (const x of b) out.push(...d.push(Uint8Array.of(x)));
  assert.equal(out[0].data, "café");
});
test("CRLF and multiline", () => {
  const d = new m.SSEDecoder();
  assert.equal(d.push(enc.encode("data: a\r")).length, 0);
  assert.equal(d.push(enc.encode("\ndata: b\r\n\r\n"))[0].data, "a\nb");
});
test("EOF is not dispatch", () =>
  assert.equal(
    new m.SSEDecoder().push(enc.encode("data: unfinished"), true).length,
    0,
  ));
test("persistent ID and reset", () => {
  const r = new m.SSEDecoder().push(
    enc.encode("id: 7\ndata: a\n\ndata: b\n\nid:\ndata: c\n\n"),
  );
  assert.deepEqual(
    r.map((x) => x.id),
    ["7", "7", ""],
  );
});
test("invalid truncated bytes", () =>
  assert.throws(() => new m.SSEDecoder().push(Uint8Array.of(0xc3), true)));
test("comments and NUL ID", () => {
  const r = new m.SSEDecoder().push(
    enc.encode(": comment\nid: a\0b\ndata:\n\n"),
  );
  assert.equal(r[0].id, "");
  assert.equal(r[0].data, "");
});
