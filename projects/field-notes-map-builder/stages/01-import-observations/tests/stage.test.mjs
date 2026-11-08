import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const x = {
  id: "a",
  longitude: 77,
  latitude: 12,
  timestamp: "2026-10-01T08:00:00Z",
  note: "bench",
};
test("preserves evidence", () =>
  assert.deepEqual(m.importObservations([x]), [x]));
test("poles and dateline are valid boundaries", () =>
  assert.equal(
    m.importObservations([{ ...x, latitude: 90, longitude: -180 }])[0].latitude,
    90,
  ));
test("out of bounds rejected", () =>
  assert.throws(
    () => m.importObservations([{ ...x, longitude: 181 }]),
    /Coordinates/,
  ));
test("impossible date rejected", () =>
  assert.throws(
    () => m.importObservations([{ ...x, timestamp: "2026-02-30T00:00:00Z" }]),
    /timestamp/,
  ));
test("heldout numeric string rejected", () =>
  assert.throws(
    () => m.importObservations([{ ...x, latitude: "12" }]),
    /Coordinates/,
  ));
test("unsafe photo rejected", () =>
  assert.throws(
    () => m.importObservations([{ ...x, photo: "javascript:evil()" }]),
    /Photo/,
  ));
