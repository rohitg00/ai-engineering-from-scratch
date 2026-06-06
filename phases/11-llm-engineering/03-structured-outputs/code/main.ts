// Phase 11 · Lesson 03 — Structured outputs (TypeScript port).
// Zod-shaped schema DSL + validator + mocked LLM extractor with retry.
// We inline the schema layer instead of pulling in zod so the lesson stays
// dep-free; the API (`.parse`, `.safeParse`) mirrors what real zod ships.
// Refs: https://zod.dev/?id=basic-usage
//       https://docs.anthropic.com/en/docs/build-with-claude/tool-use
//       https://platform.openai.com/docs/guides/structured-outputs

import process from "node:process";

type ValidationIssue = { path: string; message: string };
type ParseResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

// All schemas implement the same contract: take an unknown, return ParseResult.
interface Schema<T> {
  parse(input: unknown, path?: string): ParseResult<T>;
  toJSONSchema(): Record<string, unknown>;
}

function ok<T>(value: T): ParseResult<T> {
  return { ok: true, value };
}
function fail<T>(issues: ValidationIssue[]): ParseResult<T> {
  return { ok: false, issues };
}

class StringSchema implements Schema<string> {
  constructor(
    private opts: { enum?: readonly string[]; minLength?: number } = {},
  ) {}
  parse(input: unknown, path = ""): ParseResult<string> {
    if (typeof input !== "string") {
      return fail([{ path, message: `expected string, got ${typeof input}` }]);
    }
    if (this.opts.minLength !== undefined && input.length < this.opts.minLength) {
      return fail([{ path, message: `string shorter than ${this.opts.minLength}` }]);
    }
    if (this.opts.enum && !this.opts.enum.includes(input)) {
      return fail([
        { path, message: `${JSON.stringify(input)} not in [${this.opts.enum.join(", ")}]` },
      ]);
    }
    return ok(input);
  }
  toJSONSchema() {
    const out: Record<string, unknown> = { type: "string" };
    if (this.opts.enum) out.enum = [...this.opts.enum];
    if (this.opts.minLength !== undefined) out.minLength = this.opts.minLength;
    return out;
  }
}

class NumberSchema implements Schema<number> {
  constructor(private opts: { minimum?: number; maximum?: number; integer?: boolean } = {}) {}
  parse(input: unknown, path = ""): ParseResult<number> {
    if (typeof input !== "number" || Number.isNaN(input)) {
      return fail([{ path, message: `expected number, got ${typeof input}` }]);
    }
    if (this.opts.integer && !Number.isInteger(input)) {
      return fail([{ path, message: `expected integer, got ${input}` }]);
    }
    if (this.opts.minimum !== undefined && input < this.opts.minimum) {
      return fail([{ path, message: `${input} below minimum ${this.opts.minimum}` }]);
    }
    if (this.opts.maximum !== undefined && input > this.opts.maximum) {
      return fail([{ path, message: `${input} above maximum ${this.opts.maximum}` }]);
    }
    return ok(input);
  }
  toJSONSchema() {
    const out: Record<string, unknown> = { type: this.opts.integer ? "integer" : "number" };
    if (this.opts.minimum !== undefined) out.minimum = this.opts.minimum;
    if (this.opts.maximum !== undefined) out.maximum = this.opts.maximum;
    return out;
  }
}

class BoolSchema implements Schema<boolean> {
  parse(input: unknown, path = ""): ParseResult<boolean> {
    if (typeof input !== "boolean") {
      return fail([{ path, message: `expected boolean, got ${typeof input}` }]);
    }
    return ok(input);
  }
  toJSONSchema() {
    return { type: "boolean" };
  }
}

class ArraySchema<T> implements Schema<T[]> {
  constructor(
    private item: Schema<T>,
    private opts: { minItems?: number; maxItems?: number } = {},
  ) {}
  parse(input: unknown, path = ""): ParseResult<T[]> {
    if (!Array.isArray(input)) {
      return fail([{ path, message: `expected array, got ${typeof input}` }]);
    }
    if (this.opts.minItems !== undefined && input.length < this.opts.minItems) {
      return fail([{ path, message: `array length ${input.length} < ${this.opts.minItems}` }]);
    }
    if (this.opts.maxItems !== undefined && input.length > this.opts.maxItems) {
      return fail([{ path, message: `array length ${input.length} > ${this.opts.maxItems}` }]);
    }
    const issues: ValidationIssue[] = [];
    const out: T[] = [];
    for (let i = 0; i < input.length; i += 1) {
      const child = this.item.parse(input[i], `${path}[${i}]`);
      if (!child.ok) issues.push(...child.issues);
      else out.push(child.value);
    }
    return issues.length ? fail(issues) : ok(out);
  }
  toJSONSchema() {
    const out: Record<string, unknown> = { type: "array", items: this.item.toJSONSchema() };
    if (this.opts.minItems !== undefined) out.minItems = this.opts.minItems;
    if (this.opts.maxItems !== undefined) out.maxItems = this.opts.maxItems;
    return out;
  }
}

type ObjectShape = Record<string, { schema: Schema<unknown>; required: boolean }>;

