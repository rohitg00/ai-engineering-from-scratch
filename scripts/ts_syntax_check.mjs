#!/usr/bin/env node
/**
 * Syntax-check every TypeScript file in the curriculum.
 *
 * Uses the TypeScript compiler API to parse files WITHOUT resolving imports,
 * so lessons that reference heavy deps (hono, zod, @anthropic-ai/sdk, etc.)
 * don't fail because node_modules is empty.
 *
 * Usage:
 *   node scripts/ts_syntax_check.mjs
 *   node scripts/ts_syntax_check.mjs --json
 *   node scripts/ts_syntax_check.mjs --phase 14
 *
 * Exit codes:
 *   0 — clean
 *   1 — parse errors found
 *
 * Node.js 20+. Requires: npm install typescript (CI installs it on the fly).
 */

import { createRequire } from "node:module";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const PHASES_DIR = join(ROOT, "phases");

const PHASE_DIR_RE = /^(\d{2})-[a-z0-9][a-z0-9-]*[a-z0-9]$/;
const LESSON_DIR_RE = /^\d{2}-[a-z0-9][a-z0-9-]*[a-z0-9]$/;

function findTsFiles(phaseFilter) {
  /** @type {string[]} */
  const files = [];
  for (const phaseName of readdirSync(PHASES_DIR).sort()) {
    const phaseDir = join(PHASES_DIR, phaseName);
    if (!statSync(phaseDir).isDirectory()) continue;
    const pm = PHASE_DIR_RE.exec(phaseName);
    if (!pm) continue;
    if (phaseFilter !== null && parseInt(pm[1], 10) !== phaseFilter) continue;

    for (const lessonName of readdirSync(phaseDir).sort()) {
      const lessonDir = join(phaseDir, lessonName);
      if (!statSync(lessonDir).isDirectory()) continue;
      if (!LESSON_DIR_RE.test(lessonName)) continue;

      const codeDir = join(lessonDir, "code");
      try {
        if (!statSync(codeDir).isDirectory()) continue;
      } catch {
        continue;
      }

      for (const f of readdirSync(codeDir)) {
        if (f.endsWith(".ts") || f.endsWith(".mts")) {
          files.push(join(codeDir, f));
        }
      }
    }
  }
  return files;
}

function checkFiles(filePaths) {
  let ts;
  try {
    ts = createRequire(import.meta.url)("typescript");
  } catch {
    console.error("typescript is not installed. Run: npm install typescript");
    process.exit(2);
  }

  /** @type {Array<{file: string, status: string, message: string}>} */
  const results = [];
  let failed = 0;

  for (const absPath of filePaths) {
    const relPath = relative(ROOT, absPath).replace(/\\/g, "/");
    try {
      const source = readFileSync(absPath, "utf-8");
      // Create a source file without resolving modules — pure parse check.
      const sf = ts.createSourceFile(
        absPath,
        source,
        ts.ScriptTarget.ES2022,
        /* setParentNodes */ false
      );

      // Walk the AST looking for syntax diagnostics.
      const diagnostics = ts.getParseDiagnostics(sf);

      if (diagnostics.length > 0) {
        const messages = diagnostics.map(
          (d) =>
            ts.flattenDiagnosticMessageText(d.messageText, "\n")
        );
        results.push({
          file: relPath,
          status: "failed",
          message: messages.join("; "),
        });
        failed++;
      } else {
        results.push({ file: relPath, status: "passed", message: "" });
      }
    } catch (err) {
      results.push({
        file: relPath,
        status: "failed",
        message: `read error: ${err.message}`,
      });
      failed++;
    }
  }

  return { results, passed: results.length - failed, failed };
}

function main() {
  const args = process.argv.slice(2);
  let phaseFilter = null;
  let jsonOut = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--phase") phaseFilter = parseInt(args[++i], 10);
    if (args[i] === "--json") jsonOut = true;
  }

  const files = findTsFiles(phaseFilter);

  if (files.length === 0) {
    if (jsonOut) {
      console.log(JSON.stringify({ checked: 0, passed: 0, failed: 0, results: [] }));
    } else {
      console.log("ts_syntax_check.mjs — no TypeScript files found");
    }
    return 0;
  }

  const { results, passed, failed } = checkFiles(files);

  if (jsonOut) {
    console.log(JSON.stringify({ checked: files.length, passed, failed, results }, null, 2));
  } else {
    console.log(
      `ts_syntax_check.mjs — ${files.length} file(s): passed=${passed} failed=${failed}`
    );
    for (const r of results) {
      if (r.status === "failed") {
        console.log(`  [FAIL] ${r.file}: ${r.message}`);
      }
    }
  }

  return failed > 0 ? 1 : 0;
}

process.exit(main());
