export type Finding = {
  file: string;
  line: number;
  quote: string;
  rule: string;
  severity: number;
};
export type Review = { reviewer: string; findings: Finding[] };
export type Reviewer = {
  id: string;
  cost: number;
  run: (signal: AbortSignal) => Promise<Finding[]>;
};

import { pathToFileURL } from "node:url";
import path from "node:path";

export function validateFinding(
  raw: unknown,
  files: Record<string, string[]>,
): any {
  throw new Error("Not implemented: validateFinding");
}
export function aggregate(
  reviews: Review[],
  files: Record<string, string[]>,
  quorum = 2,
): any {
  throw new Error("Not implemented: aggregate");
}
export async function runPanel(
  reviewers: Reviewer[],
  budget: number,
  timeoutMs = 1000,
): Promise<any> {
  throw new Error("Not implemented: runPanel");
}
export function evaluate(predicted: string[], expected: string[]): any {
  throw new Error("Not implemented: evaluate");
}
