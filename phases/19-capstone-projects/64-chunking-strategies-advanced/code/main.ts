// Lesson: Chunking Strategies, Compared (phase 19 / lesson 64)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/64-chunking-strategies-advanced/docs/en.md
// Run: npx tsx phases/19-capstone-projects/64-chunking-strategies-advanced/code/main.ts

export class Chunk {
  constructor(
    public docId: string,
    public strategy: string,
    public start: number,
    public end: number,
    public text: string,
  ) {}

  overlaps(goldStart: number, goldEnd: number): boolean {
    return !(this.end <= goldStart || this.start >= goldEnd);
  }
}

export function fixedWindow(docId: string, text: string, size = 400, overlap = 80): Chunk[] {
  if (size <= 0) {
    throw new Error("size must be positive");
  }
  if (overlap < 0 || overlap >= size) {
    throw new Error("overlap must be non-negative and smaller than size");
  }
  const out: Chunk[] = [];
  const step = size - overlap;
  let i = 0;
  const n = text.length;
  while (i < n) {
    const end = Math.min(i + size, n);
    out.push(new Chunk(docId, "fixed", i, end, text.slice(i, end)));
    if (end === n) {
      break;
    }
    i += step;
  }
  return out;
}

const SENTENCE_BOUNDARY = /(?<=[.!?])\s+(?=[A-Z0-9])/g;

export type Span = [number, number, string];

export function splitSentences(text: string): Span[] {
  const out: Span[] = [];
  let cursor = 0;
  for (const m of text.matchAll(SENTENCE_BOUNDARY)) {
    const end = m.index ?? 0;
    if (end > cursor) {
      out.push([cursor, end, text.slice(cursor, end)]);
    }
    cursor = end + m[0].length;
  }
  if (cursor < text.length) {
    out.push([cursor, text.length, text.slice(cursor)]);
  }
  return out;
}

export function sentenceChunks(docId: string, text: string, target = 500): Chunk[] {
  const sents = splitSentences(text);
  const out: Chunk[] = [];
  let curStart: number | null = null;
  let curEnd = 0;
  let curBuf: string[] = [];
  let curLen = 0;
  for (const [sStart, sEnd, sText] of sents) {
    if (curStart === null) {
      curStart = sStart;
    }
    const sep = curBuf.length > 0 ? " " : "";
    const added = sep.length + sText.length;
    if (curLen + added > target && curBuf.length > 0) {
      out.push(new Chunk(docId, "sentence", curStart, curEnd, curBuf.join(" ")));
      curStart = sStart;
      curBuf = [sText];
      curLen = sText.length;
      curEnd = sEnd;
      continue;
    }
    curBuf.push(sText);
    curLen += added;
    curEnd = sEnd;
  }
  if (curBuf.length > 0 && curStart !== null) {
    out.push(new Chunk(docId, "sentence", curStart, curEnd, curBuf.join(" ")));
  }
  return out;
}

export const DEFAULT_SEPARATORS: string[] = ["\n\n", "\n", ". ", " "];

function recursiveSplitSpans(text: string, baseOffset: number, separators: string[], target: number): Span[] {
  if (text.length <= target || separators.length === 0) {
    if (!text) {
      return [];
    }
    return [[baseOffset, baseOffset + text.length, text]];
  }
  const sep = separators[0];
  const rest = separators.slice(1);
  if (!text.includes(sep)) {
    return recursiveSplitSpans(text, baseOffset, rest, target);
  }
  const pieces: Span[] = [];
  let cursor = 0;
  const parts = text.split(sep);
  parts.forEach((part, idx) => {
    const start = cursor;
    cursor += part.length;
    if (idx < parts.length - 1) {
      cursor += sep.length;
    }
    if (!part) {
      return;
    }
    if (part.length <= target) {
      pieces.push([baseOffset + start, baseOffset + start + part.length, part]);
    } else {
      pieces.push(...recursiveSplitSpans(part, baseOffset + start, rest, target));
    }
  });
  const packed: Span[] = [];
  for (const [pStart, pEnd, pText] of pieces) {
    if (packed.length > 0 && pEnd - packed[packed.length - 1][0] <= target) {
      const [prevStart, , prevText] = packed[packed.length - 1];
      packed[packed.length - 1] = [prevStart, pEnd, prevText + sep + pText];
    } else {
      packed.push([pStart, pEnd, pText]);
    }
  }
  return packed;
}

export function recursiveSplit(
  docId: string,
  text: string,
  target = 500,
  separators: string[] = DEFAULT_SEPARATORS,
): Chunk[] {
  const spans = recursiveSplitSpans(text, 0, separators, target);
  return spans.filter(([, , t]) => t.trim()).map(([s, e, t]) => new Chunk(docId, "recursive", s, e, t));
}

