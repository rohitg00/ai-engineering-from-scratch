import test from "node:test";
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE!, "main.ts")).href
);

const t = { id: "T", message: "update account" };
test("read plan selects lookup", () =>
  assert.equal(
    m.makePlan({ ticket: t, intent: "read", topic: "account" }).actions[0].tool,
    "lookup",
  ));
test("write requires approval", () =>
  assert.equal(
    m.makePlan({ ticket: t, intent: "write", topic: "account" })
      .requiresApproval,
    true,
  ));
test("unknown intent rejected", () =>
  assert.throws(() =>
    m.makePlan({ ticket: t, intent: "admin", topic: "account" }),
  ));
test("unknown tool rejected", () =>
  assert.throws(() =>
    m.validatePlan({
      ticket: t,
      actions: [{ tool: "shell", query: "x" }],
      requiresApproval: false,
    }),
  ));
test("forged approval flag rejected", () =>
  assert.throws(
    () =>
      m.validatePlan({
        ticket: t,
        actions: [{ tool: "update", query: "x" }],
        requiresApproval: false,
      }),
    /approval/,
  ));
test("empty action list rejected", () =>
  assert.throws(() =>
    m.validatePlan({ ticket: t, actions: [], requiresApproval: false }),
  ));
