import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

async function serve(fn: any) {
  const d = await fs.mkdtemp(path.join(os.tmpdir(), "memory-http-"));
  const store = new m.MemoryStore(path.join(d, "log"));
  const server = m.createMemoryServer(store, "test-token");
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  try {
    await fn(`http://127.0.0.1:${server.address().port}`, store);
  } finally {
    await new Promise<void>((r) => server.close(() => r()));
    await fs.rm(d, { recursive: true, force: true });
  }
}
const headers = { authorization: "Bearer test-token" };
test("missing auth denied", async () =>
  serve(async (url: string) =>
    assert.equal((await fetch(url + "/health")).status, 401),
  ));
test("health on wire", async () =>
  serve(async (url: string) =>
    assert.deepEqual(await (await fetch(url + "/health", { headers })).json(), {
      ok: true,
    }),
  ));
test("REST writes revision", async () =>
  serve(async (url: string) => {
    const r = await fetch(url + "/memories", {
      method: "POST",
      headers,
      body: JSON.stringify({
        memory: { id: "m", namespace: "n", text: "text", source: "s:1" },
      }),
    });
    assert.equal(r.status, 201);
    assert.equal((await r.json()).revision, 1);
  }));
test("MCP lists tools", async () =>
  serve(async (url: string) => {
    const r = await fetch(url + "/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 7, method: "tools/list" }),
    });
    const data = await r.json();
    assert.equal(data.id, 7);
    assert.equal(data.result.tools.length, 2);
  }));
test("MCP tool error explicit", async () =>
  serve(async (url: string) => {
    const r = await fetch(url + "/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "unknown" },
      }),
    });
    assert.equal((await r.json()).result.isError, true);
  }));
test("unknown method protocol error", async () =>
  serve(async (url: string) => {
    const r = await fetch(url + "/mcp", {
      method: "POST",
      headers,
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "missing" }),
    });
    assert.equal((await r.json()).error.code, -32601);
  }));

async function rawRequest(url: string, headers: string, chunks: Buffer[]) {
  const { createConnection } = await import("node:net");
  const socket = createConnection({ host: "127.0.0.1", port: Number(new URL(url).port) });
  let response = "";
  await new Promise<void>((resolve, reject) => {
    const deadline = setTimeout(() => {
      socket.destroy();
      reject(new Error("Response connection did not close"));
    }, 1500);
    socket.on("error", reject);
    socket.on("data", (chunk) => { response += chunk.toString("utf8"); });
    socket.on("close", () => { clearTimeout(deadline); resolve(); });
    socket.on("connect", async () => {
      socket.write(`POST /memories HTTP/1.1\r\nHost: localhost\r\nAuthorization: Bearer test-token\r\n${headers}\r\n\r\n`);
      for (const chunk of chunks) {
        if (socket.destroyed) break;
        socket.write(chunk);
        await new Promise((resolve) => setTimeout(resolve, 15));
      }
    });
  });
  return response;
}

for (const transfer of ["content-length", "chunked"]) {
  test(`oversized unfinished ${transfer} upload returns 413 and closes`, async () =>
    serve(async (url: string, store: any) => {
      const header = transfer === "chunked" ? "Transfer-Encoding: chunked" : "Content-Length: 200000";
      const data = Buffer.from("x".repeat(60000));
      const chunk = transfer === "chunked"
        ? Buffer.concat([Buffer.from(data.length.toString(16) + "\r\n"), data, Buffer.from("\r\n")])
        : data;
      const response = await rawRequest(url, header, [chunk]);
      assert.match(response, /^HTTP\/1\.1 413 /);
      assert.match(response, /\r\nconnection: close\r\n/i);
      assert.match(response, /\{"error":"body too large"\}/);
      assert.deepEqual(await store.list("n"), []);
    }));
}

test("HTTP body preserves UTF-8 code points split between chunks", async () =>
  serve(async (url: string, store: any) => {
    const text = "A café with green chairs";
    const body = Buffer.from(JSON.stringify({ memory: { id: "unicode", namespace: "n", text, source: "notes:1" } }));
    const split = body.indexOf(Buffer.from("é")) + 1;
    const response = await rawRequest(url, `Content-Length: ${body.length}\r\nConnection: close`, [body.subarray(0, split), body.subarray(split)]);
    assert.match(response, /^HTTP\/1\.1 201 /);
    assert.equal((await store.list("n"))[0].text, text);
  }));
