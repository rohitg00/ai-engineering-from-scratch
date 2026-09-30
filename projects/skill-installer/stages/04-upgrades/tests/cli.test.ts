import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";
const cli = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "cli.ts")).href
);
test("inspect digest gates actual install and local edits survive rejected upgrade", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "installer-cli-"));
  try {
    const file = path.join(root, "bundle.json");
    await fs.writeFile(
      file,
      JSON.stringify({
        name: "orchard",
        description: "Review releases",
        files: { "SKILL.md": "Read the restore log." },
      }),
    );
    const inspect = await cli.execute(["inspect", file, "codex"]);
    await assert.rejects(() =>
      cli.execute(["install", file, "codex", root, "wrong"]),
    );
    const result = await cli.execute([
      "install",
      file,
      "codex",
      root,
      inspect.source_digest,
    ]);
    const installed = path.join(result.destination, "SKILL.md");
    assert.match(await fs.readFile(installed, "utf8"), /name: "orchard"/);
    await fs.appendFile(installed, "Local edit.");
    await assert.rejects(() =>
      cli.execute(["install", file, "codex", root, inspect.source_digest]),
    );
    assert.match(await fs.readFile(installed, "utf8"), /Local edit/);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
