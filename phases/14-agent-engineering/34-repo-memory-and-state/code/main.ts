// Lesson: Repo Memory and Durable State (phase 14 / lesson 34)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/34-repo-memory-and-state/docs/en.md
// Run: npx tsx phases/14-agent-engineering/34-repo-memory-and-state/code/main.ts

import { randomBytes } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, renameSync, rmSync, writeFileSync, writeSync } from "node:fs";
import { basename, dirname, join } from "node:path";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Schema = { [key: string]: Json };

const HERE = __dirname;
const WORK = join(HERE, "workdir");

const STATE_SCHEMA: Schema = {
  $id: "agent_state.schema.json",
  type: "object",
  required: ["schema_version", "active_task_id", "touched_files", "next_action"],
  properties: {
    schema_version: { type: "integer", enum: [1] },
    active_task_id: { type: ["string", "null"], pattern: "^(T-\\d{3,}|)$" },
    touched_files: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    blockers: { type: "array", items: { type: "string" } },
    next_action: { type: "string" },
  },
};

const BOARD_SCHEMA: Schema = {
  $id: "task_board.schema.json",
  type: "array",
  items: {
    type: "object",
    required: ["id", "goal", "owner", "acceptance", "status"],
    properties: {
      id: { type: "string", pattern: "^T-\\d{3,}$" },
      goal: { type: "string" },
      owner: { type: "string", enum: ["builder", "reviewer", "human"] },
      acceptance: { type: "array", items: { type: "string" } },
      status: { type: "string", enum: ["todo", "in_progress", "done", "blocked"] },
    },
  },
};

class SchemaError extends Error {}

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\r") out += "\\r";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return quote + out + quote;
}

function pyRepr(value: Json): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyStr(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(value).map(([k, v]) => `${pyStr(k)}: ${pyRepr(v)}`).join(", ") + "}";
}

function pyFormat(value: Json): string {
  return typeof value === "string" ? value : pyRepr(value);
}

function isObject(value: Json): value is { [key: string]: Json } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pyTypeName(value: Json): string {
  if (value === null) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (Array.isArray(value)) return "list";
  return "dict";
}

function deepEqual(a: Json, b: Json): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function checkType(value: Json, types: Json): boolean {
  const typeList: Json[] = typeof types === "string" ? [types] : Array.isArray(types) ? types : [];
  for (const t of typeList) {
    if (t === "object" && isObject(value)) return true;
    if (t === "array" && Array.isArray(value)) return true;
    if (t === "string" && typeof value === "string") return true;
    if (t === "integer" && typeof value === "number" && Number.isInteger(value)) return true;
    if (t === "null" && value === null) return true;
  }
  return false;
}

function validate(value: Json, schema: Schema, path = "$"): void {
  if ("type" in schema && !checkType(value, schema.type)) {
    throw new SchemaError(`${path}: expected ${pyFormat(schema.type)}, got ${pyTypeName(value)}`);
  }
  if ("enum" in schema) {
    const options = schema.enum as Json[];
    if (!options.some((opt) => deepEqual(opt, value))) {
      throw new SchemaError(`${path}: ${pyRepr(value)} not in ${pyRepr(options)}`);
    }
  }
  if ("pattern" in schema && typeof value === "string" && !new RegExp(schema.pattern as string).test(value)) {
    throw new SchemaError(`${path}: ${pyRepr(value)} does not match /${schema.pattern as string}/`);
  }
  if (isObject(value)) {
    for (const key of (schema.required as string[] | undefined) ?? []) {
      if (!(key in value)) {
        throw new SchemaError(`${path}: missing required field ${pyStr(key)}`);
      }
    }
    const properties = (schema.properties as { [key: string]: Schema } | undefined) ?? {};
    const unexpected = Object.keys(value).filter((k) => !(k in properties)).sort();
    if (unexpected.length > 0) {
      throw new SchemaError(`${path}: unexpected fields ${pyRepr(unexpected)}`);
    }
    for (const [key, sub] of Object.entries(properties)) {
      if (key in value) {
        validate(value[key], sub, `${path}.${key}`);
      }
    }
  }
  if (Array.isArray(value) && "items" in schema) {
    value.forEach((item, idx) => validate(item, schema.items as Schema, `${path}[${idx}]`));
  }
}

function atomicWrite(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpName = join(dirname(path), `${basename(path)}.${randomBytes(4).toString("hex")}`);
  try {
    const fd = openSync(tmpName, "wx", 0o600);
    try {
      writeSync(fd, content);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    renameSync(tmpName, path);
  } catch (err) {
    rmSync(tmpName, { force: true });
    throw err;
  }
}

class StateManager {
  constructor(public statePath: string, public schema: Schema) {}

  load(): Json {
    const raw = JSON.parse(readFileSync(this.statePath, "utf8")) as Json;
    validate(raw, this.schema);
    return raw;
  }

  commit(state: Json): void {
    validate(state, this.schema);
    atomicWrite(this.statePath, JSON.stringify(state, null, 2) + "\n");
  }
}

function main(): void {
  mkdirSync(WORK, { recursive: true });
  const schemaDir = join(WORK, "schemas");
  mkdirSync(schemaDir, { recursive: true });
  writeFileSync(join(schemaDir, "agent_state.schema.json"), JSON.stringify(STATE_SCHEMA, null, 2) + "\n");
  writeFileSync(join(schemaDir, "task_board.schema.json"), JSON.stringify(BOARD_SCHEMA, null, 2) + "\n");

  const statePath = join(WORK, "agent_state.json");
  const boardPath = join(WORK, "task_board.json");

  const mgr = new StateManager(statePath, STATE_SCHEMA);
  const boardMgr = new StateManager(boardPath, BOARD_SCHEMA);

  const initialState: Json = {
    schema_version: 1,
    active_task_id: null,
    touched_files: [],
    assumptions: [],
    blockers: [],
    next_action: "pick next task",
  };
  const initialBoard: Json = [
    {
      id: "T-001",
      goal: "validate /signup payloads",
      owner: "builder",
      acceptance: ["pytest -x test_app.py::test_signup_rejects_short_password"],
      status: "todo",
    },
  ];
  mgr.commit(initialState);
  boardMgr.commit(initialBoard);

  const state = mgr.load() as { [key: string]: Json };
  const board = boardMgr.load() as { [key: string]: Json }[];
  state.active_task_id = board[0].id;
  state.next_action = "read existing /signup handler";
  mgr.commit(state);

  console.log("state:", JSON.stringify(mgr.load(), null, 2));
  console.log("board:", JSON.stringify(boardMgr.load(), null, 2));

  const bad: { [key: string]: Json } = { ...state };
  bad.active_task_id = "T-bogus";
  try {
    mgr.commit(bad);
  } catch (exc) {
    if (!(exc instanceof SchemaError)) throw exc;
    console.log("rejected bad write:", exc.message);
  }
}

main();
