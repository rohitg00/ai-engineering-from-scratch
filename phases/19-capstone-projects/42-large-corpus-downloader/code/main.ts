// Lesson: Large Corpus Downloader (phase 19 / lesson 42)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/42-large-corpus-downloader/docs/en.md
// Run: npx tsx phases/19-capstone-projects/42-large-corpus-downloader/code/main.ts

import { createHash } from "node:crypto";
import { createReadStream, existsSync, mkdirSync, mkdtempSync, openSync, closeSync, readFileSync, readSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync, writeSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable, Transform } from "node:stream";
import { fileURLToPath, pathToFileURL } from "node:url";
import * as zlib from "node:zlib";

interface ZstdApi {
  zstdCompressSync(buf: Buffer, opts?: { params?: Record<number, number> }): Buffer;
  createZstdDecompress(): Transform;
  constants: Record<string, number>;
}

const zstd = zlib as unknown as ZstdApi;
if (typeof zstd.zstdCompressSync !== "function" || typeof zstd.createZstdDecompress !== "function") {
  console.error("zstd support in node:zlib is required for this lesson. Use Node 22.15 or newer.");
  process.exit(1);
}

export const CHUNK_BYTES = 1 << 16;

const PY_WS_RUN = /[\t-\r\u001c-\u001f \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]+/;

function pyInt(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "string" && /^\s*[+-]?\d+(_\d+)*\s*$/.test(v)) return parseInt(v.replace(/_/g, ""), 10);
  throw new Error(`invalid literal for int(): ${String(v)}`);
}
export const DEFAULT_NUM_HASHES = 128;
export const DEFAULT_BANDS = 32;
export const DEFAULT_SHINGLE_WIDTH = 5;
export const MAX_UINT64 = (1n << 64n) - 1n;
export const MERSENNE_PRIME = (1n << 61n) - 1n;

const MASK64 = MAX_UINT64;
const BLAKE2B_IV = [
  0x6a09e667f3bcc908n,
  0xbb67ae8584caa73bn,
  0x3c6ef372fe94f82bn,
  0xa54ff53a5f1d36f1n,
  0x510e527fade682d1n,
  0x9b05688c2b3e6c1fn,
  0x1f83d9abfb41bd6bn,
  0x5be0cd19137e2179n,
];
const BLAKE2B_SIGMA = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [14, 10, 4, 8, 9, 15, 13, 6, 1, 12, 0, 2, 11, 7, 5, 3],
  [11, 8, 12, 0, 5, 2, 15, 13, 10, 14, 3, 6, 7, 1, 9, 4],
  [7, 9, 3, 1, 13, 12, 11, 14, 2, 6, 5, 10, 4, 0, 15, 8],
  [9, 0, 5, 7, 2, 4, 10, 15, 14, 1, 11, 12, 6, 8, 3, 13],
  [2, 12, 6, 10, 0, 11, 8, 3, 4, 13, 7, 5, 15, 14, 1, 9],
  [12, 5, 1, 15, 14, 13, 4, 10, 0, 7, 6, 3, 9, 2, 8, 11],
  [13, 11, 7, 14, 12, 1, 3, 9, 5, 0, 15, 4, 8, 6, 2, 10],
  [6, 15, 14, 9, 11, 3, 0, 8, 12, 2, 13, 7, 1, 4, 10, 5],
  [10, 2, 8, 4, 7, 6, 1, 5, 15, 11, 9, 14, 3, 12, 13, 0],
];

function rotr64(x: bigint, n: bigint): bigint {
  return ((x >> n) | (x << (64n - n))) & MASK64;
}