function tokenHashes(text: string, dim: number): number[] {
  const vec = new Array<number>(dim).fill(0);
  for (const tok of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    let h = 0;
    for (const ch of tok) {
      h = (Math.imul(h, 1315423911) ^ ch.charCodeAt(0)) >>> 0;
    }
    vec[h % dim] += 1.0;
    vec[(h >>> 7) % dim] += 0.5;
  }
  let sq = 0;
  for (const v of vec) {
    sq += v * v;
  }
  const norm = Math.sqrt(sq) || 1.0;
  return vec.map((v) => v / norm);
}

export function mockEmbed(text: string, dim = 96): number[] {
  return tokenHashes(text, dim);
}

export function cosine(a: number[], b: number[]): number {
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    s += a[i] * b[i];
  }
  return s;
}

export function semanticChunks(docId: string, text: string, similarityThreshold = 0.55, maxChars = 900): Chunk[] {
  const sents = splitSentences(text);
  if (sents.length === 0) {
    return [];
  }
  const chunks: Chunk[] = [];
  let curSents: Span[] = [];
  let curVec: number[] | null = null;
  let curN = 0;

  const flush = (): void => {
    if (curSents.length === 0) {
      return;
    }
    const start = curSents[0][0];
    const end = curSents[curSents.length - 1][1];
    const body = curSents.map((s) => s[2]).join(" ");
    chunks.push(new Chunk(docId, "semantic", start, end, body));
  };

  for (const [sStart, sEnd, sText] of sents) {
    const v = mockEmbed(sText);
    let curChars = 0;
    for (const s of curSents) {
      curChars += s[1] - s[0];
    }
    if (curVec === null) {
      curVec = v;
      curSents.push([sStart, sEnd, sText]);
      curN = 1;
      continue;
    }
    const sim = cosine(curVec, v);
    if (sim < similarityThreshold || curChars + (sEnd - sStart) > maxChars) {
      flush();
      curSents = [[sStart, sEnd, sText]];
      curVec = v;
      curN = 1;
    } else {
      curSents.push([sStart, sEnd, sText]);
      curN += 1;
      const prev: number[] = curVec;
      const n = curN;
      let avg = prev.map((x, i) => (x * n + v[i]) / (n + 1));
      let sq = 0;
      for (const x of avg) {
        sq += x * x;
      }
      const norm = Math.sqrt(sq) || 1.0;
      avg = avg.map((x) => x / norm);
      curVec = avg;
    }
  }
  flush();
  return chunks;
}

