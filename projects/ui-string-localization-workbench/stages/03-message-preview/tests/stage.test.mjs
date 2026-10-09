import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
test("interpolates ordinary values", () =>
  assert.equal(
    m.previewMessage("Hello {name}", { name: "Lina" }),
    "Hello Lina",
  ));
test("keeps missing variables visible", () =>
  assert.equal(m.previewMessage("{count} tools", {}), "{count} tools"));
test("supports zero numeric value", () =>
  assert.equal(m.previewMessage("{count}", { count: 0 }), "0"));
test("replaces repeated variables", () =>
  assert.equal(m.previewMessage("{x} / {x}", { x: "a" }), "a / a"));
test("heldout inherited value ignored", () =>
  assert.equal(
    m.previewMessage("{name}", Object.create({ name: "hidden" })),
    "{name}",
  ));
test("markup is returned as text for escaping boundary", () =>
  assert.equal(
    m.previewMessage("{name}", { name: "<b>Lina</b>" }),
    "<b>Lina</b>",
  ));