function blake2bCompress(h: bigint[], block: Uint8Array, t: bigint, last: boolean): void {
  const m: bigint[] = [];
  for (let i = 0; i < 16; i++) {
    let w = 0n;
    for (let k = 7; k >= 0; k--) w = (w << 8n) | BigInt(block[i * 8 + k]);
    m.push(w);
  }
  const v = [...h, ...BLAKE2B_IV];
  v[12] ^= t & MASK64;
  v[13] ^= t >> 64n;
  if (last) v[14] ^= MASK64;
  const g = (a: number, b: number, c: number, d: number, x: bigint, y: bigint): void => {
    v[a] = (v[a] + v[b] + x) & MASK64;
    v[d] = rotr64(v[d] ^ v[a], 32n);
    v[c] = (v[c] + v[d]) & MASK64;
    v[b] = rotr64(v[b] ^ v[c], 24n);
    v[a] = (v[a] + v[b] + y) & MASK64;
    v[d] = rotr64(v[d] ^ v[a], 16n);
    v[c] = (v[c] + v[d]) & MASK64;
    v[b] = rotr64(v[b] ^ v[c], 63n);
  };
  for (let r = 0; r < 12; r++) {
    const s = BLAKE2B_SIGMA[r % 10];
    g(0, 4, 8, 12, m[s[0]], m[s[1]]);
    g(1, 5, 9, 13, m[s[2]], m[s[3]]);
    g(2, 6, 10, 14, m[s[4]], m[s[5]]);
    g(3, 7, 11, 15, m[s[6]], m[s[7]]);
    g(0, 5, 10, 15, m[s[8]], m[s[9]]);
    g(1, 6, 11, 12, m[s[10]], m[s[11]]);
    g(2, 7, 8, 13, m[s[12]], m[s[13]]);
    g(3, 4, 9, 14, m[s[14]], m[s[15]]);
  }
  for (let i = 0; i < 8; i++) h[i] ^= v[i] ^ v[i + 8];
}

export function blake2b(data: Uint8Array, digestSize: number): Buffer {
  const h = [...BLAKE2B_IV];
  h[0] ^= 0x01010000n ^ BigInt(digestSize);
  let t = 0n;
  let offset = 0;
  while (data.length - offset > 128) {
    t += 128n;
    blake2bCompress(h, data.subarray(offset, offset + 128), t, false);
    offset += 128;
  }
  const lastBlock = new Uint8Array(128);
  lastBlock.set(data.subarray(offset));
  t += BigInt(data.length - offset);
  blake2bCompress(h, lastBlock, t, true);
  const out = Buffer.alloc(64);
  h.forEach((w, i) => out.writeBigUInt64LE(w, i * 8));
  return out.subarray(0, digestSize);
}

function u64le(n: bigint): Buffer {
  const b = Buffer.alloc(8);
  b.writeBigUInt64LE(n);
  return b;
}

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function jsonStr(s: string): string {
  return (
    '"' +
    s.replace(/[\\"\u0000-\u001f\u007f-￿]/g, (c) => {
      if (c === '"') return '\\"';
      if (c === "\\") return "\\\\";
      if (c === "\n") return "\\n";
      if (c === "\r") return "\\r";
      if (c === "\t") return "\\t";
      if (c === "\b") return "\\b";
      if (c === "\f") return "\\f";
      return "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0");
    }) +
    '"'
  );
}

function pyDumpsSorted(v: Json, indent: number | null = null, level = 0): string {
  if (v === null) return "null";
  if (v === true) return "true";
  if (v === false) return "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return jsonStr(v);
  let open: string;
  let close: string;
  let items: string[];
  if (Array.isArray(v)) {
    if (!v.length) return "[]";
    open = "[";
    close = "]";
    items = v.map((x) => pyDumpsSorted(x, indent, level + 1));
  } else {
    const keys = Object.keys(v).sort();
    if (!keys.length) return "{}";
    open = "{";
    close = "}";
    items = keys.map((k) => jsonStr(k) + ": " + pyDumpsSorted(v[k], indent, level + 1));
  }
  if (indent === null) return open + items.join(", ") + close;
  const pad = "\n" + " ".repeat(indent * (level + 1));
  return open + pad + items.join("," + pad) + "\n" + " ".repeat(indent * level) + close;
}

export class ShardPlan {
  constructor(
    public shard_id: string,
    public url: string,
    public expected_size: number | null = null,
  ) {}
}

export class ShardResult {
  constructor(
    public shard_id: string,
    public url: string,
    public raw_bytes: number,
    public decompressed_bytes: number,
    public document_count: number,
    public kept_count: number,
    public duplicate_count: number,
    public sha256: string,
  ) {}

  toManifestRow(): { [key: string]: Json } {
    return {
      shard_id: this.shard_id,
      url: this.url,
      raw_bytes: this.raw_bytes,
      decompressed_bytes: this.decompressed_bytes,
      document_count: this.document_count,
      kept_count: this.kept_count,
      duplicate_count: this.duplicate_count,
      sha256: this.sha256,
    };
  }
}

export class DocVerdict {
  constructor(
    public shard_id: string,
    public doc_index: number,
    public verdict: string,
    public collided_with: string | null = null,
  ) {}

  toDict(): { [key: string]: Json } {
    return { shard_id: this.shard_id, doc_index: this.doc_index, verdict: this.verdict, collided_with: this.collided_with };
  }
}