class ObjectSchema<S extends ObjectShape> implements Schema<{ [K in keyof S]: unknown }> {
  constructor(private shape: S) {}
  parse(input: unknown, path = ""): ParseResult<{ [K in keyof S]: unknown }> {
    if (input === null || typeof input !== "object" || Array.isArray(input)) {
      return fail([{ path, message: `expected object, got ${typeof input}` }]);
    }
    const issues: ValidationIssue[] = [];
    const out: Record<string, unknown> = {};
    const record = input as Record<string, unknown>;
    for (const [key, field] of Object.entries(this.shape)) {
      const childPath = path ? `${path}.${key}` : key;
      if (!(key in record)) {
        if (field.required) issues.push({ path: childPath, message: "required field missing" });
        continue;
      }
      const child = field.schema.parse(record[key], childPath);
      if (!child.ok) issues.push(...child.issues);
      else out[key] = child.value;
    }
    return issues.length ? fail(issues) : ok(out as { [K in keyof S]: unknown });
  }
  toJSONSchema() {
    const properties: Record<string, unknown> = {};
    const required: string[] = [];
    for (const [key, field] of Object.entries(this.shape)) {
      properties[key] = field.schema.toJSONSchema();
      if (field.required) required.push(key);
    }
    return { type: "object", properties, required };
  }
}

const z = {
  string: (opts?: ConstructorParameters<typeof StringSchema>[0]) => new StringSchema(opts),
  number: (opts?: ConstructorParameters<typeof NumberSchema>[0]) => new NumberSchema(opts),
  integer: () => new NumberSchema({ integer: true }),
  boolean: () => new BoolSchema(),
  array: <T>(item: Schema<T>, opts?: ConstructorParameters<typeof ArraySchema>[1]) =>
    new ArraySchema(item, opts),
  object: <S extends ObjectShape>(shape: S) => new ObjectSchema(shape),
  field: <T>(schema: Schema<T>, required = true) => ({ schema: schema as Schema<unknown>, required }),
};

const ProductSchema = z.object({
  product: z.field(z.string({ minLength: 1 })),
  price: z.field(z.number({ minimum: 0 })),
  in_stock: z.field(z.boolean()),
  categories: z.field(z.array(z.string()), false),
});

// Mock LLM. First attempt for "headphones" is bad on purpose so the retry
// loop has something to do.
function simulateLLM(text: string, attempt: number): string {
  const t = text.toLowerCase();
  if (t.includes("headphones") || t.includes("sony")) {
    if (attempt === 0) {
      return 'Here is the JSON:\n```\n{"product": "Sony WH-1000XM5", "price": "348.00", "in_stock": true}\n```';
    }
    return '{"product": "Sony WH-1000XM5", "price": 348, "in_stock": true, "categories": ["audio", "headphones"]}';
  }
  if (t.includes("macbook") || t.includes("laptop")) {
    return '{"product": "MacBook Pro 16", "price": 2499, "in_stock": false, "categories": ["computers"]}';
  }
  if (t.includes("keyboard")) {
    return '{"product": "Keychron Q1", "price": 169, "in_stock": true, "categories": ["peripherals"]}';
  }
  return '{"product": "Unknown", "price": 0, "in_stock": false}';
}

// Strip the markdown fence + preamble that real models love to add.
function extractJSONBlock(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) return fence[1]!.trim();
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first >= 0 && last > first) return raw.slice(first, last + 1);
  return raw.trim();
}

type Product = { product: string; price: number; in_stock: boolean; categories?: string[] };

function extractWithRetry(text: string, maxRetries = 3): Product | null {
  for (let attempt = 0; attempt < maxRetries; attempt += 1) {
    const raw = simulateLLM(text, attempt);
    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJSONBlock(raw));
    } catch (err) {
      process.stdout.write(`    attempt ${attempt + 1}: json parse error — ${(err as Error).message}\n`);
      continue;
    }
    const result = ProductSchema.parse(parsed);
    if (result.ok) return result.value as Product;
    process.stdout.write(
      `    attempt ${attempt + 1}: schema errors — ${result.issues.map((i) => i.message).join("; ")}\n`,
    );
  }
  return null;
}

function runSchemaDemo(): void {
  process.stdout.write("=".repeat(60) + "\n  STEP 1: schema validation\n" + "=".repeat(60) + "\n");
  const cases: { data: unknown; label: string }[] = [
    { data: { product: "Sony WH-1000XM5", price: 348, in_stock: true }, label: "valid minimal" },
    { data: { product: "Test", price: -5, in_stock: true }, label: "negative price" },
    { data: { product: "Test", in_stock: true }, label: "missing price" },
    { data: { product: 123, price: 10, in_stock: true }, label: "number as product" },
    { data: { product: "Test", price: 10, in_stock: "yes" }, label: "string as boolean" },
  ];
  for (const c of cases) {
    const result = ProductSchema.parse(c.data);
    const status = result.ok ? "PASS" : `FAIL: ${result.issues.map((i) => i.message).join("; ")}`;
    process.stdout.write(`  ${c.label}: ${status}\n`);
  }
}

function runJSONSchemaDemo(): void {
  process.stdout.write("\n" + "=".repeat(60) + "\n  STEP 2: schema → JSON Schema (for provider APIs)\n" + "=".repeat(60) + "\n");
  process.stdout.write(JSON.stringify(ProductSchema.toJSONSchema(), null, 2) + "\n");
}

function runExtractionDemo(): void {
  process.stdout.write("\n" + "=".repeat(60) + "\n  STEP 3: extraction with retry\n" + "=".repeat(60) + "\n");
  const inputs = [
    "The Sony WH-1000XM5 headphones are priced at $348 and currently in stock.",
    "The new MacBook Pro 16 laptop costs $2499 but is sold out.",
    "I just bought a Keychron Q1 keyboard for $169.",
    "This sentence has no product information at all.",
  ];
  for (const text of inputs) {
    process.stdout.write(`\n  input: ${text.slice(0, 70)}...\n`);
    const result = extractWithRetry(text);
    process.stdout.write(`  output: ${result ? JSON.stringify(result) : "FAILED after retries"}\n`);
  }
}

function main(): void {
  runSchemaDemo();
  runJSONSchemaDemo();
  runExtractionDemo();
}

main();
