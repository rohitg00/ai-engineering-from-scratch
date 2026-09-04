import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildIndices, rrf, runQuery } from "../src/retrieval.ts";
import { SAMPLE_CORPUS } from "../src/corpus.ts";
import { anchor } from "../src/types.ts";

test("rrf: fuses overlapping ranks above singleton ranks", () => {
  const a = SAMPLE_CORPUS[0];
  const b = SAMPLE_CORPUS[1];
  const c = SAMPLE_CORPUS[2];
  const fused = rrf(
    [
      { chunk: a, score: 0.9 },
      { chunk: b, score: 0.8 },
    ],
    [
      { chunk: a, score: 1.0 },
      { chunk: c, score: 0.5 },
    ],
  );
  assert.equal(anchor(fused[0].chunk), anchor(a));
  assert.ok(fused.length === 3);
});

test("rrf: rank-1 in both lists beats rank-2 singletons", () => {
  const a = SAMPLE_CORPUS[0];
  const b = SAMPLE_CORPUS[1];
  const fused = rrf(
    [{ chunk: a, score: 1.0 }],
    [{ chunk: a, score: 1.0 }],
  );
  assert.equal(fused.length, 1);
  const fusedScore = fused[0].score;
  const single = rrf([{ chunk: b, score: 1.0 }], []);
  assert.ok(fusedScore > single[0].score);
});

test("runQuery: returns citations for a real corpus question", () => {
  const { dense, bm25 } = buildIndices();
  const r = runQuery("how is rank fusion implemented", dense, bm25);
  assert.ok(r.citations.length > 0);
  assert.ok(r.fusedTop.length > 0);
  assert.equal(r.query, "how is rank fusion implemented");
});

test("runQuery: top citation for auth query lands in auth repo", () => {
  const { dense, bm25 } = buildIndices();
  const r = runQuery("authorization check_permission", dense, bm25);
  assert.ok(r.citations[0].anchor.startsWith("auth/"));
});

test("runQuery: fusedTop honours topK parameter", () => {
  const { dense, bm25 } = buildIndices();
  const r = runQuery("authorization", dense, bm25, 2);
  assert.ok(r.fusedTop.length <= 2);
  assert.ok(r.citations.length <= 2);
});