export class CheckpointState {
  constructor(
    public url: string,
    public verified_bytes: number,
    public expected_size: number | null,
    public sha256_prefix_hex: string,
  ) {}

  toJson(): string {
    return pyDumpsSorted({
      url: this.url,
      verified_bytes: this.verified_bytes,
      expected_size: this.expected_size,
      sha256_prefix_hex: this.sha256_prefix_hex,
    });
  }

  static fromJson(text: string): CheckpointState {
    const data = JSON.parse(text) as Record<string, unknown>;
    for (const k of ["url", "verified_bytes", "sha256_prefix_hex"]) {
      if (!(k in data)) throw new Error(`missing ${k}`);
    }
    const verified = pyInt(data["verified_bytes"]);
    const expected = data["expected_size"];
    return new CheckpointState(
      String(data["url"]),
      verified,
      expected !== null && expected !== undefined ? pyInt(expected) : null,
      String(data["sha256_prefix_hex"]),
    );
  }
}

function hashSeedPair(seed: number): [bigint, bigint] {
  const digest = blake2b(u64le(BigInt(seed)), 16);
  const a = digest.readBigUInt64LE(0) | 1n;
  const b = digest.readBigUInt64LE(8);
  return [a, b];
}

export class MinHasher {
  private coefficients: [bigint, bigint][];

  constructor(
    public num_hashes = DEFAULT_NUM_HASHES,
    public shingle_width = DEFAULT_SHINGLE_WIDTH,
  ) {
    if (num_hashes <= 0) throw new Error("num_hashes must be positive");
    if (shingle_width <= 0) throw new Error("shingle_width must be positive");
    this.coefficients = [];
    for (let i = 0; i < num_hashes; i++) this.coefficients.push(hashSeedPair(i));
  }

  shingles(text: string): string[] {
    const tokens = text.split(PY_WS_RUN).filter(Boolean);
    if (tokens.length < this.shingle_width) return tokens.length ? [tokens.join(" ")] : [];
    const out: string[] = [];
    for (let start = 0; start < tokens.length - this.shingle_width + 1; start++) {
      out.push(tokens.slice(start, start + this.shingle_width).join(" "));
    }
    return out;
  }

  private static hashShingle(shingle: string): bigint {
    return blake2b(Buffer.from(shingle, "utf-8"), 8).readBigUInt64LE(0);
  }

  signature(text: string): bigint[] {
    const shingles = this.shingles(text);
    if (!shingles.length) return new Array<bigint>(this.num_hashes).fill(MAX_UINT64);
    const hashes = shingles.map((s) => MinHasher.hashShingle(s));
    const sig: bigint[] = [];
    for (const [a, b] of this.coefficients) {
      let best = MAX_UINT64;
      for (const h of hashes) {
        const candidate = ((a * h + b) % MERSENNE_PRIME) & MAX_UINT64;
        if (candidate < best) best = candidate;
      }
      sig.push(best);
    }
    return sig;
  }
}

export class LSHIndex {
  rows: number;
  private buckets: Map<string, string[]>[];
  private signatures = new Map<string, bigint[]>();

  constructor(
    public num_hashes: number,
    public bands = DEFAULT_BANDS,
  ) {
    if (bands <= 0 || num_hashes % bands !== 0) throw new Error(`bands (${bands}) must divide num_hashes (${num_hashes})`);
    this.rows = num_hashes / bands;
    this.buckets = [];
    for (let i = 0; i < bands; i++) this.buckets.push(new Map());
  }

  private static bandKey(band: bigint[]): string {
    return blake2b(Buffer.concat(band.map(u64le)), 16).toString("hex");
  }

  query(signature: bigint[]): string | null {
    for (let i = 0; i < this.bands; i++) {
      const key = LSHIndex.bandKey(signature.slice(i * this.rows, (i + 1) * this.rows));
      const bucket = this.buckets[i].get(key);
      if (bucket && bucket.length) return bucket[0];
    }
    return null;
  }

  insert(docId: string, signature: bigint[]): void {
    this.signatures.set(docId, signature);
    for (let i = 0; i < this.bands; i++) {
      const key = LSHIndex.bandKey(signature.slice(i * this.rows, (i + 1) * this.rows));
      const bucket = this.buckets[i].get(key);
      if (bucket) bucket.push(docId);
      else this.buckets[i].set(key, [docId]);
    }
  }

