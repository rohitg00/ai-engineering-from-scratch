// Lesson: Tool Registry with Schema Validation (phase 19 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/21-tool-registry-schema-validation/docs/en.md
// Run: npx tsx phases/19-capstone-projects/21-tool-registry-schema-validation/code/main.ts

type Schema = Record<string, unknown>;

const PRIMITIVE_TYPES = new Set(["string", "integer", "number", "boolean", "object", "array", "null"]);

const ALLOWED_KEYWORDS = new Set([
  "type", "properties", "required", "enum",
  "minLength", "maxLength", "pattern", "items", "description",
]);

function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = quote;
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return out + quote;
}

function pyRepr(v: unknown): string {
  if (v === null || v === undefined) return "None";
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return pyStr(v);
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  if (isDict(v)) return "{" + Object.entries(v).map(([k, x]) => `${pyStr(k)}: ${pyRepr(x)}`).join(", ") + "}";
  return String(v);
}

function pyTypeName(v: unknown): string {
  if (v === null || v === undefined) return "NoneType";
  if (typeof v === "boolean") return "bool";
  if (typeof v === "number") return Number.isInteger(v) ? "int" : "float";
  if (typeof v === "string") return "str";
  if (Array.isArray(v)) return "list";
  if (isDict(v)) return "dict";
  return typeof v;
}

function pyLen(s: string): number {
  return [...s].length;
}

function isNonNegInt(v: unknown): boolean {
  return typeof v === "number" && Number.isInteger(v) && v >= 0;
}

class ValidationError {
  constructor(public path: string, public keyword: string, public message: string) {}

  toDict(): Record<string, string> {
    return { path: this.path, keyword: this.keyword, message: this.message };
  }
}

class Ok {}

type Handler = (...args: never[]) => unknown;

class ToolRecord {
  constructor(
    public name: string,
    public description: string,
    public schema: Schema,
    public handler: Handler,
    public idempotent = false,
    public timeoutMs = 30_000,
  ) {}
}

interface RegisterOptions {
  name: string;
  schema: Schema;
  handler: Handler;
  description?: string;
  idempotent?: boolean;
  timeoutMs?: number;
  override?: boolean;
}

class ToolRegistry {
  private static NAME_RE = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)*$/;
  private records: Map<string, ToolRecord> = new Map();
  private order: string[] = [];

  register(opts: RegisterOptions): ToolRecord {
    const { name, schema, handler, description = "", idempotent = false, timeoutMs = 30_000, override = false } = opts;
    if (!ToolRegistry.NAME_RE.test(name)) {
      throw new Error(`tool name ${pyStr(name)} must match ${ToolRegistry.NAME_RE.source}`);
    }
    if (this.records.has(name) && !override) {
      throw new Error(`tool ${pyStr(name)} already registered; pass override=True to replace`);
    }
    validateSchemaShape(schema);
    const rec = new ToolRecord(name, description, schema, handler, idempotent, timeoutMs);
    if (!this.records.has(name)) this.order.push(name);
    this.records.set(name, rec);
    return rec;
  }

  get(name: string): ToolRecord {
    const rec = this.records.get(name);
    if (rec === undefined) throw new Error(`unknown tool ${pyStr(name)}`);
    return rec;
  }

  names(): string[] {
    return [...this.order];
  }

  validate(name: string, args: unknown): Ok | ValidationError[] {
    const rec = this.get(name);
    const errors: ValidationError[] = [];
    walk(rec.schema, args, "", errors);
    if (errors.length > 0) return errors;
    return new Ok();
  }
}

function validateSchemaShape(schema: unknown): void {
  if (!isDict(schema)) throw new Error("schema must be a dict");
  const unknown = Object.keys(schema).filter((k) => !ALLOWED_KEYWORDS.has(k));
  if (unknown.length > 0) {
    throw new Error(`unsupported schema keywords: ${pyRepr(unknown.sort())}`);
  }
  const t = schema.type;
  if (t !== undefined && t !== null && !(typeof t === "string" && PRIMITIVE_TYPES.has(t))) {
    throw new Error(`unsupported type: ${pyRepr(t)}`);
  }
  const enumVals = schema.enum;
  if (enumVals !== undefined && enumVals !== null && !Array.isArray(enumVals)) {
    throw new Error("enum must be a list");
  }
  const minLen = schema.minLength;
  if (minLen !== undefined && minLen !== null && !isNonNegInt(minLen)) {
    throw new Error("minLength must be a non-negative integer");
  }
  const maxLen = schema.maxLength;
  if (maxLen !== undefined && maxLen !== null && !isNonNegInt(maxLen)) {
    throw new Error("maxLength must be a non-negative integer");
  }
  if (typeof minLen === "number" && typeof maxLen === "number" && minLen > maxLen) {
    throw new Error("minLength cannot be greater than maxLength");
  }
  const pattern = schema.pattern;
  if (pattern !== undefined && pattern !== null && typeof pattern !== "string") {
    throw new Error("pattern must be a string");
  }
  const props = schema.properties;
  if (props !== undefined && props !== null) {
    if (!isDict(props)) throw new Error("properties must be a dict");
    for (const psub of Object.values(props)) validateSchemaShape(psub);
  }
  const items = schema.items;
  if (items !== undefined && items !== null) validateSchemaShape(items);
  const req = schema.required;
  if (req !== undefined && req !== null) {
    if (!Array.isArray(req) || !req.every((x) => typeof x === "string")) {
      throw new Error("required must be list[str]");
    }
  }
}

