import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
const cli = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "cli.ts")).href
);
test("approval and retirement survive separate store reads with exact evidence", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "hooks-contract-"));
  try {
    const input = path.join(root, "events.jsonl"),
      store = path.join(root, "store.json");
    await fs.writeFile(
      input,
      ["a", "b"]
        .map((id) =>
          JSON.stringify({
            id,
            session: id,
            scope: "repo",
            rule: "Keep API_KEY uppercase",
            source: "Config reads API_KEY",
            locator: "config.py:1",
          }),
        )
        .join("\n"),
    );
    const captured = await cli.execute(["capture", store, input]);
    const digest = captured.rules[0].approval_digest;
    assert.deepEqual((await cli.execute(["emit", store, "repo"])).rules, []);
    await assert.rejects(() => cli.execute(["approve", store, "wrong-digest"]));
    await cli.execute(["approve", store, digest]);
    const emitted = await cli.execute(["emit", store, "repo"]);
    assert.equal(emitted.rules[0], "Keep API_KEY uppercase");
    assert.equal(emitted.evidence[0].source, "Config reads API_KEY");
    await cli.execute(["retire", store, digest]);
    assert.deepEqual((await cli.execute(["emit", store, "repo"])).rules, []);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
