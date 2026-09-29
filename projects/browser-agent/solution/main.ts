/*
 * Browser Agent reference implementation.
 * Follow stages in projects/browser-agent/stages/.
 * The demo is deterministic and requires no provider credentials.
 * Protocol references are listed in the project README.
 */
import { pathToFileURL } from "node:url";
import path from "node:path";

import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promises as fs } from "node:fs";
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
export function parseObservation(raw: unknown): Observation {
  if (!raw || typeof raw !== "object") throw new Error("invalid observation");
  const o = raw as Observation;
  new URL(o.url);
  if (
    !Array.isArray(o.fields) ||
    !Array.isArray(o.buttons) ||
    typeof o.done !== "boolean"
  )
    throw new Error("invalid observation");
  const ids = new Set<string>();
  for (const el of [...o.fields, ...o.buttons]) {
    if (
      !/^[a-z][a-z0-9_-]*$/i.test(el.id) ||
      ids.has(el.id) ||
      typeof el.label !== "string" ||
      typeof el.disabled !== "boolean"
    )
      throw new Error("invalid element");
    ids.add(el.id);
  }
  for (const f of o.fields)
    if (typeof f.value !== "string") throw new Error("invalid field");
  for (const b of o.buttons)
    if (typeof b.dangerous !== "boolean") throw new Error("invalid button");
  return o;
}
export function choose(observation: Observation, task: Task): Action {
  const o = parseObservation(observation);
  if (new URL(o.url).origin !== task.allowedOrigin)
    return { kind: "blocked", reason: "origin changed" };
  if (!task.name.trim() || !/^\S+@\S+\.\S+$/.test(task.email))
    return { kind: "blocked", reason: "invalid task" };
  const desired = task.fields ?? [
    { label: "Full name", value: task.name },
    { label: "Email address", value: task.email },
  ];
  if (
    !desired.length ||
    desired.some((row) => !row.label.trim() || !row.value.trim()) ||
    new Set(desired.map((row) => row.label.toLowerCase())).size !==
      desired.length
  )
    return { kind: "blocked", reason: "invalid task fields" };
  for (const { label, value } of desired) {
    const fields = o.fields.filter(
      (f) => f.label.trim().toLowerCase() === label.trim().toLowerCase(),
    );
    if (fields.length !== 1 || fields[0].disabled)
      return { kind: "blocked", reason: "missing or ambiguous field" };
    if (fields[0].value !== value)
      return o.done
        ? { kind: "blocked", reason: "completion values disagree" }
        : { kind: "fill", id: fields[0].id, value };
  }
  if (o.done) return { kind: "done" };
  const buttons = o.buttons.filter(
    (b) =>
      b.label.trim().toLowerCase() ===
        (task.submitLabel ?? "Save request").toLowerCase() &&
      !b.disabled &&
      !b.dangerous,
  );
  return buttons.length === 1
    ? { kind: "click", id: buttons[0].id }
    : { kind: "blocked", reason: "unsafe or ambiguous submit" };
}
export function inspectPNG(file: string): {
  width: number;
  height: number;
  greenFraction: number;
} {
  return JSON.parse(
    execFileSync(
      "python3",
      [fileURLToPath(new URL("./pixels.py", import.meta.url)), file],
      { encoding: "utf8", maxBuffer: 10000 },
    ),
  );
}
export async function runAgent(driver: Driver, task: Task, maxSteps = 5) {
  if (!Number.isInteger(maxSteps) || maxSteps < 1 || maxSteps > 100)
    throw new Error("invalid step budget");
  const trace: { step: number; action: Action }[] = [];
  let previous = "";
  for (let step = 1; step <= maxSteps; step++) {
    const o = await driver.observe();
    const action = choose(o, task);
    trace.push({ step, action });
    if (action.kind === "blocked")
      return { status: "blocked", reason: action.reason, trace };
    if (action.kind === "done") {
      let screenshot: string | null = null;
      try {
        screenshot = await driver.capture();
        const visual = inspectPNG(screenshot);
        return {
          status: visual.greenFraction > 0.0005 ? "complete" : "visual-mismatch",
          trace,
          visual,
          screenshot,
        };
      } catch (error) {
        return {
          status: "screenshot-error",
          reason: error instanceof Error ? error.message : String(error),
          trace,
          screenshot,
        };
      }
    }
    const signature = JSON.stringify(o);
    if (signature === previous) return { status: "stalled", trace };
    previous = signature;
    await driver.act(action);
  }
  return { status: "budget-exhausted", trace };
}
export class FixtureDriver implements Driver {
  observation: Observation;
  screenshot: string;
  actions: Action[] = [];
  constructor(screenshot: string) {
    this.screenshot = screenshot;
    this.observation = {
      url: "http://127.0.0.1:8877/fixture.html",
      fields: [
        { id: "name", label: "Full name", value: "", disabled: false },
        { id: "email", label: "Email address", value: "", disabled: false },
      ],
      buttons: [
        {
          id: "save",
          label: "Save request",
          disabled: false,
          dangerous: false,
        },
      ],
      done: false,
    };
  }
  async observe() {
    return structuredClone(this.observation);
  }
  async act(action: Action) {
    this.actions.push(action);
    if (action.kind === "fill") {
      const field = this.observation.fields.find((f) => f.id === action.id);
      if (!field) throw new Error("stale element");
      field.value = action.value;
    } else if (action.kind === "click") {
      if (action.id !== "save" || this.observation.fields.some((f) => !f.value))
        throw new Error("invalid submit");
      this.observation.done = true;
    }
  }
  async capture() {
    return this.screenshot;
  }
}
const snapshotScript = `JSON.stringify({url:location.href,fields:[...document.querySelectorAll('input[id]')].map(e=>({id:e.id,label:document.querySelector('label[for="'+e.id+'"]')?.textContent||e.getAttribute('aria-label')||'',value:e.value,disabled:e.disabled})),buttons:[...document.querySelectorAll('button[id]')].map(e=>({id:e.id,label:e.textContent.trim(),disabled:e.disabled,dangerous:e.dataset.dangerous==='true'})),done:document.querySelector('#status')?.dataset.state==='done'})`;
export class GstackDriver implements Driver {
  binary: string;
  screenshot: string;
  invoke: (args: string[]) => string;
  constructor(
    binary: string,
    screenshot: string,
    invoke?: (args: string[]) => string,
  ) {
    this.binary = binary;
    this.screenshot = path.resolve(screenshot);
    this.invoke =
      invoke ??
      ((args) =>
        execFileSync(binary, args, {
          encoding: "utf8",
          timeout: 20000,
          maxBuffer: 1000000,
        }));
  }
  async observe() {
    const text = this.invoke(["js", snapshotScript]);
    const first = text.indexOf("{"),
      last = text.lastIndexOf("}");
    if (first < 0 || last < first) throw new Error("no browser snapshot");
    return parseObservation(JSON.parse(text.slice(first, last + 1)));
  }
  async act(action: Action) {
    if (action.kind !== "fill" && action.kind !== "click")
      throw new Error("action is not executable");
    if (!/^[a-z][a-z0-9_-]*$/i.test(action.id))
      throw new Error("invalid element id");
    this.invoke(
      action.kind === "fill"
        ? ["fill", "#" + action.id, action.value]
        : ["click", "#" + action.id],
    );
  }
  async capture() {
    this.invoke(["screenshot", this.screenshot]);
    return this.screenshot;
  }
}
export function scoreRuns(statuses: string[]) {
  return {
    tasks: statuses.length,
    completed: statuses.filter((s) => s === "complete").length,
    successRate: statuses.length
      ? statuses.filter((s) => s === "complete").length / statuses.length
      : 0,
  };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const live = process.argv.includes("--live");
  const screenshot = fileURLToPath(new URL("./success.png", import.meta.url));
  let driver: Driver;
  if (live) {
    const binary = process.env.BROWSE_BIN;
    if (!binary)
      throw new Error(
        "Set BROWSE_BIN to the gstack browse executable; navigate to fixture.html first",
      );
    driver = new GstackDriver(binary, "browser-result.png");
  } else driver = new FixtureDriver(screenshot);
  const result = await runAgent(driver, {
    name: "Ada Lovelace",
    email: "ada@example.test",
    allowedOrigin: process.env.FIXTURE_ORIGIN ?? "http://127.0.0.1:8877",
  });
  console.log(
    JSON.stringify(
      {
        mode: live
          ? "real Chromium via gstack"
          : "deterministic fixture backend",
        ...result,
        score: scoreRuns([result.status]),
      },
      null,
      2,
    ),
  );
}
