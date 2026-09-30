/*
 * JSON Schema Output Guard reference implementation.
 * Follow stages in projects/json-schema-output-guard/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

export type Schema = {
  type?:
    | "object"
    | "array"
    | "string"
    | "number"
    | "integer"
    | "boolean"
    | "null";
  properties?: Record<string, Schema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: Schema;
  minItems?: number;
  maxItems?: number;
  minLength?: number;
  minimum?: number;
  maximum?: number;
  enum?: unknown[];
};
export type Issue = { path: string; message: string };
const supported = new Set([
  "type",
  "properties",
  "required",
  "additionalProperties",
  "items",
  "minItems",
  "maxItems",
  "minLength",
  "minimum",
  "maximum",
  "enum",
]);
export function checkSchema(schema: Schema, depth = 0): void {
  if (
    depth > 32 ||
    !schema ||
    typeof schema !== "object" ||
    Array.isArray(schema)
  )
    throw new Error("invalid or excessively deep schema");
  for (const key of Object.keys(schema))
    if (!supported.has(key))
      throw new Error(`unsupported schema keyword: ${key}`);
  if (
    schema.type !== undefined &&
    ![
      "object",
      "array",
      "string",
      "number",
      "integer",
      "boolean",
      "null",
    ].includes(schema.type)
  )
    throw new Error("unsupported schema type");
  for (const key of [
    "minimum",
    "maximum",
    "minLength",
    "minItems",
    "maxItems",
  ] as const) {
    const n = schema[key];
    if (
      n !== undefined &&
      (!Number.isFinite(n) ||
        (["minLength", "minItems", "maxItems"].includes(key) &&
          (!Number.isInteger(n) || n < 0)))
    )
      throw new Error(`invalid schema ${key}`);
  }
  if (
    schema.required !== undefined &&
    (!Array.isArray(schema.required) ||
      schema.required.some((k) => typeof k !== "string") ||
      new Set(schema.required).size !== schema.required.length)
  )
    throw new Error("invalid required keys");
  if (
    schema.additionalProperties !== undefined &&
    typeof schema.additionalProperties !== "boolean"
  )
    throw new Error("invalid additionalProperties");
  if (
    schema.enum !== undefined &&
    (!Array.isArray(schema.enum) || !schema.enum.length)
  )
    throw new Error("nonempty enum required");
  if (schema.properties !== undefined) {
    if (
      !schema.properties ||
      typeof schema.properties !== "object" ||
      Array.isArray(schema.properties)
    )
      throw new Error("invalid properties");
    for (const child of Object.values(schema.properties))
      checkSchema(child, depth + 1);
  }
  if (schema.items !== undefined) checkSchema(schema.items, depth + 1);
}
export function parseJSON(raw: string): unknown {
  if (Buffer.byteLength(raw) > 100_000) throw new Error("output too large");
  return JSON.parse(raw);
}
export function validate(
  value: unknown,
  schema: Schema,
  pointer = "$",
  depth = 0,
): Issue[] {
  if (depth === 0) checkSchema(schema);
  if (depth > 32) return [{ path: pointer, message: "depth limit" }];
  for (const key of Object.keys(schema))
    if (!supported.has(key))
      throw new Error(`unsupported schema keyword: ${key}`);
  const issues: Issue[] = [];
  const fail = (message: string) => issues.push({ path: pointer, message });
  const kind =
    value === null ? "null" : Array.isArray(value) ? "array" : typeof value;
  if (
    schema.type &&
    !(schema.type === "integer"
      ? typeof value === "number" && Number.isInteger(value)
      : kind === schema.type)
  ) {
    fail(`expected ${schema.type}`);
    return issues;
  }
  if (typeof value === "number" && !Number.isFinite(value))
    fail("must be finite");
  if (schema.enum && !schema.enum.some((x) => isDeepStrictEqual(x, value)))
    fail("not in enum");
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum)
      fail("below minimum");
    if (schema.maximum !== undefined && value > schema.maximum)
      fail("above maximum");
  }
  if (
    typeof value === "string" &&
    schema.minLength !== undefined &&
    [...value].length < schema.minLength
  )
    fail("too short");
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems)
      fail("too few items");
    if (schema.maxItems !== undefined && value.length > schema.maxItems)
      fail("too many items");
    if (schema.items)
      value.forEach((v, i) =>
        issues.push(
          ...validate(v, schema.items!, `${pointer}/${i}`, depth + 1),
        ),
      );
  }
  if (kind === "object") {
    const obj = value as Record<string, unknown>;
    const props = schema.properties ?? {};
    for (const key of schema.required ?? [])
      if (!Object.hasOwn(obj, key))
        issues.push({
          path: `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
          message: "required",
        });
    for (const [key, v] of Object.entries(obj)) {
      const child = `${pointer}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`;
      if (Object.hasOwn(props, key))
        issues.push(...validate(v, props[key], child, depth + 1));
      else if (schema.additionalProperties === false)
        issues.push({ path: child, message: "unknown property" });
    }
  }
  return issues;
}
export function guard(
  raw: string,
  schema: Schema,
): { ok: boolean; value?: unknown; issues: Issue[] } {
  checkSchema(schema);
  let value: unknown;
  try {
    value = parseJSON(raw);
  } catch (e) {
    return {
      ok: false,
      issues: [{ path: "$", message: (e as Error).message }],
    };
  }
  const issues = validate(value, schema);
  return issues.length ? { ok: false, issues } : { ok: true, value, issues };
}
export async function repair(
  generate: (feedback: Issue[], attempt: number) => Promise<string>,
  schema: Schema,
  maxAttempts = 3,
) {
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10)
    throw new Error("attempt budget must be 1..10");
  checkSchema(schema);
  let issues: Issue[] = [];
  const trace: { attempt: number; accepted: boolean; issues: Issue[] }[] = [];
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = guard(await generate(issues, attempt), schema);
    issues = result.issues;
    trace.push({ attempt, accepted: result.ok, issues });
    if (result.ok) return { status: "accepted", value: result.value, trace };
  }
  return { status: "exhausted", trace };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const schema: Schema = {
    type: "object",
    properties: {
      answer: { type: "string", minLength: 1 },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    required: ["answer", "confidence"],
    additionalProperties: false,
  };
  const outputs = [
    '{"answer":"bounded repair","confidence":1.5}',
    '{"answer":"bounded repair","confidence":0.9}',
  ];
  console.log(
    JSON.stringify(
      await repair(async (_, i) => outputs[i - 1], schema),
      null,
      2,
    ),
  );
}