  jaccardEstimate(docA: string, docB: string): number {
    const sigA = this.signatures.get(docA) as bigint[];
    const sigB = this.signatures.get(docB) as bigint[];
    let agree = 0;
    sigA.forEach((a, i) => {
      if (a === sigB[i]) agree += 1;
    });
    return agree / this.num_hashes;
  }
}

export class Dedup {
  constructor(
    public hasher: MinHasher,
    public index: LSHIndex,
  ) {}

  evaluate(shardId: string, docIndex: number, text: string): DocVerdict {
    const sig = this.hasher.signature(text);
    const keeper = this.index.query(sig);
    if (keeper !== null) return new DocVerdict(shardId, docIndex, "near_duplicate", keeper);
    this.index.insert(`${shardId}:${docIndex}`, sig);
    return new DocVerdict(shardId, docIndex, "keep");
  }
}

export async function* zstdDocIterator(raw: Readable): AsyncGenerator<string> {
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let pending = "";
  const emit = function* (final: boolean): Generator<string> {
    const re = /\r\n|\r|\n/g;
    let start = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(pending)) !== null) {
      if (m[0] === "\r" && m.index === pending.length - 1 && !final) break;
      const line = pending.slice(start, m.index + m[0].length).replace(/\n+$/, "");
      if (line) yield line;
      start = m.index + m[0].length;
    }
    pending = pending.slice(start);
    if (final && pending) {
      const line = pending.replace(/\n+$/, "");
      pending = "";
      if (line) yield line;
    }
  };
  for await (const chunk of raw.pipe(zstd.createZstdDecompress())) {
    pending += decoder.decode(chunk as Buffer, { stream: true });
    yield* emit(false);
  }
  pending += decoder.decode();
  yield* emit(true);
}

export interface Response {
  status: number;
  headers: Map<string, string>;
  read(n: number): Promise<Buffer | null>;
  close(): void;
}

export interface Request {
  url: string;
  headers: Map<string, string>;
}

export type Opener = (req: Request) => Promise<Response>;

function safeClose(response: Response): void {
  try {
    response.close();
  } catch {
    return;
  }
}

function chunkedReader(stream: Readable): (chunkBytes: number) => Promise<Buffer | null> {
  const iter = stream[Symbol.asyncIterator]();
  let buffered = Buffer.alloc(0);
  let done = false;
  return async (chunkBytes) => {
    while (!done && buffered.length < chunkBytes) {
      const next = await iter.next();
      if (next.done) done = true;
      else buffered = Buffer.concat([buffered, next.value as Buffer]);
    }
    if (!buffered.length) return null;
    const out = buffered.subarray(0, chunkBytes);
    buffered = buffered.subarray(out.length);
    return out;
  };
}

export const defaultOpener: Opener = async (req) => {
  const url = new URL(req.url);
  if (url.protocol === "file:") {
    const stream = createReadStream(fileURLToPath(url));
    return { status: 0, headers: new Map(), read: chunkedReader(stream), close: () => stream.destroy() };
  }
  const res = await fetch(req.url, { headers: Object.fromEntries(req.headers) });
  if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);
  const body = res.body ? Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]) : Readable.from([]);
  const headers = new Map<string, string>();
  res.headers.forEach((v, k) => headers.set(k.toLowerCase(), v));
  return { status: res.status, headers, read: chunkedReader(body), close: () => body.destroy() };
};

export class StreamingDownloader {
  cache_dir: string;

  constructor(
    cacheDir: string,
    private opener: Opener = defaultOpener,
    public chunk_bytes = CHUNK_BYTES,
  ) {
    this.cache_dir = cacheDir;
    mkdirSync(this.cache_dir, { recursive: true });
  }

  private pathsFor(shardId: string): [string, string] {
    return [join(this.cache_dir, `${shardId}.zst`), join(this.cache_dir, `${shardId}.partial.json`)];
  }

  private readCheckpoint(checkpointPath: string): CheckpointState | null {
    if (!existsSync(checkpointPath)) return null;
    try {
      return CheckpointState.fromJson(readFileSync(checkpointPath, "utf-8"));
    } catch {
      return null;
    }
  }

  private writeCheckpoint(checkpointPath: string, state: CheckpointState): void {
    const tmp = checkpointPath.replace(/\.json$/, ".json.tmp");
    writeFileSync(tmp, state.toJson(), "utf-8");
    renameSync(tmp, checkpointPath);
  }

