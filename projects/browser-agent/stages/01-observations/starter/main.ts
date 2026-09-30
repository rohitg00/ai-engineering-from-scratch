export type Field = {
  id: string;
  label: string;
  value: string;
  disabled: boolean;
};
export type Button = {
  id: string;
  label: string;
  disabled: boolean;
  dangerous: boolean;
};
export type Observation = {
  url: string;
  fields: Field[];
  buttons: Button[];
  done: boolean;
};
export type Task = {
  name: string;
  email: string;
  allowedOrigin: string;
  fields?: { label: string; value: string }[];
  submitLabel?: string;
};
export type Action =
  | { kind: "fill"; id: string; value: string }
  | { kind: "click"; id: string }
  | { kind: "done" }
  | { kind: "blocked"; reason: string };
export type Driver = {
  observe: () => Promise<Observation>;
  act: (action: Action) => Promise<void>;
  capture: () => Promise<string>;
};

import { pathToFileURL } from "node:url";
import path from "node:path";

export function parseObservation(raw: unknown): any {
  throw new Error("Not implemented: parseObservation");
}
export function choose(observation: Observation, task: Task): any {
  throw new Error("Not implemented: choose");
}
export function inspectPNG(file: string): any {
  throw new Error("Not implemented: inspectPNG");
}
export async function runAgent(
  driver: Driver,
  task: Task,
  maxSteps = 5,
): Promise<any> {
  throw new Error("Not implemented: runAgent");
}
export class FixtureDriver implements Driver {
  observation!: Observation;
  screenshot: string;
  actions: Action[] = [];
  constructor(screenshot: string) {
    this.screenshot = screenshot;
  }
  async observe(): Promise<Observation> {
    throw new Error("Not implemented: fixture observation");
  }
  async act(action: Action): Promise<void> {
    throw new Error("Not implemented: fixture transition");
  }
  async capture(): Promise<string> {
    throw new Error("Not implemented: fixture capture");
  }
}
export class GstackDriver {
  constructor(
    binary: string,
    screenshot: string,
    invoke?: (args: string[]) => string,
  ) {}
  async observe(): Promise<any> {
    throw new Error("Not implemented: observe");
  }
  async act(action: Action): Promise<void> {
    throw new Error("Not implemented: act");
  }
  async capture(): Promise<string> {
    throw new Error("Not implemented: capture");
  }
}
export function scoreRuns(statuses: string[]): any {
  throw new Error("Not implemented: scoreRuns");
}
