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
import { pathToFileURL } from "node:url";
import path from "node:path";

export function parseJSON(raw: string): unknown {
  throw new Error("Not implemented: parseJSON");
}
export function validate(value: unknown, schema: unknown): unknown[] {
  throw new Error("Not implemented: validate");
}
export function guard(raw: string, schema: unknown): unknown {
  throw new Error("Not implemented: guard");
}
export async function repair(
  generate: (feedback: Issue[], attempt: number) => Promise<string>,
  schema: Schema,
  maxAttempts = 3,
): Promise<unknown> {
  throw new Error("Not implemented: repair");
}
