import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIXTURES, getFixture, listFixtures } from "../src/fixtures.js";

describe("fixtures", () => {
  it("10-K と Nature の fixture を expose する", () => {
    const ids = listFixtures().map((d) => d.id).sort();
    assert.deepEqual(ids, ["10k-acme-2025", "nature-paper-2026"]);
  });

  it("getFixture は known doc を返す", () => {
    const doc = getFixture("10k-acme-2025");
    assert.ok(doc);
    assert.equal(doc.title, "Acme 10-K FY2025, Table 4");
    assert.equal(doc.pageWidth, 1224);
    assert.ok(doc.evidence.length >= 1);
  });

  it("getFixture は unknown id に undefined を返す", () => {
    assert.equal(getFixture("missing-doc-id"), undefined);
  });

  it("各 evidence region は positive-area bbox と [0,1] の score を持つ", () => {
    for (const doc of Object.values(FIXTURES)) {
      for (const e of doc.evidence) {
        assert.ok(e.bbox.w > 0 && e.bbox.h > 0, `${doc.id} の bbox area は > 0 である必要があります`);
        assert.ok(e.score >= 0 && e.score <= 1, `${doc.id} の score が範囲外です`);
      }
    }
  });
});
