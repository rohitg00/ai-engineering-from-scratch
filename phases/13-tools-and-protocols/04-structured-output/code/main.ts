// Lesson: Structured Output: JSON Schema, Pydantic, Zod, Constrained Decoding (phase 13 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/04-structured-output/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/04-structured-output/code/main.ts

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };

function pyJsonString(s: string): string {
  return JSON.stringify(s).replace(/[\u0080-￿]/g, (c) => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));
}

function pyJsonDumps(value: Json): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyJsonString(value);
  if (Array.isArray(value)) return "[" + value.map(pyJsonDumps).join(", ") + "]";
  return "{" + Object.keys(value).map((k) => pyJsonString(k) + ": " + pyJsonDumps(value[k])).join(", ") + "}";
}

class JSONDecodeError extends Error {
  constructor(msg: string, doc: string, pos: number) {
    const lineno = doc.slice(0, pos).split("\n").length;
    const colno = pos - doc.lastIndexOf("\n", pos - 1);
    super(`${msg}: line ${lineno} column ${colno} (char ${pos})`);
  }
}

const NUMBER_RE = /(-?(?:0|[1-9]\d*))(\.\d+)?([eE][-+]?\d+)?/y;
const WS = " \t\n\r";
const ESCAPES: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };

function pyJsonLoads(s: string): Json {
  let i = 0;
  const skip = (): void => {
    while (i < s.length && WS.includes(s[i])) i++;
  };

  const parseString = (): string => {
    const begin = i - 1;
    let out = "";
    for (;;) {
      if (i >= s.length) throw new JSONDecodeError("Unterminated string starting at", s, begin);
      const c = s[i];
      if (c === '"') {
        i++;
        return out;
      }
      if (c === "\\") {
        const esc = s[i + 1];
        if (esc === undefined) throw new JSONDecodeError("Unterminated string starting at", s, begin);
        if (esc === "u") {
          const hex = s.slice(i + 2, i + 6);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw new JSONDecodeError("Invalid \\uXXXX escape", s, i + 1);
          out += String.fromCharCode(parseInt(hex, 16));
          i += 6;
          continue;
        }
        if (!(esc in ESCAPES)) throw new JSONDecodeError("Invalid \\escape", s, i);
        out += ESCAPES[esc];
        i += 2;
        continue;
      }
      if (c.charCodeAt(0) < 0x20) throw new JSONDecodeError("Invalid control character at", s, i);
      out += c;
      i++;
    }
  };

  const parseValue = (): Json => {
    const c = s[i];
    if (c === '"') {
      i++;
      return parseString();
    }
    if (c === "{") {
      i++;
      return parseObject();
    }
    if (c === "[") {
      i++;
      return parseArray();
    }
    if (s.startsWith("null", i)) {
      i += 4;
      return null;
    }
    if (s.startsWith("true", i)) {
      i += 4;
      return true;
    }
    if (s.startsWith("false", i)) {
      i += 5;
      return false;
    }
    NUMBER_RE.lastIndex = i;
    const m = NUMBER_RE.exec(s);
    if (m) {
      i += m[0].length;
      return Number(m[0]);
    }
    throw new JSONDecodeError("Expecting value", s, i);
  };

  const parseObject = (): JsonObject => {
    const obj: JsonObject = {};
    skip();
    if (s[i] === "}") {
      i++;
      return obj;
    }
    if (s[i] !== '"') throw new JSONDecodeError("Expecting property name enclosed in double quotes", s, i);
    for (;;) {
      i++;
      const key = parseString();
      skip();
      if (s[i] !== ":") throw new JSONDecodeError("Expecting ':' delimiter", s, i);
      i++;
      skip();
      obj[key] = parseValue();
      skip();
      if (s[i] === "}") {
        i++;
        return obj;
      }
      if (s[i] !== ",") throw new JSONDecodeError("Expecting ',' delimiter", s, i);
      i++;
      skip();
      if (s[i] !== '"') throw new JSONDecodeError("Expecting property name enclosed in double quotes", s, i);
    }
  };

  const parseArray = (): Json[] => {
    const arr: Json[] = [];
    skip();
    if (s[i] === "]") {
      i++;
      return arr;
    }
    for (;;) {
      arr.push(parseValue());
      skip();
      if (s[i] === "]") {
        i++;
        return arr;
      }
      if (s[i] !== ",") throw new JSONDecodeError("Expecting ',' delimiter", s, i);
      i++;
      skip();
    }
  };

  skip();
  const value = parseValue();
  skip();
  if (i !== s.length) throw new JSONDecodeError("Extra data", s, i);
  return value;
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === quote) out += "\\" + c;
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else out += c;
  }
  return quote + out + quote;
}

