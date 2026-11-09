// Lesson: Program Anatomy: An ELF Reader From Scratch (phase 13 / lesson 32)
// TypeScript port of code/lab.py. Node standard library only.
// Source: phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/32-program-anatomy-elf-from-scratch/code/lab.ts

import { readFileSync } from "node:fs";
import * as path from "node:path";
import { ElfFile, FIXTURES } from "./main";

const HERE = __dirname;
const ANSWERS = path.join(HERE, "lab_answers.json");

const O0 = ElfFile.fromPath(path.join(FIXTURES, "ledger-x86_64-O0.o"));
const O1 = ElfFile.fromPath(path.join(FIXTURES, "ledger-x86_64-O1.o"));
const RODATA = O1.section_bytes(O1.section(".rodata"));

type Task = [string, string, () => unknown];

function range(start: number, stop: number, step: number): number[] {
  const out: number[] = [];
  for (let i = start; i < stop; i += step) out.push(i);
  return out;
}

const TASKS: Task[] = [
  ["t1", "e_shoff of ledger-x86_64-O1.o, as a number", () => O1.header.e_shoff],
  ["t2", "st_size of percent_change in ledger-x86_64-O1.o", () => O1.symbol("percent_change").st_size],
  ["t3", "file offset of .text in ledger-x86_64-O1.o, as hex", () => `0x${O1.section(".text").sh_offset.toString(16)}`],
  [
    "t4",
    "relocation type names in ledger-x86_64-O0.o, sorted, as a list",
    () => Array.from(new Set(O0.relocations.map((r) => r.type_name))).sort(),
  ],
  [
    "t5",
    "the five int values at .rodata+0x14 in ledger-x86_64-O1.o, as a list",
    () => range(0x14, 0x28, 4).map((i) => RODATA.subarray(i, i + 4).reduce((acc, byte, k) => acc + byte * 2 ** (8 * k), 0)),
  ],
];

class BoolTag {
  constructor(readonly value: boolean) {}
}

function normal(value: unknown): unknown {
  if (typeof value === "boolean") return new BoolTag(value);
  if (typeof value === "string") {
    const text = value.trim();
    if (/^0x[0-9a-fA-F]+$/.test(text)) return parseInt(text, 16);
    return text;
  }
  if (Array.isArray(value)) return value.map((item) => normal(item));
  return value;
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof BoolTag || b instanceof BoolTag) {
    return a instanceof BoolTag && b instanceof BoolTag && a.value === b.value;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, index) => same(item, b[index]));
  }
  if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;
    return keys.every(
      (key) => key in b && same((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    );
  }
  return a === b;
}

function expected(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, , compute] of TASKS) out[key] = compute();
  return out;
}

function grade(answers: Record<string, unknown>): [string, string, string][] {
  const want = expected();
  const rows: [string, string, string][] = [];
  for (const [key, question] of TASKS) {
    const given = answers[key];
    if (given === undefined || given === null) rows.push([key, question, "TODO"]);
    else rows.push([key, question, same(normal(given), normal(want[key])) ? "PASS" : "FAIL"]);
  }
  return rows;
}

function run(argv: string[]): number {
  const filePath = argv.length ? argv[0] : ANSWERS;
  const answers = JSON.parse(readFileSync(filePath, "utf-8")) as Record<string, unknown>;
  const rows = grade(answers);
  for (const [key, question, status] of rows) console.log(`${status.padEnd(4)}  ${key}  ${question}`);
  const passed = rows.filter((row) => row[2] === "PASS").length;
  console.log(`score: ${passed}/${rows.length}`);
  return passed === rows.length ? 0 : 1;
}

process.exitCode = run(process.argv.slice(2));