function joinPath(prefix: string, segment: string | number): string {
  const seg = String(segment).replace(/~/g, "~0").replace(/\//g, "~1");
  return `${prefix}/${seg}`;
}

function typeMatches(value: unknown, expected: string): boolean {
  switch (expected) {
    case "string": return typeof value === "string";
    case "integer": return typeof value === "number" && Number.isInteger(value);
    case "number": return typeof value === "number";
    case "boolean": return typeof value === "boolean";
    case "object": return isDict(value);
    case "array": return Array.isArray(value);
    case "null": return value === null;
    default: throw new Error(`KeyError: ${pyStr(expected)}`);
  }
}

function pyEquals(a: unknown, b: unknown): boolean {
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) {
    if ((typeof a === "number" || typeof a === "boolean") && (typeof b === "number" || typeof b === "boolean")) {
      return Number(a) === Number(b);
    }
    return a === b;
  }
  return JSON.stringify(a) === JSON.stringify(b);
}

function walk(schema: Schema, value: unknown, path: string, errs: ValidationError[]): void {
  const t = schema.type as string | undefined;
  if (t !== undefined && t !== null && !typeMatches(value, t)) {
    errs.push(new ValidationError(path || "/", "type", `expected ${t}, got ${pyTypeName(value)}`));
    return;
  }
  if ("enum" in schema) {
    const enumVals = schema.enum as unknown[];
    if (!enumVals.some((e) => pyEquals(value, e))) {
      errs.push(new ValidationError(path || "/", "enum", `value ${pyRepr(value)} not in ${pyRepr(enumVals)}`));
      return;
    }
  }
  if (t === "string") checkString(schema, value as string, path, errs);
  else if (t === "object") checkObject(schema, value as Record<string, unknown>, path, errs);
  else if (t === "array") checkArray(schema, value as unknown[], path, errs);
}

function checkString(schema: Schema, value: string, path: string, errs: ValidationError[]): void {
  const len = pyLen(value);
  if ("minLength" in schema && len < (schema.minLength as number)) {
    errs.push(new ValidationError(path || "/", "minLength", `length ${len} < minLength ${schema.minLength}`));
  }
  if ("maxLength" in schema && len > (schema.maxLength as number)) {
    errs.push(new ValidationError(path || "/", "maxLength", `length ${len} > maxLength ${schema.maxLength}`));
  }
  if ("pattern" in schema) {
    const pattern = schema.pattern as string;
    let re: RegExp | null = null;
    try {
      re = new RegExp(pattern, "u");
    } catch (exc) {
      errs.push(new ValidationError(path || "/", "pattern", `invalid regex: ${(exc as Error).message}`));
    }
    if (re !== null && !re.test(value)) {
      errs.push(new ValidationError(path || "/", "pattern",
        `value ${pyRepr(value)} does not match pattern ${pyRepr(pattern)}`));
    }
  }
}

function checkObject(schema: Schema, value: Record<string, unknown>, path: string, errs: ValidationError[]): void {
  const required = (schema.required as string[] | undefined) ?? [];
  for (const reqName of required) {
    if (!(reqName in value)) {
      errs.push(new ValidationError(joinPath(path, reqName), "required", `missing required property ${pyRepr(reqName)}`));
    }
  }
  const props = (schema.properties as Record<string, Schema> | undefined) ?? {};
  for (const [propName, propValue] of Object.entries(value)) {
    if (Object.prototype.hasOwnProperty.call(props, propName)) {
      walk(props[propName], propValue, joinPath(path, propName), errs);
    }
  }
}

function checkArray(schema: Schema, value: unknown[], path: string, errs: ValidationError[]): void {
  const itemsSchema = schema.items as Schema | undefined;
  if (itemsSchema === undefined || itemsSchema === null) return;
  value.forEach((item, idx) => walk(itemsSchema, item, joinPath(path, idx), errs));
}

function demo(): void {
  const registry = new ToolRegistry();

  const getUser = (id: number) => ({ id, name: "ada" });

  registry.register({
    name: "db.get_user",
    description: "Fetch a user record by id.",
    schema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "integer" },
        fields: {
          type: "array",
          items: { type: "string", enum: ["id", "name", "email"] },
        },
      },
    },
    handler: getUser,
    idempotent: true,
  });

  const cases: Record<string, unknown>[] = [
    { id: 42, fields: ["id", "name"] },
    { id: "forty-two" },
    { fields: ["id"] },
    { id: 1, fields: ["id", "phone"] },
  ];
  const report: Record<string, unknown>[] = [];
  for (const c of cases) {
    const result = registry.validate("db.get_user", c);
    if (result instanceof Ok) {
      report.push({ args: c, ok: true });
    } else {
      report.push({ args: c, ok: false, errors: result.map((e) => e.toDict()) });
    }
  }
  console.log(JSON.stringify({ tools: registry.names(), cases: report }, null, 2));
}

demo();

export {};