function pyRepr(value: Json): string {
  if (value === null) return "None";
  if (typeof value === "boolean") return value ? "True" : "False";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return pyStrRepr(value);
  if (Array.isArray(value)) return "[" + value.map(pyRepr).join(", ") + "]";
  return "{" + Object.keys(value).map((k) => pyStrRepr(k) + ": " + pyRepr(value[k])).join(", ") + "}";
}

function pyTypeName(value: Json): string {
  if (value === null) return "NoneType";
  if (typeof value === "boolean") return "bool";
  if (typeof value === "number") return Number.isInteger(value) ? "int" : "float";
  if (typeof value === "string") return "str";
  if (Array.isArray(value)) return "list";
  return "dict";
}

function isObject(value: Json | undefined): value is JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

const INVOICE_SCHEMA: JsonObject = {
  type: "object",
  properties: {
    customer: {
      type: "string",
      minLength: 1,
      maxLength: 200,
    },
    line_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sku: { type: "string", pattern: "^[A-Z0-9-]+$" },
          qty: { type: "integer", minimum: 1 },
          unit_usd: { type: "number", minimum: 0 },
        },
        required: ["sku", "qty", "unit_usd"],
        additionalProperties: false,
      },
    },
    total_usd: { type: "number", minimum: 0 },
    currency: { type: "string", enum: ["USD", "EUR", "INR"] },
  },
  required: ["customer", "line_items", "total_usd", "currency"],
  additionalProperties: false,
};

class ValidationError {
  constructor(
    public path: string,
    public message: string,
  ) {}

  toString(): string {
    return `${this.path}: ${this.message}`;
  }
}

function validate(schema: JsonObject, value: Json, path: string = "$"): ValidationError[] {
  const errors: ValidationError[] = [];
  const t = schema["type"];
  if (t === "object") {
    if (!isObject(value)) return [new ValidationError(path, `expected object, got ${pyTypeName(value)}`)];
    const required = (schema["required"] ?? []) as string[];
    const props = (schema["properties"] ?? {}) as JsonObject;
    for (const field of required) {
      if (!(field in value)) errors.push(new ValidationError(`${path}.${field}`, "missing required field"));
    }
    if (schema["additionalProperties"] === false) {
      const extras = Object.keys(value).filter((k) => !(k in props));
      for (const extra of extras) errors.push(new ValidationError(`${path}.${extra}`, "additional property not allowed"));
    }
    for (const [key, sub] of Object.entries(props)) {
      if (key in value) errors.push(...validate(sub as JsonObject, value[key], `${path}.${key}`));
    }
    return errors;
  }
  if (t === "array") {
    if (!Array.isArray(value)) return [new ValidationError(path, `expected array, got ${pyTypeName(value)}`)];
    const item_schema = schema["items"];
    if (item_schema !== undefined && item_schema !== null) {
      value.forEach((item, i) => errors.push(...validate(item_schema as JsonObject, item, `${path}[${i}]`)));
    }
    return errors;
  }
  if (t === "string") {
    if (typeof value !== "string") {
      errors.push(new ValidationError(path, `expected string, got ${pyTypeName(value)}`));
      return errors;
    }
    const length = [...value].length;
    if ("minLength" in schema && length < (schema["minLength"] as number)) {
      errors.push(new ValidationError(path, `shorter than minLength ${schema["minLength"]}`));
    }
    if ("maxLength" in schema && length > (schema["maxLength"] as number)) {
      errors.push(new ValidationError(path, `longer than maxLength ${schema["maxLength"]}`));
    }
    if ("pattern" in schema) {
      const re = new RegExp(schema["pattern"] as string, "y");
      if (!re.test(value)) {
        errors.push(new ValidationError(path, `does not match pattern ${pyStrRepr(schema["pattern"] as string)}`));
      }
    }
  } else if (t === "number") {
    if (typeof value !== "number") {
      errors.push(new ValidationError(path, `expected number, got ${pyTypeName(value)}`));
      return errors;
    }
  } else if (t === "integer") {
    if (typeof value !== "number" || !Number.isInteger(value)) {
      errors.push(new ValidationError(path, `expected integer, got ${pyTypeName(value)}`));
      return errors;
    }
  } else if (t === "boolean") {
    if (typeof value !== "boolean") {
      errors.push(new ValidationError(path, `expected boolean, got ${pyTypeName(value)}`));
      return errors;
    }
  }
  const numeric = typeof value === "number" || typeof value === "boolean" ? Number(value) : null;
  if ("minimum" in schema && numeric !== null && numeric < (schema["minimum"] as number)) {
    errors.push(new ValidationError(path, `below minimum ${schema["minimum"]}`));
  }
  if ("maximum" in schema && numeric !== null && numeric > (schema["maximum"] as number)) {
    errors.push(new ValidationError(path, `above maximum ${schema["maximum"]}`));
  }
  if ("enum" in schema && !(schema["enum"] as Json[]).some((e) => e === value)) {
    errors.push(new ValidationError(path, `value ${pyRepr(value)} not in enum ${pyRepr(schema["enum"] as Json)}`));
  }
  return errors;
}

