// Lesson: Capstone 04: Multimodal Document QA (Vision-First PDF, Tables, Charts) (phase 19 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/04-multimodal-document-qa/docs/en.md
// Run: npx tsx phases/19-capstone-projects/04-multimodal-document-qa/code/main.ts

import { createHash } from "node:crypto";

class PyRandom {
  private mt = new Uint32Array(624);
  private mti = 625;
  private gaussNext: number | null = null;

  constructor(seed: number) {
    this.initByArray([seed >>> 0]);
  }

  private initGenrand(s: number): void {
    this.mt[0] = s >>> 0;
    for (this.mti = 1; this.mti < 624; this.mti++) {
      const prev = this.mt[this.mti - 1] ^ (this.mt[this.mti - 1] >>> 30);
      this.mt[this.mti] = (Math.imul(1812433253, prev) + this.mti) >>> 0;
    }
  }

  private initByArray(key: number[]): void {
    this.initGenrand(19650218);
    let i = 1;
    let j = 0;
    for (let k = Math.max(624, key.length); k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1664525)) + key[j] + j) >>> 0;
      i++;
      j++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
      if (j >= key.length) j = 0;
    }
    for (let k = 623; k > 0; k--) {
      const prev = this.mt[i - 1] ^ (this.mt[i - 1] >>> 30);
      this.mt[i] = ((this.mt[i] ^ Math.imul(prev, 1566083941)) - i) >>> 0;
      i++;
      if (i >= 624) {
        this.mt[0] = this.mt[623];
        i = 1;
      }
    }
    this.mt[0] = 0x80000000;
  }

  private genrand(): number {
    if (this.mti >= 624) {
      for (let kk = 0; kk < 624; kk++) {
        const y = (this.mt[kk] & 0x80000000) | (this.mt[(kk + 1) % 624] & 0x7fffffff);
        this.mt[kk] = this.mt[(kk + 397) % 624] ^ (y >>> 1) ^ (y & 1 ? 0x9908b0df : 0);
      }
      this.mti = 0;
    }
    let y = this.mt[this.mti++];
    y ^= y >>> 11;
    y ^= (y << 7) & 0x9d2c5680;
    y ^= (y << 15) & 0xefc60000;
    y ^= y >>> 18;
    return y >>> 0;
  }

  random(): number {
    const a = this.genrand() >>> 5;
    const b = this.genrand() >>> 6;
    return (a * 67108864 + b) / 9007199254740992;
  }

  gauss(mu: number, sigma: number): number {
    let z = this.gaussNext;
    this.gaussNext = null;
    if (z === null) {
      const x2pi = this.random() * 2 * Math.PI;
      const g2rad = Math.sqrt(-2.0 * Math.log(1.0 - this.random()));
      z = Math.cos(x2pi) * g2rad;
      this.gaussNext = Math.sin(x2pi) * g2rad;
    }
    return mu + z * sigma;
  }
}

const EMB_DIM = 16;

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\w+/g) ?? [];
}

function hashEmbed(tok: string): number[] {
  const rnd = new PyRandom(createHash("md5").update(tok, "utf8").digest().readUInt32BE(0));
  const v = Array.from({ length: EMB_DIM }, () => rnd.gauss(0, 1));
  let sq = 0;
  for (const x of v) sq += x * x;
  const n = Math.sqrt(sq) || 1.0;
  return v.map((x) => x / n);
}

class Page {
  patches: number[][] = [];
  constructor(public doc_id: string, public page_num: number, public content_tokens: string[]) {}

  embedPatches(): void {
    this.patches = this.content_tokens.map(hashEmbed);
  }
}

function docPrune(patches: number[][], keepFraction: number = 0.5): number[][] {
  const scored: [number, number[]][] = patches.map((p) => {
    let s = 0;
    for (const x of p) s += Math.abs(x);
    return [s, p];
  });
  scored.sort((x, y) => y[0] - x[0]);
  const keepN = Math.max(1, Math.trunc(scored.length * keepFraction));
  return scored.slice(0, keepN).map(([, p]) => p);
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) s += a[i] * b[i];
  return s;
}

