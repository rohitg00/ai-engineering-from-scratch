import { test } from "node:test";
import { strict as assert } from "node:assert";
import { BM25Index, DenseIndex, cosine, fakeEmbed, fnv1a, tokenize } from "../src/index_store.ts";
import { SAMPLE_CORPUS } from "../src/corpus.ts";
import { anchor } from "../src/types.ts";

test("tokenize: lowercases and splits on non-word characters", () => {
  assert.deepEqual(tokenize("Abort-Multipart_Upload!"), ["abort", "multipart_upload"]);
});

test("fnv1a: deterministic 32-bit unsigned output", () => {
  const a = fnv1a("hello");
  const b = fnv1a("hello");
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 0xffffffff);
});

test("fakeEmbed: returns a unit vector", () => {
  const v = fakeEmbed("authorization opa check");
  let norm = 0;
  for (const x of v) norm += x * x;
  assert.ok(Math.abs(Math.sqrt(norm) - 1.0) < 1e-9);
});

test("cosine: identical vectors give 1.0", () => {
  const v = fakeEmbed("rank fusion");
  assert.ok(Math.abs(cosine(v, v) - 1.0) < 1e-9);
});

test("BM25Index: ranks 'authorization' above unrelated S3 chunks", () => {
  const bm25 = new BM25Index();
  for (const c of SAMPLE_CORPUS) bm25.add(c);
  const hits = bm25.search("authorization check");
  assert.ok(hits.length > 0);
  const topAnchor = anchor(hits[0].chunk);
  assert.ok(
    topAnchor.startsWith("auth/"),
    `expected an auth/* chunk on top, got ${topAnchor}`,
  );
});

test("DenseIndex: returns top-k by cosine score, descending", () => {
  const dense = new DenseIndex();
  for (const c of SAMPLE_CORPUS) dense.add(c);
  const hits = dense.search("multipart upload abort", 3);
  assert.equal(hits.length, 3);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1].score >= hits[i].score);
  }
});