class ParsedResult {
  constructor(
    public kind: string,
    public payload: Json,
    public errors: ValidationError[],
  ) {}
}

function process_model_output(raw: string, schema: JsonObject): ParsedResult {
  if (raw.startsWith("__REFUSAL__")) {
    return new ParsedResult("refusal", raw.slice("__REFUSAL__".length).trim(), []);
  }
  let parsed: Json;
  try {
    parsed = pyJsonLoads(raw);
  } catch (e) {
    return new ParsedResult("parse_error", null, [new ValidationError("$", (e as Error).message)]);
  }
  const errs = validate(schema, parsed);
  if (errs.length > 0) return new ParsedResult("violation", parsed, errs);
  return new ParsedResult("ok", parsed, []);
}

const TEST_CASES: [string, string][] = [
  [
    "happy path",
    pyJsonDumps({
      customer: "Acme Corp",
      line_items: [
        { sku: "ABC-123", qty: 2, unit_usd: 49.99 },
        { sku: "XYZ-9", qty: 1, unit_usd: 120.0 },
      ],
      total_usd: 219.98,
      currency: "USD",
    }),
  ],
  ["parse error (trailing comma)", '{"customer": "Acme", "line_items": [], "total_usd": 0, "currency": "USD",}'],
  [
    "schema violation (extra field, bad sku)",
    pyJsonDumps({
      customer: "Acme",
      line_items: [{ sku: "abc_123", qty: 1, unit_usd: 10, discount: 0.1 }],
      total_usd: 10,
      currency: "USD",
    }),
  ],
  ["schema violation (missing required)", pyJsonDumps({ customer: "Acme", line_items: [] })],
  ["refusal (model declined)", "__REFUSAL__ The provided text is a song lyric, not an invoice."],
];

function main(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 04 - STRUCTURED OUTPUT");
  console.log("=".repeat(72));
  console.log("\nInvoice schema keys:", pyRepr(Object.keys(INVOICE_SCHEMA["properties"] as JsonObject)));
  console.log();

  for (const [name, raw] of TEST_CASES) {
    console.log("-".repeat(72));
    console.log(`TEST : ${name}`);
    console.log(`  raw: ${[...raw].slice(0, 80).join("")}...`);
    const result = process_model_output(raw, INVOICE_SCHEMA);
    console.log(`  kind: ${result.kind}`);
    if (result.kind === "ok") {
      const payload = result.payload as JsonObject;
      console.log(`  payload customer = ${payload["customer"]}`);
      console.log(`  total_usd        = ${payload["total_usd"]}`);
    } else if (result.kind === "refusal") {
      console.log(`  reason: ${result.payload}`);
    } else {
      for (const e of result.errors) console.log(`  error: ${e}`);
    }
    console.log();
  }

  console.log("summary: strict-mode eliminates parse_error and violation branches");
  console.log("at the provider level; your code still handles refusal as typed outcome.");
}

main();

export {};
