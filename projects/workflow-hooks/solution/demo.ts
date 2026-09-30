import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execute } from "./cli.ts";
const examples = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../examples",
);
const root = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-hooks-demo-"));
try {
  const store = path.join(root, "rules.json");
  const captured = await execute([
    "capture",
    store,
    path.join(examples, "corrections.jsonl"),
  ]);
  const digest = captured.rules[0].approval_digest;
  const before = await execute(["emit", store, "orchard"]);
  await execute(["approve", store, digest]);
  const approved = await execute(["emit", store, "orchard"]);
  await execute(["retire", store, digest]);
  const retired = await execute(["emit", store, "orchard"]);
  console.log(
    JSON.stringify({ schema_version: 1, before, approved, retired }, null, 2),
  );
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
