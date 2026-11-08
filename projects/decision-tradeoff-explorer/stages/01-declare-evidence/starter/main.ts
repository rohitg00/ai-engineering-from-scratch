export type Criterion = {
  id: string;
  label: string;
  weight: number;
  direction: "benefit" | "cost";
  min: number;
  max: number;
  limit?: number;
};
export type Option = {
  id: string;
  label: string;
  values: Record<string, number | null>;
  notes: Record<string, string>;
};
export type Decision = { criteria: Criterion[]; options: Option[] };
export function parse(text: string): Decision {
  throw Error("TODO stage 1: validate evidence");
}
export function normalize(c: Criterion, v: number): number {
  throw Error("TODO stage 2: normalize");
}
export function score(
  data: Decision,
  weights: Record<string, number> = {},
): any[] {
  throw Error("TODO stage 2: score");
}
export function dominated(data: Decision): string[] {
  throw Error("TODO stage 3: dominance");
}
export function sensitivity(data: Decision, id: string, steps = 10): any[] {
  throw Error("TODO stage 3: sensitivity");
}
export function record(
  data: Decision,
  weights: Record<string, number> = {},
  chosen?: string,
): any {
  throw Error("TODO stage 4: decision record");
}
export function csv(data: Decision): string {
  throw Error("TODO stage 4: CSV");
}
export function html(data: Decision): string {
  throw Error("TODO stage 4: board");
}
