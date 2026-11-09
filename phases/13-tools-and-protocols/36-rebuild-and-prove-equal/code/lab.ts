// Lesson: Rebuild and Prove Equal: Differential Tests, Byte Comparison, and the Evidence Loop (phase 13 / lesson 36)
// TypeScript port of code/lab.py. Node standard library only.
// Source: phases/13-tools-and-protocols/36-rebuild-and-prove-equal/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/36-rebuild-and-prove-equal/code/lab.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { HERE, TRAP, gradeModel, inputGrid, model, percentChangeModel } from "./main.js";

type J = any;

const ANSWERS = join(HERE, "lab_answers.json");

const GRID = inputGrid();

const TASKS: [string, string, () => J][] = [
  ["t1", "percent_change_model(3, 105) on x86_64", () => percentChangeModel(3, 105)],
  ["t2", "percent_change_model(0, 5) on x86_64", () => percentChangeModel(0, 5)],
  ["t3", "grade_model(100)", () => gradeModel(100)],
  ["t4", "the number of cells in input_grid()", () => GRID.length],
  ["t5", "the number of grid cells where the x86_64 model traps", () => GRID.filter((cell) => model(cell.fn, cell.args) === TRAP).length],
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
