import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const p = (id, longitude) => ({
  id,
  longitude,
  latitude: 0,
  timestamp: "2026-01-01T00:00:00Z",
  note: id,
});
test("zero self distance", () =>
  assert.equal(m.distanceMeters(p("a", 0), p("a", 0)), 0));
test("one equatorial degree about 111195m", () =>
  assert.ok(Math.abs(m.distanceMeters(p("a", 0), p("b", 1)) - 111195.08) < 1));
test("transitive groups retain pair evidence", () => {
  const r = m.groupNearby([p("a", 0), p("b", 0.001), p("c", 0.002)], 120);
  assert.deepEqual(r.groups, [{ id: "a", members: ["a", "b", "c"] }]);
  assert.equal(r.edges.length, 2);
});
test("zero radius keeps separate locations", () =>
  assert.equal(m.groupNearby([p("a", 0), p("b", 0.001)], 0).groups.length, 2));
test("heldout antimeridian neighbors", () =>
  assert.ok(m.distanceMeters(p("a", 179.999), p("b", -179.999)) < 223));
test("bad radius rejected", () =>
  assert.throws(() => m.groupNearby([], NaN), /Radius/));