  private hashPrefix(shardPath: string, nBytes: number): string | null {
    const hasher = createHash("sha256");
    const fd = openSync(shardPath, "r");
    try {
      const buf = Buffer.alloc(this.chunk_bytes);
      let remaining = nBytes;
      let pos = 0;
      while (remaining > 0) {
        const n = readSync(fd, buf, 0, Math.min(this.chunk_bytes, remaining), pos);
        if (n === 0) return null;
        hasher.update(buf.subarray(0, n));
        remaining -= n;
        pos += n;
      }
    } finally {
      closeSync(fd);
    }
    return hasher.digest("hex");
  }

  private verifyPartial(shardPath: string, state: CheckpointState): boolean {
    if (!existsSync(shardPath)) return false;
    if (statSync(shardPath).size !== state.verified_bytes) return false;
    return this.hashPrefix(shardPath, state.verified_bytes) === state.sha256_prefix_hex;
  }

  async download(plan: ShardPlan): Promise<ShardResult> {
    const scheme = new URL(plan.url).protocol.replace(/:$/, "");
    if (!["http", "https", "file"].includes(scheme)) {
      throw new Error(`unsupported URL scheme '${scheme}' for shard ${plan.shard_id}`);
    }
    const [shardPath, checkpointPath] = this.pathsFor(plan.shard_id);
    const state = this.readCheckpoint(checkpointPath);
    let resumeFrom = 0;
    let rolling = createHash("sha256");
    if (state !== null && state.url === plan.url && this.verifyPartial(shardPath, state)) {
      resumeFrom = state.verified_bytes;
      const fd = openSync(shardPath, "r");
      try {
        const buf = Buffer.alloc(this.chunk_bytes);
        let remaining = resumeFrom;
        let pos = 0;
        while (remaining > 0) {
          const n = readSync(fd, buf, 0, Math.min(this.chunk_bytes, remaining), pos);
          if (n === 0) break;
          rolling.update(buf.subarray(0, n));
          remaining -= n;
          pos += n;
        }
      } finally {
        closeSync(fd);
      }
    } else {
      if (existsSync(shardPath)) unlinkSync(shardPath);
      if (existsSync(checkpointPath)) unlinkSync(checkpointPath);
    }

    const request: Request = { url: plan.url, headers: new Map() };
    if (resumeFrom > 0) request.headers.set("Range", `bytes=${resumeFrom}-`);
    let response = await this.opener(request);
    try {
      if (resumeFrom > 0) {
        const contentRange = response.headers.get("content-range") ?? "";
        if (response.status !== 206 || !contentRange.startsWith(`bytes ${resumeFrom}-`)) {
          safeClose(response);
          resumeFrom = 0;
          rolling = createHash("sha256");
          if (existsSync(shardPath)) unlinkSync(shardPath);
          if (existsSync(checkpointPath)) unlinkSync(checkpointPath);
          response = await this.opener({ url: plan.url, headers: new Map() });
        }
      }
      const out = openSync(shardPath, resumeFrom > 0 ? "a" : "w");
      try {
        for (;;) {
          const buf = await response.read(this.chunk_bytes);
          if (!buf) break;
          rolling.update(buf);
          const nextVerified = resumeFrom + buf.length;
          const newState = new CheckpointState(plan.url, nextVerified, plan.expected_size, rolling.copy().digest("hex"));
          this.writeCheckpoint(checkpointPath, newState);
          writeSync(out, buf);
          resumeFrom = nextVerified;
        }
      } finally {
        closeSync(out);
      }
    } finally {
      response.close();
    }

    let decompressedBytes = 0;
    let documentCount = 0;
    let lastByte = 0x0a;
    for await (const chunk of createReadStream(shardPath).pipe(zstd.createZstdDecompress())) {
      const b = chunk as Buffer;
      if (b.length === 0) continue;
      decompressedBytes += b.length;
      for (const byte of b) if (byte === 0x0a) documentCount += 1;
      lastByte = b[b.length - 1];
    }
    if (lastByte !== 0x0a) documentCount += 1;

    return new ShardResult(plan.shard_id, plan.url, resumeFrom, decompressedBytes, documentCount, 0, 0, rolling.digest("hex"));
  }
}

export class ShardPlanner {
  static fromUrls(urls: Iterable<string>): ShardPlan[] {
    const plans: ShardPlan[] = [];
    let index = 0;
    for (const url of urls) {
      plans.push(new ShardPlan(`shard-${String(index).padStart(4, "0")}`, url));
      index += 1;
    }
    return plans;
  }
}

export class ManifestWriter {
  private rows: { [key: string]: Json }[] = [];
  private verdictRows: { [key: string]: Json }[] = [];

  addShard(result: ShardResult): void {
    this.rows.push(result.toManifestRow());
  }

