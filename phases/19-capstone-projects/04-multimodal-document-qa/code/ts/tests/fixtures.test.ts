import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIXTURES, getFixture, listFixtures } from "../src/fixtures.js";

describe("fixtures", () => {
  it("exposes the 10-K and Nature fixtures", () => {
    const ids = listFixtures().map((d) => d.id).sort();
    assert.deepEqual(ids, ["10k-acme-2025", "nature-paper-2026"]);
  });

  it("getFixture returns a known doc", () => {
    const doc = getFixture("10k-acme-2025");
    assert.ok(doc);
    assert.equal(doc.title, "Acme 10-K FY2025, Table 4");
    assert.equal(doc.pageWidth, 1224);
    assert.ok(doc.evidence.length >= 1);
  });

  it("getFixture returns undefined for unknown id", () => {
    assert.equal(getFixture("missing-doc-id"), undefined);
  });

  it("each evidence region has a positive-area bbox + score in [0,1]", () => {
    for (const doc of Object.values(FIXTURES)) {
      for (const e of doc.evidence) {
        assert.ok(e.bbox.w > 0 && e.bbox.h > 0, `bbox area must be > 0 in ${doc.id}`);
        assert.ok(e.score >= 0 && e.score <= 1, `score out of range in ${doc.id}`);
      }
    }
  });
});
