// Lesson: Disassembly and Control Flow: From Bytes to a Graph You Can Check (phase 13 / lesson 33)
// TypeScript port of code/lab.py. Node standard library only.
// Source: phases/13-tools-and-protocols/33-disassembly-and-control-flow/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/33-disassembly-and-control-flow/code/lab.ts

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { analyzeFunction, loadFixture } from "./main";

const HERE = __dirname;
const ANSWERS = join(HERE, "lab_answers.json");

const O0 = loadFixture("ledger-x86_64-O0.o");
const O1 = loadFixture("ledger-x86_64-O1.o");
const TRAP = loadFixture("sweep-trap.o");

type Value = unknown;

function pyHex(value: number): string {
  return value < 0 ? `-0x${(-value).toString(16)}` : `0x${value.toString(16)}`;
}

const TASKS: [string, string, () => Value][] = [
  ["t1", "instructions that recursive descent decodes in grade at -O1", () => analyzeFunction(O1, "grade").descent.instructions.size],
  ["t2", "basic blocks in total at -O1", () => analyzeFunction(O1, "total").cfg.blocks.size],
  ["t3", "address of the loop header in total at -O1, as hex", () => pyHex(analyzeFunction(O1, "total").cfg.backEdges()[0][1])],
  [
    "t4",
    "in sweep-trap.o, the address where the linear sweep instruction that covers 0x14 starts, as hex",
    () => pyHex(analyzeFunction(TRAP, "lookup").sweep.covering(0x14)!.address),
  ],
  ["t5", "entries in the jump table of grade at -O0", () => analyzeFunction(O0, "grade").descent.resolvedTables.values().next().value!.targets.length],
];

class BoolTag {
  constructor(readonly value: boolean) {}
}

function normal(value: Value): Value {
  if (typeof value === "boolean") {
    return new BoolTag(value);
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(text)) {
      return parseInt(text.slice(2), 16);
    }
    return text;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normal(item));
  }
  return value;
}

function equal(first: Value, second: Value): boolean {
  if (first instanceof BoolTag || second instanceof BoolTag) {
    return first instanceof BoolTag && second instanceof BoolTag && first.value === second.value;
  }
  if (Array.isArray(first) || Array.isArray(second)) {
    return Array.isArray(first) && Array.isArray(second) && first.length === second.length && first.every((item, index) => equal(item, second[index]));
  }
  if (first !== null && second !== null && typeof first === "object" && typeof second === "object") {
    const a = first as Record<string, Value>;
    const b = second as Record<string, Value>;
    const keys = Object.keys(a);
    return keys.length === Object.keys(b).length && keys.every((key) => key in b && equal(a[key], b[key]));
  }
  return first === second;
}

function expected(): Map<string, Value> {
  return new Map(TASKS.map(([key, , compute]) => [key, compute()]));
}

function grade(answers: Record<string, Value>): [string, string, string][] {
  const want = expected();
  const rows: [string, string, string][] = [];
  for (const [key, question] of TASKS) {
    const given = answers[key];
    if (given === null || given === undefined) {
      rows.push([key, question, "TODO"]);
    } else {
      rows.push([key, question, equal(normal(given), normal(want.get(key))) ? "PASS" : "FAIL"]);
    }
  }
  return rows;
}

function run(argv: string[]): number {
  const path = argv.length ? argv[0] : ANSWERS;
  const answers = JSON.parse(readFileSync(path, "utf-8")) as Record<string, Value>;
  const rows = grade(answers);
  for (const [key, question, status] of rows) {
    console.log(`${status.padEnd(4)}  ${key}  ${question}`);
  }
  const passed = rows.filter((row) => row[2] === "PASS").length;
  console.log(`score: ${passed}/${rows.length}`);
  return passed === rows.length ? 0 : 1;
}

process.exitCode = run(process.argv.slice(2));
