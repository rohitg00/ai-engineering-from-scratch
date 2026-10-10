import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { pathToFileURL } from "node:url";
const m = await import(
  pathToFileURL(path.join(process.env.PROJECT_WORKSPACE, "main.ts")).href
);
const items = [
    {
      id: "a",
      longitude: 77,
      latitude: 12,
      timestamp: "2026-01-01T00:00:00Z",
      note: "<script>bad</script>",
    },
    {
      id: "b",
      longitude: 78,
      latitude: 13,
      timestamp: "2026-01-01T00:00:00Z",
      note: "shade",
    },
  ],
  groups = {
    radiusMeters: 1,
    groups: [
      { id: "a", members: ["a"] },
      { id: "b", members: ["b"] },
    ],
    edges: [],
  },
  review = {
    schemaVersion: 1,
    groups: groups.groups,
    decisions: { a: "pending", b: "pending" },
  };
test("valid GeoJSON coordinate order", () =>
  assert.deepEqual(
    m.exportGeoJSON(items, review).features[0].geometry.coordinates,
    [77, 12],
  ));
test("preserves every observation", () =>
  assert.equal(m.exportGeoJSON(items, review).features.length, 2));
test("retains evidence properties", () =>
  assert.equal(
    m.exportGeoJSON(items, review).features[1].properties.note,
    "shade",
  ));
test("JSON roundtrip consumable", () =>
  assert.equal(
    JSON.parse(JSON.stringify(m.exportGeoJSON(items, review))).type,
    "FeatureCollection",
  ));
test("heldout map text escaped", () => {
  const h = m.renderMap(items, groups, review);
  assert.ok(!h.includes("<script>bad</script>"));
  assert.ok(h.includes("group-review.json"));
});
test("empty map remains finite", () =>
  assert.ok(
    !m
      .renderMap(
        [],
        { radiusMeters: 1, groups: [], edges: [] },
        { schemaVersion: 1, groups: [], decisions: {} },
      )
      .includes("NaN"),
  ));
