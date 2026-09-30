import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execute } from "./cli.ts";
const examples = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../examples",
);
const root = await fs.mkdtemp(path.join(os.tmpdir(), "skill-install-demo-"));
try {
  const input = path.join(examples, "orchard-release.json");
  const inspected = await execute(["inspect", input, "codex"]);
  const installed = await execute([
    "install",
    input,
    "codex",
    root,
    inspected.source_digest,
  ]);
  await fs.appendFile(
    path.join(installed.destination, "references/checklist.md"),
    "Local review note: verify the restore log.\n",
  );
  let conflict = "";
  try {
    await execute(["install", input, "codex", root, inspected.source_digest]);
  } catch (e) {
    conflict = (e as Error).message;
  }
  console.log(
    JSON.stringify(
      {
        schema_version: 1,
        source_digest: inspected.source_digest,
        installed: {
          ...installed,
          destination: ".agents/skills/orchard-release",
        },
        upgrade: conflict,
        local_edit_preserved: (
          await fs.readFile(
            path.join(installed.destination, "references/checklist.md"),
            "utf8",
          )
        ).includes("Local review note"),
      },
      null,
      2,
    ),
  );
} finally {
  await fs.rm(root, { recursive: true, force: true });
}
