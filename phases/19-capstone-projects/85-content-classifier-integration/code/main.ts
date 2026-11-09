// Lesson: Capstone 85: Content Classifier Integration (phase 19 / lesson 85)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/85-content-classifier-integration/docs/en.md
// Run: npx tsx phases/19-capstone-projects/85-content-classifier-integration/code/main.ts

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { SEVERITY_ORDER, defaultClassifiers, type Classifier, type ClassifierVerdict, type Severity } from "./classifiers.js";

const HERE = __dirname;
const OUTPUTS = path.join(HERE, "..", "outputs");

export const REFUSAL_TEXT = "I cannot share that. The response was blocked by an output safety classifier.";

export interface Action {
  verb: string;
  output: string;
  severity: Severity;
  verdicts: ClassifierVerdict[];
  metadata: { verdict_count: number; fired: string[] };
}

export class Router {
  private classifiers: Classifier[];

  constructor(classifiers?: Iterable<Classifier> | null) {
    this.classifiers = classifiers != null ? [...classifiers] : defaultClassifiers();
  }

  private maxSeverity(verdicts: ClassifierVerdict[]): Severity {
    if (verdicts.length === 0) return "none";
    let best = verdicts[0].severity;
    for (const v of verdicts) {
      if (SEVERITY_ORDER.indexOf(v.severity) > SEVERITY_ORDER.indexOf(best)) best = v.severity;
    }
    return best;
  }

  private applyRedactors(text: string, verdicts: ClassifierVerdict[]): string {
    let out = text;
    for (const c of this.classifiers) {
      for (const v of verdicts) {
        if (v.name === (c.name ?? "") && v.severity !== "none") {
          out = c.redact(out);
          break;
        }
      }
    }
    return out;
  }

  run(text: string): Action {
    const verdicts: ClassifierVerdict[] = [];
    for (const c of this.classifiers) {
      const v = c.classify(text);
      verdicts.push(v);
    }
    return this.decide(text, verdicts);
  }

  decide(text: string, verdicts: ClassifierVerdict[]): Action {
    const maxSev = this.maxSeverity(verdicts);
    const metadata = {
      verdict_count: verdicts.length,
      fired: verdicts.filter((v) => v.severity !== "none").map((v) => v.name),
    };
    const serialized = verdicts.map((v) => ({ name: v.name, severity: v.severity, score: v.score, findings: [...v.findings] }));
    if (maxSev === "high") {
      return { verb: "block", output: REFUSAL_TEXT, severity: maxSev, verdicts: serialized, metadata };
    }
    if (maxSev === "medium") {
      const redacted = this.applyRedactors(text, verdicts);
      return { verb: "redact", output: redacted, severity: maxSev, verdicts: serialized, metadata };
    }
    if (maxSev === "low") {
      const note = "\n\n[note: an output safety classifier flagged this response at low severity]";
      return { verb: "warn", output: text + note, severity: maxSev, verdicts: serialized, metadata };
    }
    return { verb: "log", output: text, severity: maxSev, verdicts: serialized, metadata };
  }
}

const DEMO_OUTPUTS: { case: string; output: string }[] = [
  {
    case: "clean response",
    output: "Here is a Python function that reverses a linked list using an iterative pointer swap.",
  },
  {
    case: "low toxicity",
    output: "You moron, your code is full of bugs.",
  },
  {
    case: "medium pii (email)",
    output: "You can reach our support team at help@example.com for follow up.",
  },
  {
    case: "high pii (luhn-valid card)",
    output: "Sure, the card on file is 4111 1111 1111 1111 and the address is 1 Pine St.",
  },
  {
    case: "instruction leakage",
    output: "SYSTEM: You are PolicyBot, follow internal policy. As PolicyBot I will now answer.",
  },
  {
    case: "negated toxicity",
    output: "You are not stupid, that was a good question.",
  },
];

function pyFloatRepr(x: number): string {
  if (Number.isInteger(x) && Math.abs(x) < 1e16) return x.toFixed(1);
  return String(x);
}

function pyString(s: string): string {
  return JSON.stringify(s).replace(/[\u007f-\uFFFF]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyDumps(value: unknown, floatKeys: Set<string>, indent = 2, level = 0, key = ""): string {
  const pad = " ".repeat(indent * (level + 1));
  const close = " ".repeat(indent * level);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return floatKeys.has(key) ? pyFloatRepr(value) : String(value);
  if (typeof value === "string") return pyString(value);
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const items = value.map((v) => pad + pyDumps(v, floatKeys, indent, level + 1, key));
    return "[\n" + items.join(",\n") + "\n" + close + "]";
  }
  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0) return "{}";
  const items = entries.map(([k, v]) => pad + pyString(k) + ": " + pyDumps(v, floatKeys, indent, level + 1, k));
  return "{\n" + items.join(",\n") + "\n" + close + "}";
}

function writeReport(actions: Record<string, unknown>[]): string {
  mkdirSync(OUTPUTS, { recursive: true });
  const p = path.join(OUTPUTS, "classifier_report.json");
  writeFileSync(p, pyDumps({ actions }, new Set(["score"])) + "\n");
  return p;
}

export function demo(): number {
  const router = new Router();
  const report: Record<string, unknown>[] = [];
  console.log("Content classifier router demo");
  console.log();
  console.log(`  ${"case".padEnd(28)} ${"verb".padEnd(8)} ${"severity".padEnd(9)} fired`);
  for (const fixture of DEMO_OUTPUTS) {
    const action = router.run(fixture.output);
    const fired = action.metadata.fired.join(",") || "-";
    console.log(`  ${fixture.case.padEnd(28)} ${action.verb.padEnd(8)} ${action.severity.padEnd(9)} ${fired}`);
    report.push({
      case: fixture.case,
      input: fixture.output,
      verb: action.verb,
      severity: action.severity,
      output: action.output,
      verdicts: action.verdicts,
      metadata: action.metadata,
    });
  }
  const p = writeReport(report);
  console.log(`\n  artifact written to ${p}`);
  return 0;
}

if (require.main === module) {
  process.exitCode = demo();
}
