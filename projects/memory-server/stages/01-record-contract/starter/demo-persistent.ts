import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = dirname(fileURLToPath(import.meta.url));
const directory = mkdtempSync(join(tmpdir(), "memory-restart-demo-"));
const invoke = (args: string[]) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [join(root, "cli.ts"), "--data-dir", directory, ...args],
      { encoding: "utf8" },
    ),
  );
try {
  const created = invoke(["--put", join(root, "samples/memory.json")]);
  const recovered = invoke(["--query", "cache policy"]);
  const updated = invoke([
    "--put",
    join(root, "samples/memory-updated.json"),
    "--revision",
    "1",
  ]);
  const history = invoke(["--history", "cache-policy"]);
  console.log(
    JSON.stringify(
      {
        mode: "actual separate processes sharing an append log; demo removes its temporary directory afterward",
        created,
        recovered,
        updated,
        history,
      },
      null,
      2,
    ),
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
