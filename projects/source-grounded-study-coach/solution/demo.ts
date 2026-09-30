import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { validateDeck, gradeAnswer, exportPractice } from "./main.ts";
const here = dirname(fileURLToPath(import.meta.url));
const deck = validateDeck(
  JSON.parse(readFileSync(resolve(here, "fixtures/deck.json"), "utf8")),
);
const attempts = JSON.parse(
  readFileSync(resolve(here, "fixtures/attempts.json"), "utf8"),
);
const directory = mkdtempSync(resolve(tmpdir(), "study-demo-"));
try {
  console.log(
    "A seed-library reading becomes a source-grounded practice queue.",
  );
  console.log(
    JSON.stringify(gradeAnswer(deck, "storage", "paper envelopes"), null, 2),
  );
  const report = exportPractice(
    deck,
    attempts,
    "2026-09-01",
    "2026-09-03",
    directory,
  );
  console.log("Review schedule:", JSON.stringify(report.progress, null, 2));
  console.log(
    "Run node main.ts --out ./study-output to keep the practice page and progress JSON.",
  );
} finally {
  rmSync(directory, { recursive: true, force: true });
}
