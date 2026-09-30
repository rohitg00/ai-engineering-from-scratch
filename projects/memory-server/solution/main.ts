/*
 * Persistent Memory Server reference implementation.
 * Follow stages in projects/memory-server/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

import { promises as fs, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import os from "node:os";
export type Memory = {
  id: string;
  namespace: string;
  text: string;
  source: string;
  revision: number;
};
export function validateMemory(raw: unknown): Omit<Memory, "revision"> {
  if (!raw || typeof raw !== "object") throw new Error("invalid memory");
  const r = raw as Memory;
  if (
    !/^[a-zA-Z0-9_-]{1,64}$/.test(r.id ?? "") ||
    !/^[a-zA-Z0-9_-]{1,64}$/.test(r.namespace ?? "")
  )
    throw new Error("invalid identity");
  if (
    typeof r.text !== "string" ||
    !r.text.trim() ||
    Buffer.byteLength(r.text) > 10000 ||
    typeof r.source !== "string" ||
    !r.source.trim()
  )
    throw new Error("invalid source or text");
  return { id: r.id, namespace: r.namespace, text: r.text, source: r.source };
}
export function embed(text: string, dimensions = 32): number[] {
  if (!Number.isInteger(dimensions) || dimensions < 1)
    throw new Error("invalid dimensions");
  const v = Array(dimensions).fill(0);
  for (const word of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let hash = 2166136261;
    for (const char of word)
      hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
    v[(hash >>> 0) % dimensions]++;
  }
  return v;
}
let binary: string | undefined;
export function cosineScores(query: number[], vectors: number[][]): number[] {
  if (
    !query.length ||
    [query, ...vectors].some(
      (v) => v.length !== query.length || v.some((x) => !Number.isFinite(x)),
    )
  )
    throw new Error("invalid vectors");
  if (!binary) {
    const source = fileURLToPath(new URL("./score.rs", import.meta.url));
    const directory = mkdtempSync(path.join(os.tmpdir(), "memory-score-"));
    const target = path.join(directory, "score");
    try {
      execFileSync("rustc", ["--edition", "2021", source, "-o", target]);
      binary = target;
      process.once("exit", () =>
        rmSync(directory, { recursive: true, force: true }),
      );
    } catch (error) {
      rmSync(directory, { recursive: true, force: true });
      throw error;
    }
  }
  const raw = execFileSync(binary, [], {
    input: [query, ...vectors].map((v) => v.join(",")).join("\n") + "\n",
    encoding: "utf8",
  }).trim();
  return raw ? raw.split("\n").map((line) => Number(line.split("\t")[1])) : [];
}
export class MemoryStore {
  file: string;
  records = new Map<string, Memory>();
  loaded = false;
  tail: Promise<unknown> = Promise.resolve();
  constructor(file: string) {
    this.file = file;
  }
  async load() {
    if (this.loaded) return;
    try {
      const raw = await fs.readFile(this.file, "utf8");
      for (const line of raw.split("\n").filter(Boolean)) {
        const record = JSON.parse(line);
        validateMemory(record);
        if (!Number.isInteger(record.revision) || record.revision < 1)
          throw new Error("invalid revision");
        const key = record.namespace + ":" + record.id;
        const old = this.records.get(key);
        if (record.revision !== (old?.revision ?? 0) + 1)
          throw new Error("revision gap");
        this.records.set(key, record);
      }
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
    this.loaded = true;
  }
  async put(raw: unknown, expectedRevision = 0): Promise<Memory> {
    const operation = this.tail.then(async () => {
      await this.load();
      const data = validateMemory(raw);
      const key = data.namespace + ":" + data.id;
      const old = this.records.get(key);
      if (
        !Number.isInteger(expectedRevision) ||
        expectedRevision !== (old?.revision ?? 0)
      )
        throw new Error("revision conflict");
      const record = { ...data, revision: expectedRevision + 1 };
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.appendFile(this.file, JSON.stringify(record) + "\n", {
        mode: 0o600,
      });
      this.records.set(key, record);
      return record;
    });
    this.tail = operation.catch(() => {});
    return operation;
  }
  async list(namespace: string) {
    await this.tail;
    await this.load();
    return [...this.records.values()]
      .filter((r) => r.namespace === namespace)
      .map((r) => ({ ...r }));
  }
  async search(namespace: string, query: string, limit = 5) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100)
      throw new Error("invalid limit");
    const records = await this.list(namespace);
    if (!query.trim() || !records.length) return [];
    const terms = new Set(query.toLowerCase().match(/[a-z0-9]+/g) ?? []);
    const scores = cosineScores(
      embed(query),
      records.map((r) => embed(r.text)),
    );
    return records
      .map((record, i) => {
        const words = new Set(
          record.text.toLowerCase().match(/[a-z0-9]+/g) ?? [],
        );
        const lexical = terms.size
          ? [...terms].filter((t) => words.has(t)).length / terms.size
          : 0;
        return { ...record, score: 0.6 * lexical + 0.4 * scores[i] };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
      .slice(0, limit);
  }
}
export function createMemoryServer(store: MemoryStore, token: string) {
  if (!token) throw new Error("token required");
  return createServer(async (req, res) => {
    const send = (status: number, value: unknown) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(value));
    };
    if (req.headers.authorization !== `Bearer ${token}`) {
      send(401, { error: "unauthorized" });
      return;
    }
    const url = new URL(req.url ?? "/", "http://localhost");
    try {
      if (req.method === "GET" && url.pathname === "/health") {
        send(200, { ok: true });
        return;
      }
      if (req.method === "GET" && url.pathname === "/memories") {
        send(
          200,
          await store.search(
            url.searchParams.get("namespace") ?? "default",
            url.searchParams.get("q") ?? "",
          ),
        );
        return;
      }
      if (req.method !== "POST") {
        send(404, { error: "not found" });
        return;
      }
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > 50000) {
          res.setHeader("Connection", "close");
          send(413, { error: "body too large" });
          return;
        }
        chunks.push(chunk);
      }
      const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
      if (url.pathname === "/memories") {
        send(201, await store.put(data.memory, data.expectedRevision ?? 0));
        return;
      }
      if (url.pathname !== "/mcp") {
        send(404, { error: "not found" });
        return;
      }
      if (data.jsonrpc !== "2.0" || typeof data.method !== "string") {
        send(400, { error: "invalid JSON-RPC" });
        return;
      }
      if (data.method === "notifications/initialized") {
        res.writeHead(204);
        res.end();
        return;
      }
      const reply = (result: unknown) =>
        send(200, { jsonrpc: "2.0", id: data.id, result });
      if (data.method === "initialize") {
        reply({
          protocolVersion: ["2025-06-18", "2025-11-25"].includes(
            data.params?.protocolVersion,
          )
            ? data.params.protocolVersion
            : "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: { name: "scratch-memory", version: "1.0.0" },
        });
        return;
      }
      if (data.method === "tools/list") {
        reply({
          tools: [
            {
              name: "memory_search",
              description: "Search a namespace",
              inputSchema: {
                type: "object",
                properties: {
                  namespace: { type: "string" },
                  query: { type: "string" },
                },
                required: ["namespace", "query"],
              },
            },
            {
              name: "memory_put",
              description: "Write with expected revision",
              inputSchema: {
                type: "object",
                properties: {
                  memory: {
                    type: "object",
                    properties: {
                      id: { type: "string", pattern: "^[a-zA-Z0-9_-]{1,64}$" },
                      namespace: {
                        type: "string",
                        pattern: "^[a-zA-Z0-9_-]{1,64}$",
                      },
                      text: { type: "string", minLength: 1, maxLength: 10000 },
                      source: { type: "string", minLength: 1 },
                    },
                    required: ["id", "namespace", "text", "source"],
                    additionalProperties: false,
                  },
                  expectedRevision: { type: "integer" },
                },
                required: ["memory"],
              },
            },
          ],
        });
        return;
      }
      if (data.method === "tools/call") {
        try {
          const args = data.params?.arguments ?? {};
          let result: unknown;
          if (data.params?.name === "memory_search") {
            if (
              typeof args.namespace !== "string" ||
              typeof args.query !== "string"
            )
              throw new Error("invalid search arguments");
            result = await store.search(args.namespace, args.query);
          } else if (data.params?.name === "memory_put")
            result = await store.put(args.memory, args.expectedRevision ?? 0);
          else throw new Error("unknown tool");
          reply({
            content: [{ type: "text", text: JSON.stringify(result) }],
            isError: false,
          });
        } catch (e) {
          reply({
            content: [{ type: "text", text: (e as Error).message }],
            isError: true,
          });
        }
        return;
      }
      send(200, {
        jsonrpc: "2.0",
        id: data.id,
        error: { code: -32601, message: "Method not found" },
      });
    } catch (e) {
      send((e as Error).message.includes("conflict") ? 409 : 400, {
        error: (e as Error).message,
      });
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "memory-demo-"));
  const store = new MemoryStore(path.join(dir, "memory.jsonl"));
  const server = createMemoryServer(store, "local-demo-token");
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address() as { port: number };
    const base = `http://127.0.0.1:${address.port}`;
    await fetch(base + "/memories", {
      method: "POST",
      headers: { authorization: "Bearer local-demo-token" },
      body: JSON.stringify({
        memory: {
          id: "m1",
          namespace: "docs",
          text: "Rust computes cosine similarity for memory search",
          source: "notes/search.md:1",
        },
      }),
    });
    const response = await fetch(base + "/mcp", {
      method: "POST",
      headers: { authorization: "Bearer local-demo-token" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "memory_search",
          arguments: { namespace: "docs", query: "memory search" },
        },
      }),
    });
    console.log(
      JSON.stringify(
        {
          transport: "actual local HTTP and MCP",
          response: await response.json(),
        },
        null,
        2,
      ),
    );
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await fs.rm(dir, { recursive: true, force: true });
  }
}
