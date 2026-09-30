export type Span = {
  id: string;
  parent?: string;
  name: string;
  start: number;
  end: number;
  status: "ok" | "error";
  tokens: number;
};
import { pathToFileURL } from "node:url";
import path from "node:path";

export function parseTrace(raw: string): any[] {
  throw new Error("Not implemented: parseTrace");
}
export function validateTree(spans: Span[]): any {
  throw new Error("Not implemented: validateTree");
}
export function unionDuration(intervals: [number, number][]): number {
  throw new Error("Not implemented: unionDuration");
}
export function analyze(spans: Span[]): any {
  throw new Error("Not implemented: analyze");
}
export function render(spans: Span[]): string {
  throw new Error("Not implemented: render");
}
