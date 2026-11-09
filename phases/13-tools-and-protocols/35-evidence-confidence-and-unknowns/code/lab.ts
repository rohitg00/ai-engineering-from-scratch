// Lesson: Evidence, Confidence, and Unknowns in Binary Analysis (phase 13 / lesson 35)
// TypeScript port of code/lab.py. Node standard library only.
// Source: phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/35-evidence-confidence-and-unknowns/code/lab.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { FIXTURES, HERE, computeEvidenceId } from "./main.js";

type J = any;

const ANSWERS = join(HERE, "lab_answers.json");

const GRADE = JSON.parse(readFileSync(join(FIXTURES, "rea-evidence-grade.json"), "utf-8"));

const TASKS: [string, string, () => J][] = [
  ["t1", "the evidence id that compute_evidence_id gives for rea-evidence-grade.json", () => computeEvidenceId(GRADE)],
  ["t2", "the number of limitations in the grade record", () => GRADE.limitations.length],
  ["t3", "the relationship_coverage status of the grade record", () => GRADE.relationship_coverage.status],
  ["t4", "the confidence and the authority of the grade record, as a list of two strings", () => [GRADE.confidence, GRADE.authority]],
  ["t5", "the SHA-256 of the subject of the grade record", () => GRADE.subject.digest.sha256],
];

class Flag {
  constructor(public value: boolean) {}
}

export function normal(value: J): J {
  if (typeof value === "boolean") return new Flag(value);
  if (typeof value === "string") {
    const text = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(text)) return BigInt(text);
    return text;
  }
  if (Array.isArray(value)) return value.map(normal);
  return value;
}

function same(a: J, b: J): boolean {
  if (a instanceof Flag || b instanceof Flag) return a instanceof Flag && b instanceof Flag && a.value === b.value;
  const numeric = (x: J) => typeof x === "bigint" || (typeof x === "number" && Number.isInteger(x));
  if (numeric(a) && numeric(b)) return BigInt(a) === BigInt(b);
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return a === b;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((item: J, index: number) => same(item, b[index]));
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((key) => key in b && same(a[key], b[key]));
}

export function expected(): Record<string, J> {
  const out: Record<string, J> = {};
  for (const [key, , compute] of TASKS) out[key] = compute();
  return out;
}

export function grade(answers: Record<string, J>): [string, string, string][] {
  const want = expected();
  const rows: [string, string, string][] = [];
  for (const [key, question] of TASKS) {
    const given = answers[key];
    if (given === undefined || given === null) {
      rows.push([key, question, "TODO"]);
    } else {
      rows.push([key, question, same(normal(given), normal(want[key])) ? "PASS" : "FAIL"]);
    }
  }
  return rows;
}

export function run(argv: string[]): number {
  const path = argv.length > 0 ? argv[0] : ANSWERS;
  const answers = JSON.parse(readFileSync(path, "utf-8"));
  const rows = grade(answers);
  for (const [key, question, status] of rows) console.log(`${status.padEnd(4)}  ${key}  ${question}`);
  const passed = rows.filter((row) => row[2] === "PASS").length;
  console.log(`score: ${passed}/${rows.length}`);
  return passed === rows.length ? 0 : 1;
}

if (require.main === module) {
  process.exitCode = run(process.argv.slice(2));
}
