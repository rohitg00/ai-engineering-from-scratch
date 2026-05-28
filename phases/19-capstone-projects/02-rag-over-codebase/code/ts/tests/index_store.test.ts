import { test } from "node:test";
import { strict as assert } from "node:assert";
import { BM25Index, DenseIndex, cosine, fakeEmbed, fnv1a, tokenize } from "../src/index_store.ts";
import { SAMPLE_CORPUS } from "../src/corpus.ts";
import { anchor } from "../src/types.ts";

test("tokenize: lowercase 化し non-word character で分割する", () => {
  assert.deepEqual(tokenize("Abort-Multipart_Upload!"), ["abort", "multipart_upload"]);
});

test("fnv1a: deterministic な 32-bit unsigned output を返す", () => {
  const a = fnv1a("hello");
  const b = fnv1a("hello");
  assert.equal(a, b);
  assert.ok(a >= 0 && a <= 0xffffffff);
});

test("fakeEmbed: unit vector を返す", () => {
  const v = fakeEmbed("authorization opa check");
  let norm = 0;
  for (const x of v) norm += x * x;
  assert.ok(Math.abs(Math.sqrt(norm) - 1.0) < 1e-9);
});

test("cosine: identical vector は 1.0 を返す", () => {
  const v = fakeEmbed("rank fusion");
  assert.ok(Math.abs(cosine(v, v) - 1.0) < 1e-9);
});

test("BM25Index: 'authorization' を unrelated S3 chunk より上に rank する", () => {
  const bm25 = new BM25Index();
  for (const c of SAMPLE_CORPUS) bm25.add(c);
  const hits = bm25.search("authorization check");
  assert.ok(hits.length > 0);
  const topAnchor = anchor(hits[0].chunk);
  assert.ok(
    topAnchor.startsWith("auth/"),
    `top は auth/* chunk の想定でしたが、${topAnchor} でした`,
  );
});

test("DenseIndex: cosine score 降順で top-k を返す", () => {
  const dense = new DenseIndex();
  for (const c of SAMPLE_CORPUS) dense.add(c);
  const hits = dense.search("multipart upload abort", 3);
  assert.equal(hits.length, 3);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1].score >= hits[i].score);
  }
});
