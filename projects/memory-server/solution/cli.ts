import { MemoryStore, createMemoryServer } from "./main.ts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { parseArgs } from "node:util";
const { values } = parseArgs({
  options: {
    "data-dir": { type: "string" },
    serve: { type: "boolean" },
    port: { type: "string", default: "8788" },
    put: { type: "string" },
    revision: { type: "string", default: "0" },
    namespace: { type: "string", default: "docs" },
    query: { type: "string" },
    history: { type: "string" },
    html: { type: "string" },
  },
});
if (!values["data-dir"])
  throw new Error(
    "--data-dir is required; the directory is retained across restarts",
  );
const directory = resolve(values["data-dir"]);
await mkdir(directory, { recursive: true, mode: 0o700 });
const store = new MemoryStore(join(directory, "memory.jsonl"));
await store.load();
if (values.put)
  console.log(
    JSON.stringify(
      await store.put(
        JSON.parse(await readFile(values.put, "utf8")),
        Number(values.revision),
      ),
    ),
  );
if (values.query !== undefined)
  console.log(
    JSON.stringify(
      await store.search(values.namespace!, values.query),
      null,
      2,
    ),
  );
if (values.history) {
  const raw = await readFile(store.file, "utf8").catch((e) => {
    if (e.code === "ENOENT") return "";
    throw e;
  });
  const history = raw
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line))
    .filter(
      (row) => row.namespace === values.namespace && row.id === values.history,
    );
  console.log(JSON.stringify(history, null, 2));
  if (values.html) {
    const escape = (s: string) =>
      s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;");
    await writeFile(
      values.html,
      '<!doctype html><meta charset="utf-8"><title>Memory revisions</title><h1>Source and revision comparison</h1><table><tr><th>Revision</th><th>Source</th><th>Text</th></tr>' +
        history
          .map(
            (r: any) =>
              "<tr><td>" +
              r.revision +
              "</td><td>" +
              escape(r.source) +
              "</td><td>" +
              escape(r.text) +
              "</td></tr>",
          )
          .join("") +
        "</table>",
    );
  }
}
if (values.serve) {
  const token = process.env.MEMORY_TOKEN;
  if (!token) throw new Error("Set MEMORY_TOKEN before serving");
  const port = Number(values.port);
  if (!Number.isInteger(port) || port < 0 || port > 65535)
    throw new Error("invalid port");
  const server = createMemoryServer(store, token);
  await new Promise<void>((done, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", done);
  });
  const address = server.address() as { port: number };
  console.log(
    JSON.stringify({
      mode: "persistent-loopback",
      base: `http://127.0.0.1:${address.port}`,
      mcp: `http://127.0.0.1:${address.port}/mcp`,
      storage: store.file,
    }),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.once(signal, () => server.close(() => process.exit(0)));
} else if (!values.put && !values.history && values.query === undefined)
  throw new Error("Choose --serve, --put, --query or --history");
