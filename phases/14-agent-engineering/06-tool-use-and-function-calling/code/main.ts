// Phase 14 Lesson 06 — tool use and function calling, in TypeScript.
//
// Stdlib tool registry with JSON Schema subset validation and parallel dispatch.
// Subset: required fields, string/integer/number/boolean/array/object,
// enum, minimum/maximum. Every validation failure becomes a structured
// observation so an agent can retry.
//
// References:
//   OpenAI function-calling   https://platform.openai.com/docs/guides/function-calling
//   Anthropic tool-use        https://docs.anthropic.com/en/docs/build-with-claude/tool-use
//   JSON Schema 2020-12       https://json-schema.org/draft/2020-12
//
// Run: npx tsx code/main.ts

type Primitive = "integer" | "number" | "boolean" | "string" | "array" | "object";

type PropSchema = {
  type: Primitive;
  enum?: unknown[];
  minimum?: number;
  maximum?: number;
};

type ToolInputSchema = {
  type: "object";
  properties: Record<string, PropSchema>;
  required?: string[];
};

type ToolArgs = Record<string, unknown>;

type ToolDef = {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
  executor: (args: ToolArgs) => string;
  timeoutMs?: number;
};

type ToolCall = {
  toolUseId: string;
  name: string;
  args: ToolArgs;
};

type ToolResult = {
  toolUseId: string;
  ok: boolean;
  content: string;
};

function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  if (typeof value === "number" && Number.isInteger(value)) return "integer";
  return typeof value;
}

function coerce(value: unknown, schema: PropSchema): { value: unknown; error: string | null } {
  const t = schema.type;
  if (t === "integer") {
    if (typeof value === "number" && Number.isInteger(value)) return { value, error: null };
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isInteger(parsed)) return { value: parsed, error: null };
      return { value, error: `cannot coerce string ${JSON.stringify(value)} to integer` };
    }
    return { value, error: `expected integer, got ${describeType(value)}` };
  }
  if (t === "number") {
    if (typeof value === "number") return { value, error: null };
    if (typeof value === "string") {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return { value: parsed, error: null };
      return { value, error: `cannot coerce string ${JSON.stringify(value)} to number` };
    }
    return { value, error: `expected number, got ${describeType(value)}` };
  }
  if (t === "boolean") {
    if (typeof value === "boolean") return { value, error: null };
    return { value, error: `expected boolean, got ${describeType(value)}` };
  }
  if (t === "string") {
    if (typeof value === "string") return { value, error: null };
    return { value, error: `expected string, got ${describeType(value)}` };
  }
  if (t === "array") {
    if (Array.isArray(value)) return { value, error: null };
    return { value, error: `expected array, got ${describeType(value)}` };
  }
  if (t === "object") {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      return { value, error: null };
    }
    return { value, error: `expected object, got ${describeType(value)}` };
  }
  return { value, error: null };
}

function validate(args: ToolArgs, schema: ToolInputSchema): { out: ToolArgs; errors: string[] } {
  const errors: string[] = [];
  const props = schema.properties;
  const required = schema.required ?? [];
  const out: ToolArgs = {};

  for (const name of required) {
    if (!(name in args)) errors.push(`missing required: ${name}`);
  }

  for (const [name, value] of Object.entries(args)) {
    const prop = props[name];
    if (!prop) {
      errors.push(`unknown field: ${name}`);
      continue;
    }
    const { value: coerced, error } = coerce(value, prop);
    if (error) {
      errors.push(`${name}: ${error}`);
      continue;
    }
    if (prop.enum && !prop.enum.includes(coerced as never)) {
      errors.push(`${name}: ${JSON.stringify(coerced)} not in ${JSON.stringify(prop.enum)}`);
      continue;
    }
    if (prop.type === "number" || prop.type === "integer") {
      const numVal = coerced as number;
      if (prop.minimum !== undefined && numVal < prop.minimum) {
        errors.push(`${name}: ${numVal} < minimum ${prop.minimum}`);
        continue;
      }
      if (prop.maximum !== undefined && numVal > prop.maximum) {
        errors.push(`${name}: ${numVal} > maximum ${prop.maximum}`);
        continue;
      }
    }
    out[name] = coerced;
  }

  return { out, errors };
}

class ToolRegistry {
  private tools = new Map<string, ToolDef>();

  register(tool: ToolDef): void {
    this.tools.set(tool.name, tool);
  }

  catalog(): Array<Pick<ToolDef, "name" | "description" | "inputSchema">> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }

  dispatch(call: ToolCall): ToolResult {
    const tool = this.tools.get(call.name);
    if (!tool) {
      return { toolUseId: call.toolUseId, ok: false, content: `error: unknown tool ${JSON.stringify(call.name)}` };
    }
    const { out, errors } = validate(call.args, tool.inputSchema);
    if (errors.length > 0) {
      return {
        toolUseId: call.toolUseId,
        ok: false,
        content: `validation error: ${errors.join("; ")}`,
      };
    }
    try {
      return { toolUseId: call.toolUseId, ok: true, content: tool.executor(out) };
    } catch (err) {
      const e = err as Error;
      return {
        toolUseId: call.toolUseId,
        ok: false,
        content: `execution error: ${e.name}: ${e.message}`,
      };
    }
  }

  dispatchMany(calls: ToolCall[]): ToolResult[] {
    return calls.map((c) => this.dispatch(c));
  }
}

function add(args: ToolArgs): string {
  const a = args.a as number;
  const b = args.b as number;
  return String(a + b);
}

function multiply(args: ToolArgs): string {
  const a = args.a as number;
  const b = args.b as number;
  return String(a * b);
}

function classify(args: ToolArgs): string {
  return `classified as ${args.status as string}`;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("TOOL USE and FUNCTION CALLING — Phase 14, Lesson 06 (TypeScript port)");
  console.log("=".repeat(70));

  const reg = new ToolRegistry();
  reg.register({
    name: "add",
    description: "Add two integers a and b. Use for any integer addition.",
    inputSchema: {
      type: "object",
      properties: { a: { type: "integer" }, b: { type: "integer" } },
      required: ["a", "b"],
    },
    executor: add,
  });
  reg.register({
    name: "multiply",
    description: "Multiply two integers a and b. Prefer multiplication over looped addition.",
    inputSchema: {
      type: "object",
      properties: { a: { type: "integer" }, b: { type: "integer" } },
      required: ["a", "b"],
    },
    executor: multiply,
  });
  reg.register({
    name: "classify",
    description: "Classify a status as one of the allowed labels.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["open", "closed", "pending"] },
      },
      required: ["status"],
    },
    executor: classify,
  });

  console.log("\ncatalog (as presented to the model)");
  for (const entry of reg.catalog()) {
    console.log(`  - ${entry.name}: ${entry.description}`);
  }

  const calls: ToolCall[] = [
    { toolUseId: "u01", name: "add", args: { a: 2, b: 3 } },
    { toolUseId: "u02", name: "multiply", args: { a: "4", b: 5 } },
    { toolUseId: "u03", name: "classify", args: { status: "in_progress" } },
    { toolUseId: "u04", name: "classify", args: { status: "open" } },
    { toolUseId: "u05", name: "subtract", args: { a: 1, b: 2 } },
  ];

  console.log("\nparallel dispatch (5 calls in one turn)");
  for (const result of reg.dispatchMany(calls)) {
    const tag = result.ok ? "OK " : "ERR";
    console.log(`  ${result.toolUseId} ${tag}: ${result.content}`);
  }

  console.log();
  console.log("observation shape: every validation failure is a structured error");
  console.log("string the agent can read and retry against. never raise to the loop.");
}

main();
