// Lesson: Python for AI Engineering (phase 00 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/00-setup-and-tooling/13-python-for-ai-engineering/docs/en.md
// Run: npx tsx phases/00-setup-and-tooling/13-python-for-ai-engineering/code/main.ts

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";

const LABEL_FIELD = "label";

type Random = () => number;

function mulberry32(seed: number): Random {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(rng: Random, mu: number, sigma: number): number {
  let u = rng();
  while (u === 0) u = rng();
  const v = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function shuffle<T>(items: T[], rng: Random): void {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
  }
}

class Record {
  constructor(
    readonly features: readonly number[],
    readonly label: number,
  ) {}

  key(): string {
    return JSON.stringify([this.features, this.label]);
  }

  equals(other: Record): boolean {
    return this.key() === other.key();
  }
}

type Row = { [name: string]: number | string };
type Pair = [readonly number[], number];

function makeDataset(n: number, seed = 0): Record[] {
  const rng = mulberry32(seed);
  const centers: { [label: number]: [number, number] } = { 0: [2.0, 50.0], 1: [4.0, 70.0] };
  const spreads = [1.0, 10.0];
  const records: Record[] = [];
  for (let i = 0; i < n; i++) {
    const label = i % 2;
    const features = centers[label].map((c, k) => gauss(rng, c, spreads[k]));
    records.push(new Record(features, label));
  }
  return records;
}

function recordToRow(record: Record): Row {
  const row: Row = {};
  record.features.forEach((v, i) => {
    row[`x${i + 1}`] = v;
  });
  row[LABEL_FIELD] = record.label;
  return row;
}

function rowToRecord(row: Row, names: readonly string[], labelField: string = LABEL_FIELD): Record {
  if (!(labelField in row)) {
    throw new Error(`row has no '${labelField}' field: ${JSON.stringify(row)}`);
  }
  const expected = new Set([...names, labelField]);
  const keys = Object.keys(row);
  if (keys.length !== expected.size || !keys.every((k) => expected.has(k))) {
    throw new Error(`row fields ${JSON.stringify(keys)} do not match ${JSON.stringify([...names, labelField])}`);
  }
  return new Record(
    names.map((name) => Number(row[name])),
    Math.trunc(Number(row[labelField])),
  );
}

function saveRecords(records: readonly Record[], path: string): string {
  const rows = records.map(recordToRow);
  if (rows.length === 0) throw new Error("no records to save");
  const suffix = extname(path);
  if (suffix === ".json") {
    writeFileSync(path, JSON.stringify(rows, null, 2), "utf-8");
  } else if (suffix === ".csv") {
    const fields = Object.keys(rows[0]);
    const lines = [fields.join(",")];
    for (const row of rows) lines.push(fields.map((f) => String(row[f])).join(","));
    writeFileSync(path, lines.join("\r\n") + "\r\n", "utf-8");
  } else {
    throw new Error(`unsupported file type: '${suffix}'`);
  }
  return path;
}

function loadRecords(path: string, labelField: string = LABEL_FIELD): Record[] {
  const suffix = extname(path);
  let rows: Row[];
  if (suffix === ".json") {
    rows = JSON.parse(readFileSync(path, "utf-8")) as Row[];
  } else if (suffix === ".csv") {
    const lines = readFileSync(path, "utf-8").split(/\r?\n/).filter((line) => line.length > 0);
    if (lines.length === 0) {
      rows = [];
    } else {
      const header = lines[0].split(",");
      rows = lines.slice(1).map((line) => {
        const cells = line.split(",");
        const row: Row = {};
        header.forEach((h, i) => {
          row[h] = cells[i];
        });
        return row;
      });
    }
  } else {
    throw new Error(`unsupported file type: '${suffix}'`);
  }
  if (rows.length === 0) return [];
  const names = Object.keys(rows[0]).filter((key) => key !== labelField);
  return rows.map((row) => rowToRecord(row, names, labelField));
}

function trainTestSplit<T>(items: readonly T[], testFraction = 0.2, seed = 0): [T[], T[]] {
  if (!(testFraction > 0.0 && testFraction < 1.0)) {
    throw new Error(`test_fraction must be between 0 and 1, got ${testFraction}`);
  }
  if (items.length < 2) throw new Error(`need at least 2 items to split, got ${items.length}`);
  const order = items.map((_, i) => i);
  shuffle(order, mulberry32(seed));
  const raw = items.length * testFraction;
  const floor = Math.floor(raw);
  const rounded = raw - floor === 0.5 ? (floor % 2 === 0 ? floor : floor + 1) : Math.round(raw);
  const nTest = Math.min(Math.max(1, rounded), items.length - 1);
  const test = order.slice(0, nTest).map((i) => items[i]);
  const train = order.slice(nTest).map((i) => items[i]);
  return [train, test];
}

function batches<T>(items: Iterable<T>, batchSize: number, dropLast = false): Iterator<T[]> & Iterable<T[]> {
  if (batchSize < 1) throw new Error(`batch_size must be at least 1, got ${batchSize}`);
  return batchIter(items[Symbol.iterator](), batchSize, dropLast);
}

function* batchIter<T>(iterator: Iterator<T>, batchSize: number, dropLast: boolean): Generator<T[]> {
  while (true) {
    const batch: T[] = [];
    while (batch.length < batchSize) {
      const next = iterator.next();
      if (next.done) break;
      batch.push(next.value);
    }
    if (batch.length === 0 || (dropLast && batch.length < batchSize)) return;
    yield batch;
  }
}

function zipStrict(a: readonly number[], b: readonly number[]): void {
  if (a.length !== b.length) throw new Error("zip() arguments have different lengths");
}

function dot(a: readonly number[], b: readonly number[]): number {
  zipStrict(a, b);
  let total = 0;
  for (const [i, x] of a.entries()) total += x * b[i];
  return total;
}

function mean(values: readonly number[]): number {
  if (values.length === 0) throw new Error("mean() needs at least one value");
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function std(values: readonly number[]): number {
  const mu = mean(values);
  return Math.sqrt(values.reduce((s, v) => s + (v - mu) ** 2, 0) / values.length);
}

function columnStats(rows: readonly (readonly number[])[]): [number[], number[]] {
  const width = rows.length === 0 ? 0 : Math.min(...rows.map((r) => r.length));
  const columns = Array.from({ length: width }, (_, j) => rows.map((r) => r[j]));
  return [columns.map(mean), columns.map(std)];
}

function makeStandardizer(rows: readonly (readonly number[])[]): (row: readonly number[]) => number[] {
  const [means, stds] = columnStats(rows);
  const scales = stds.map((s) => (s > 0 ? s : 1.0));
  return (row) => {
    if (row.length !== means.length) throw new Error("zip() arguments have different lengths");
    return row.map((v, i) => (v - means[i]) / scales[i]);
  };
}

function fitCentroids(labelledBatches: Iterable<readonly Pair[]>): Map<number, number[]> {
  const sums = new Map<number, number[]>();
  const counts = new Map<number, number>();
  for (const batch of labelledBatches) {
    for (const [row, label] of batch) {
      const previous = sums.get(label) ?? row.map(() => 0.0);
      zipStrict(previous, row);
      sums.set(
        label,
        previous.map((s, i) => s + row[i]),
      );
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  const result = new Map<number, number[]>();
  for (const label of [...sums.keys()].sort((x, y) => x - y)) {
    result.set(
      label,
      sums.get(label)!.map((s) => s / counts.get(label)!),
    );
  }
  return result;
}

function squaredDistance(a: readonly number[], b: readonly number[]): number {
  zipStrict(a, b);
  const diff = a.map((x, i) => x - b[i]);
  return dot(diff, diff);
}

function predict(centroids: Map<number, number[]>, row: readonly number[]): number {
  let best = NaN;
  let bestDistance = Infinity;
  for (const [label, centroid] of centroids) {
    const d = squaredDistance(row, centroid);
    if (Number.isNaN(best) || d < bestDistance) {
      best = label;
      bestDistance = d;
    }
  }
  return best;
}

function accuracy(centroids: Map<number, number[]>, pairs: readonly Pair[]): number {
  return pairs.filter(([row, label]) => predict(centroids, row) === label).length / pairs.length;
}

function dotIndexLoop(a: readonly number[], b: readonly number[]): number {
  let total = 0.0;
  for (let i = 0; i < a.length; i++) {
    total += a[i] * b[i];
  }
  return total;
}

function dotMap(a: readonly number[], b: readonly number[]): number {
  return a.map((x, i) => x * b[i]).reduce((s, v) => s + v, 0);
}

function bestTime<A extends unknown[]>(fn: (...args: A) => unknown, args: A, repeat = 5): number {
  const times: number[] = [];
  for (let r = 0; r < repeat; r++) {
    const start = performance.now();
    fn(...args);
    times.push((performance.now() - start) / 1000);
  }
  return Math.min(...times);
}

setFlagsFromString("--expose-gc");
const collect = runInNewContext("gc") as () => void;

function peakBytes(fn: () => unknown): number {
  collect();
  const before = process.memoryUsage().heapUsed;
  fn();
  return Math.max(0, process.memoryUsage().heapUsed - before);
}

function sumSquaresList(n: number): number {
  const squares = Array.from({ length: n }, (_, i) => i * i);
  return squares.reduce((s, v) => s + v, 0);
}

function range(n: number): Iterable<number> {
  return {
    [Symbol.iterator](): Iterator<number> {
      let i = 0;
      const result = { done: false, value: 0 };
      return {
        next(): IteratorResult<number> {
          result.done = i >= n;
          result.value = i++;
          return result;
        },
      };
    },
  };
}

function sumSquaresGenerator(n: number): number {
  let total = 0;
  for (const i of range(n)) total += i * i;
  return total;
}

type Summary = {
  n_records: number;
  roundtrip_equal: boolean;
  n_train: number;
  n_test: number;
  overlap: number;
  batch_size: number;
  batch_sizes: number[];
  scaled_means: number[];
  accuracy_raw: number;
  accuracy_scaled: number;
  vector_size: number;
  timings: [string, number][];
  peaks: [string, number][];
};

function recordsEqual(a: readonly Record[], b: readonly Record[]): boolean {
  return a.length === b.length && a.every((r, i) => r.equals(b[i]));
}

function runDemo(n = 400, seed = 7, batchSize = 48, vectorSize = 200_000): Summary {
  const records = makeDataset(n, seed);
  const tmp = mkdtempSync(join(tmpdir(), "lesson-"));
  let fromCsv: Record[];
  let fromJson: Record[];
  try {
    fromCsv = loadRecords(saveRecords(records, join(tmp, "data.csv")));
    fromJson = loadRecords(saveRecords(records, join(tmp, "data.json")));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const [train, test] = trainTestSplit(fromCsv, 0.2, seed);
  const rawTrain: Pair[] = train.map((r) => [r.features, r.label]);
  const rawTest: Pair[] = test.map((r) => [r.features, r.label]);
  const standardize = makeStandardizer(train.map((r) => r.features));
  const scaledTrain: Pair[] = train.map((r) => [standardize(r.features), r.label]);
  const scaledTest: Pair[] = test.map((r) => [standardize(r.features), r.label]);

  const rng = mulberry32(seed);
  const a = Array.from({ length: vectorSize }, () => rng());
  const b = Array.from({ length: vectorSize }, () => rng());
  const timings: [string, number][] = [
    ["index loop", bestTime(dotIndexLoop, [a, b])],
    ["zip generator", bestTime(dot, [a, b])],
    ["map + mul", bestTime(dotMap, [a, b])],
  ];
  const peaks: [string, number][] = [
    ["list", peakBytes(() => sumSquaresList(100_000))],
    ["generator", peakBytes(() => sumSquaresGenerator(100_000))],
  ];
  const testKeys = new Set(test.map((r) => r.key()));
  const trainKeys = new Set(train.map((r) => r.key()));
  return {
    n_records: records.length,
    roundtrip_equal: recordsEqual(fromCsv, records) && recordsEqual(fromJson, records),
    n_train: train.length,
    n_test: test.length,
    overlap: [...trainKeys].filter((k) => testKeys.has(k)).length,
    batch_size: batchSize,
    batch_sizes: [...batches(scaledTrain, batchSize)].map((batch) => batch.length),
    scaled_means: columnStats(scaledTrain.map(([row]) => row))[0].map((m) => Math.round(m * 1e6) / 1e6 + 0.0),
    accuracy_raw: accuracy(fitCentroids(batches(rawTrain, batchSize)), rawTest),
    accuracy_scaled: accuracy(fitCentroids(batches(scaledTrain, batchSize)), scaledTest),
    vector_size: vectorSize,
    timings,
    peaks,
  };
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyBool(x: boolean): string {
  return x ? "True" : "False";
}

function commas(n: number): string {
  return n.toLocaleString("en-US");
}

function formatReport(summary: Summary): string {
  const lines = [
    "Python for AI engineering: a standard-library toolkit",
    `data     ${summary.n_records} records, CSV and JSON load back unchanged: ${pyBool(summary.roundtrip_equal)}`,
    `split    ${summary.n_train} train, ${summary.n_test} test, records in both: ${summary.overlap}`,
    `batches  size ${summary.batch_size}: [${summary.batch_sizes.join(", ")}]`,
    `scale    train feature means after standardizing: [${summary.scaled_means.map(pyFloat).join(", ")}]`,
    `model    nearest-centroid test accuracy: raw ${summary.accuracy_raw.toFixed(2)}, ` +
      `standardized ${summary.accuracy_scaled.toFixed(2)}`,
    `speed    dot product of ${commas(summary.vector_size)} floats, best of 5:`,
  ];
  for (const [name, seconds] of summary.timings) {
    lines.push(`           ${name.padEnd(15)} ${(seconds * 1000).toFixed(2).padStart(7)} ms`);
  }
  lines.push("memory   peak bytes to sum 100,000 squares:");
  for (const [name, size] of summary.peaks) {
    lines.push(`           ${name.padEnd(15)} ${commas(size).padStart(11)}`);
  }
  return lines.join("\n");
}

function main(): void {
  console.log(formatReport(runDemo()));
}

main();