function maxSimScore(queryTokens: number[][], docPatches: number[][]): number {
  let total = 0.0;
  for (const q of queryTokens) {
    let best = -1e9;
    for (const p of docPatches) {
      const s = dot(q, p);
      if (s > best) best = s;
    }
    total += best;
  }
  return total;
}

class Index {
  pages: Page[] = [];

  add(p: Page): void {
    this.pages.push(p);
  }

  retrieve(query: string, k: number = 5): [Page, number][] {
    const qTokens = tokenize(query).map(hashEmbed);
    const scored: [Page, number][] = this.pages.map((pg) => [pg, maxSimScore(qTokens, pg.patches)]);
    scored.sort((x, y) => y[1] - x[1]);
    return scored.slice(0, k);
  }
}

const CORPUS: [string, number, string][] = [
  ["10k-2024", 88, "segment EMEA operating margin 18.2 to 16.8 decline 140bp table four"],
  ["10k-2024", 92, "MDA operating performance EMEA macro headwinds FX impact narrative"],
  ["10k-2024", 14, "executive summary revenue growth 7 percent consolidated totals"],
  ["paper-vidore-v3", 3, "late interaction multi vector retrieval ColPali ColQwen benchmark"],
  ["paper-vidore-v3", 7, "nDCG results table vision first vs OCR then text columns"],
  ["paper-m3docrag", 2, "M3DocVQA multi page reasoning evaluation protocol"],
  ["handwritten-lab", 5, "experiment notes circuit board pH readings handwritten"],
  ["handwritten-lab", 6, "graph with annotated error bars figure 3 caption"],
  ["chart-report", 11, "line chart revenue by segment EMEA americas APAC Q1 Q4"],
  ["chart-report", 12, "bar chart operating margin by segment with 2023 2024 comparison"],
];

function buildIndex(prune: boolean = true): Index {
  const idx = new Index();
  for (const [doc, page, text] of CORPUS) {
    const p = new Page(doc, page, tokenize(text));
    p.embedPatches();
    if (prune) p.patches = docPrune(p.patches, 0.5);
    idx.add(p);
  }
  return idx;
}

function signed(x: number, digits: number): string {
  return (x >= 0 ? "+" : "") + x.toFixed(digits);
}

function main(): void {
  console.log("=== build index with DocPruner (50% patches) ===");
  const idx = buildIndex(true);
  console.log(`pages indexed: ${idx.pages.length}`);

  const queries = [
    "what was the 2024 operating margin change for EMEA",
    "late interaction retrieval vs OCR",
    "handwritten experimental figures with error bars",
    "bar chart comparing segment margins",
  ];

  for (const q of queries) {
    console.log(`\nQ: ${q}`);
    const hits = idx.retrieve(q, 3);
    for (const [pg, score] of hits) console.log(`  score=${signed(score, 3)}  ${pg.doc_id} p.${pg.page_num}`);
  }

  console.log("\n=== ablation: pruning off vs on ===");
  const full = buildIndex(false);
  const pruned = buildIndex(true);
  const q = "chart comparing segment margins";
  const fullTop = full.retrieve(q, 3).map(([p]) => [p.doc_id, p.page_num] as [string, number]);
  const prnTop = pruned.retrieve(q, 3).map(([p]) => [p.doc_id, p.page_num] as [string, number]);
  const fmt = (xs: [string, number][]): string => "[" + xs.map(([d, n]) => `('${d}', ${n})`).join(", ") + "]";
  console.log(`  full    top-3 : ${fmt(fullTop)}`);
  console.log(`  pruned  top-3 : ${fmt(prnTop)}`);
  const fullKeys = new Set(fullTop.map(([d, n]) => `${d}|${n}`));
  const overlap = new Set(prnTop.map(([d, n]) => `${d}|${n}`).filter((key) => fullKeys.has(key))).size;
  console.log(`  overlap       : ${overlap}/3`);
}

main();