  addVerdict(verdict: DocVerdict): void {
    this.verdictRows.push(verdict.toDict());
  }

  write(manifestPath: string): string {
    const body: Json = {
      version: 1,
      generated_at: Math.floor(Date.now() / 1000),
      shards: this.rows,
      verdicts: this.verdictRows,
    };
    const text = pyDumpsSorted(body, 2);
    const manifestSha = createHash("sha256").update(text, "utf-8").digest("hex");
    writeFileSync(manifestPath, text, "utf-8");
    writeFileSync(manifestPath + ".lock", pyDumpsSorted({ manifest_sha256: manifestSha }), "utf-8");
    return manifestSha;
  }

  get shards(): { [key: string]: Json }[] {
    return [...this.rows];
  }

  get verdicts(): { [key: string]: Json }[] {
    return [...this.verdictRows];
  }
}

export async function processShard(plan: ShardPlan, downloader: StreamingDownloader, dedup: Dedup, manifest: ManifestWriter): Promise<ShardResult> {
  const result = await downloader.download(plan);
  let kept = 0;
  let duplicates = 0;
  let docIndex = 0;
  for await (const line of zstdDocIterator(createReadStream(join(downloader.cache_dir, `${plan.shard_id}.zst`)))) {
    const verdict = dedup.evaluate(plan.shard_id, docIndex, line);
    manifest.addVerdict(verdict);
    if (verdict.verdict === "keep") kept += 1;
    else duplicates += 1;
    docIndex += 1;
  }
  result.kept_count = kept;
  result.duplicate_count = duplicates;
  manifest.addShard(result);
  return result;
}

export function buildDemoCorpus(directory: string): string[] {
  mkdirSync(directory, { recursive: true });
  const base = [
    "the alignment problem is a story about reward functions and what we miss when we write them",
    "the alignment problem is a story about reward functions and the things we forget to write down",
    "transformers replaced recurrent networks because attention scales better with sequence length",
    "attention scales better with sequence length so transformers replaced recurrent networks",
    "evaluation harnesses keep training honest by treating the test corpus as a contract",
    "a contract between training and evaluation is what an eval harness ultimately enforces",
    "deduplication is upstream of tokenization so duplicates do not pay tokenization cost twice",
    "the tokenizer is a vocabulary contract between the model and the corpus",
    "checkpointing the verified bytes before writing the buffer is the only safe resume order",
    "the manifest is the deciding edge between data is downloaded and data is verifiable",
  ];
  const shards = [base.slice(0, 5), base.slice(3, 9), base.slice(6)];
  const level = zstd.constants["ZSTD_c_compressionLevel"];
  return shards.map((group, i) => {
    const payload = Buffer.from(group.join("\n") + "\n", "utf-8");
    const compressed = zstd.zstdCompressSync(payload, { params: { [level]: 10 } });
    const path = join(directory, `corpus-${String(i).padStart(2, "0")}.zst`);
    writeFileSync(path, compressed);
    return pathToFileURL(path).href;
  });
}

export async function runDemo(): Promise<number> {
  const rawDir = mkdtempSync(join(tmpdir(), "corpus-raw-"));
  const cacheDir = mkdtempSync(join(tmpdir(), "corpus-cache-"));
  try {
    const urls = buildDemoCorpus(rawDir);
    const plans = ShardPlanner.fromUrls(urls);
    const downloader = new StreamingDownloader(cacheDir);
    const dedup = new Dedup(new MinHasher(128, 3), new LSHIndex(128, 32));
    const manifest = new ManifestWriter();
    for (const plan of plans) {
      const r = await processShard(plan, downloader, dedup, manifest);
      console.log(
        `[shard] ${r.shard_id} docs=${r.document_count} kept=${r.kept_count} duplicates=${r.duplicate_count} sha256=${r.sha256.slice(0, 12)}`,
      );
    }
    const manifestSha = manifest.write(join(cacheDir, "manifest.json"));
    const kept = manifest.shards.reduce((n, row) => n + (row["kept_count"] as number), 0);
    const dup = manifest.shards.reduce((n, row) => n + (row["duplicate_count"] as number), 0);
    console.log(`[manifest] sha256=${manifestSha.slice(0, 12)} kept=${kept} duplicates=${dup}`);
  } finally {
    rmSync(rawDir, { recursive: true, force: true });
    rmSync(cacheDir, { recursive: true, force: true });
  }
  return 0;
}

if (require.main === module) {
  runDemo().then((code) => {
    process.exitCode = code;
  });
}
