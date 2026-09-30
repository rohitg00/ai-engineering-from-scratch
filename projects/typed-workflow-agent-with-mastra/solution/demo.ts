import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const here = dirname(fileURLToPath(import.meta.url));
const directory = mkdtempSync(resolve(tmpdir(), "workflow-demo-"));
try {
  console.log(
    "Local simulated tool: suspend before an update, inspect checkpoint, then explicitly resume.",
  );
  execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      resolve(here, "cli.ts"),
      "--ticket",
      resolve(here, "fixtures/ticket.json"),
      "--out",
      resolve(directory, "pending"),
    ],
    { stdio: "inherit" },
  );
  execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      resolve(here, "cli.ts"),
      "--checkpoint",
      resolve(directory, "pending/checkpoint.json"),
      "--approved",
      "--out",
      resolve(directory, "resumed"),
    ],
    { stdio: "inherit" },
  );
  console.log(
    "Use cli.ts with your own ticket JSON to keep the HTML report. Use optional-mastra/cli.ts for real SDK persistence.",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