const HEADER = /^(#{1,6})\s+(.+)$/gm;

export function structuralMarkdown(docId: string, text: string): Chunk[] {
  const matches = [...text.matchAll(HEADER)];
  if (matches.length === 0) {
    return [new Chunk(docId, "structural", 0, text.length, text)];
  }
  const out: Chunk[] = [];
  matches.forEach((m, i) => {
    const start = m.index ?? 0;
    const end = i + 1 < matches.length ? matches[i + 1].index ?? 0 : text.length;
    const body = text.slice(start, end).trim();
    if (body) {
      out.push(new Chunk(docId, "structural", start, end, body));
    }
  });
  return out;
}

export class DenseIndex {
  vectors: [Chunk, number[]][] = [];

  add(chunk: Chunk): void {
    this.vectors.push([chunk, mockEmbed(chunk.text)]);
  }

  search(query: string, k: number): Chunk[] {
    const qv = mockEmbed(query);
    const scored: [Chunk, number][] = this.vectors.map(([c, v]) => [c, cosine(qv, v)]);
    scored.sort((a, b) => b[1] - a[1]);
    return scored.slice(0, k).map(([c]) => c);
  }
}

export const PROSE_DOC =
  "The retry budget is the safety valve. It exists so that a downstream outage " +
  "does not turn into a cascading failure. The budget is consumed every time a " +
  "client retries after a non-fatal error. When the budget hits zero, the client " +
  "stops retrying for a configured cooldown window.\n\n" +
  "Aborts work differently. An abort signals to the server that the operation " +
  "should be cancelled and its partial state cleaned up. A multipart upload abort " +
  "instructs the storage layer to drop the partial parts and release the reserved " +
  "key. The abort threshold is configured per bucket at three failed parts.\n\n" +
  "Authorization sits one layer above. Every retry and every abort flows through " +
  "the central permission check before the storage call goes out. The check " +
  "evaluates a policy whose inputs are the principal, the resource, and the action. " +
  "The same check runs for human users and for service accounts.";

export const PROSE_QUERIES: [string, string][] = [
  ["what is the abort threshold per bucket", "abort threshold is configured per bucket at three failed parts"],
  ["when does the retry budget reset", "stops retrying for a configured cooldown window"],
  ["how is authorization performed for service accounts", "The same check runs for human users and for service accounts"],
];

export const MARKDOWN_DOC =
  "# Storage Service Configuration\n\n" +
  "This document describes the storage service knobs.\n\n" +
  "## Retry Budget\n\n" +
  "Each client carries a retry budget. The default is 64 retries per minute. When the " +
  "budget reaches zero the client stops retrying.\n\n" +
  "## Abort Threshold\n\n" +
  "A multipart upload is aborted after three consecutive failed parts. The threshold is " +
  "per bucket and is configured in budgets.yaml.\n\n" +
  "## Authorization\n\n" +
  "All operations are authorized through the central permission check before any storage " +
  "call is issued.";

export const MARKDOWN_QUERIES: [string, string][] = [
  ["default retry budget value", "The default is 64 retries per minute"],
  ["how many failed parts before abort", "aborted after three consecutive failed parts"],
  ["where is the abort threshold configured", "configured in budgets.yaml"],
];

export const MIXED_DOC =
  "# Operations Runbook\n\n" +
  "Incident response begins with paging the on-call. The on-call confirms the " +
  "alert is real and acknowledges in the incident tool within five minutes.\n\n" +
  "## Triage\n\n" +
  "The runbook directs the responder to the dashboard. The first widget shows " +
  "p99 latency across the public endpoints. The second widget shows the error " +
  "rate broken down by service.\n\n" +
  "## Mitigation\n\n" +
  "If the error rate exceeds five percent the responder rolls back the most recent " +
  "deploy. The rollback command is one line and is documented in the deploy guide. " +
  "If rollback fails the responder pages the platform team.\n\n" +
  "## Postmortem\n\n" +
  "Every incident with customer impact requires a postmortem within five business " +
  "days. The postmortem lists timeline, root cause, contributing factors, and " +
  "corrective actions with owners and dates.";

export const MIXED_QUERIES: [string, string][] = [
  ["when does the on-call acknowledge", "acknowledges in the incident tool within five minutes"],
  ["what error rate triggers rollback", "If the error rate exceeds five percent"],
  ["when is a postmortem due", "within five business days"],
];

function locate(doc: string, spanText: string): [number, number] {
  const start = doc.indexOf(spanText);
  if (start < 0) {
    throw new Error("substring not found");
  }
  return [start, start + spanText.length];
}

export interface FixtureDoc {
  doc_id: string;
  text: string;
  queries: [string, [number, number]][];
}

export function buildFixture(): FixtureDoc[] {
  return [
    {
      doc_id: "prose",
      text: PROSE_DOC,
      queries: PROSE_QUERIES.map(([q, span]) => [q, locate(PROSE_DOC, span)]),
    },
    {
      doc_id: "markdown",
      text: MARKDOWN_DOC,
      queries: MARKDOWN_QUERIES.map(([q, span]) => [q, locate(MARKDOWN_DOC, span)]),
    },
    {
      doc_id: "mixed",
      text: MIXED_DOC,
      queries: MIXED_QUERIES.map(([q, span]) => [q, locate(MIXED_DOC, span)]),
    },
  ];
}

export type ChunkFn = (docId: string, text: string) => Chunk[];

export function evalRecall(chunker: ChunkFn, fixture: FixtureDoc[], ks: number[] = [1, 3, 5]): Map<number, number> {
  const totals = new Map<number, number>(ks.map((k) => [k, 0]));
  const hits = new Map<number, number>(ks.map((k) => [k, 0]));
  for (const doc of fixture) {
    const chunks = chunker(doc.doc_id, doc.text);
    const idx = new DenseIndex();
    for (const c of chunks) {
      idx.add(c);
    }
    for (const [query, [gStart, gEnd]] of doc.queries) {
      for (const k of ks) {
        totals.set(k, (totals.get(k) ?? 0) + 1);
        const top = idx.search(query, k);
        if (top.some((c) => c.overlaps(gStart, gEnd))) {
          hits.set(k, (hits.get(k) ?? 0) + 1);
        }
      }
    }
  }
  const out = new Map<number, number>();
  for (const k of ks) {
    const t = totals.get(k) ?? 0;
    out.set(k, t ? (hits.get(k) ?? 0) / t : 0.0);
  }
  return out;
}

export const STRATEGIES: [string, ChunkFn][] = [
  ["fixed", (d, t) => fixedWindow(d, t, 400, 80)],
  ["sentence", (d, t) => sentenceChunks(d, t, 500)],
  ["recursive", (d, t) => recursiveSplit(d, t, 500)],
  ["semantic", (d, t) => semanticChunks(d, t, 0.55, 900)],
  ["structural", (d, t) => structuralMarkdown(d, t)],
];

function main(): void {
  const fixture = buildFixture();
  const ks = [1, 3, 5];
  console.log(`${"strategy".padEnd(12)} | ` + ks.map((k) => `recall@${k}`).join(" | "));
  console.log("-".repeat(44));
  for (const [name, fn] of STRATEGIES) {
    const recall = evalRecall(fn, fixture, ks);
    const row = ks.map((k) => `  ${(recall.get(k) ?? 0).toFixed(2)}  `).join(" | ");
    console.log(`${name.padEnd(12)} | ${row}`);
  }
  console.log();
  console.log("chunk counts per strategy (across all fixture docs):");
  for (const [name, fn] of STRATEGIES) {
    let n = 0;
    for (const d of fixture) {
      n += fn(d.doc_id, d.text).length;
    }
    console.log(`  ${name.padEnd(12)} ${n} chunks`);
  }
}

main();
