// Lesson: Monitoring Models in Production: Data Drift and Concept Drift (phase 02 / lesson 20)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/02-ml-fundamentals/20-model-monitoring-and-drift/docs/en.md
// Run: npx tsx phases/02-ml-fundamentals/20-model-monitoring-and-drift/code/main.ts

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

function fx(x: number, digits: number): string {
  const negative = x < 0 || Object.is(x, -0);
  const a = Math.abs(x);
  let s = a.toFixed(digits);
  const width = Math.min(100, digits + 60);
  const exact = a.toFixed(width);
  const tail = exact.slice(exact.length - (width - digits));
  if (/^50*$/.test(tail)) {
    const down = (Math.floor(a * 10 ** digits) / 10 ** digits).toFixed(digits);
    if (Number(down.replace(".", "").slice(-1)) % 2 === 0) s = down;
  }
  return negative ? `-${s}` : s;
}

function ex(x: number, digits: number): string {
  return x.toExponential(digits).replace(/e([+-])(\d)$/, "e$10$2");
}

function bisectRight(sorted: readonly number[], value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (value < sorted[mid]) hi = mid;
    else lo = mid + 1;
  }
  return lo;
}

function numericSort(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

function quantileEdges(reference: readonly number[], bins = 10): number[] {
  const ordered = numericSort(reference);
  const n = ordered.length;
  const edges: number[] = [];
  for (let i = 1; i < bins; i++) edges.push(ordered[Math.min(n - 1, Math.floor((n * i) / bins))]);
  return numericSort([...new Set(edges)]);
}

function binFractions(values: readonly number[], edges: readonly number[]): number[] {
  const counts = new Array<number>(edges.length + 1).fill(0);
  for (const value of values) {
    counts[bisectRight(edges, value)] += 1;
  }
  const total = values.length;
  return counts.map((c) => c / total);
}

function psiFromFractions(expected: readonly number[], actual: readonly number[], eps = 1e-4): number {
  let total = 0.0;
  const n = Math.min(expected.length, actual.length);
  for (let i = 0; i < n; i++) {
    const e = Math.max(expected[i], eps);
    const a = Math.max(actual[i], eps);
    total += (a - e) * Math.log(a / e);
  }
  return total;
}

function psi(reference: readonly number[], current: readonly number[], bins = 10): number {
  const edges = quantileEdges(reference, bins);
  return psiFromFractions(binFractions(reference, edges), binFractions(current, edges));
}

function ksStatistic(sampleA: readonly number[], sampleB: readonly number[]): number {
  const a = numericSort(sampleA);
  const b = numericSort(sampleB);
  const n = a.length;
  const m = b.length;
  let i = 0;
  let j = 0;
  let d = 0.0;
  while (i < n && j < m) {
    const x = Math.min(a[i], b[j]);
    while (i < n && a[i] <= x) i += 1;
    while (j < m && b[j] <= x) j += 1;
    d = Math.max(d, Math.abs(i / n - j / m));
  }
  return d;
}

function ksPvalue(d: number, n: number, m: number): number {
  const effectiveN = (n * m) / (n + m);
  const lam = Math.sqrt(effectiveN) * d;
  if (lam < 1e-3) {
    return 1.0;
  }
  let total = 0.0;
  for (let k = 1; k < 101; k++) {
    const term = 2 * (-1) ** (k - 1) * Math.exp(-2 * k * k * lam * lam);
    total += term;
    if (Math.abs(term) < 1e-12) break;
  }
  return Math.min(1.0, Math.max(0.0, total));
}

const LANCZOS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6,
  1.5056327351493116e-7,
];

function lgamma(x: number): number {
  if (x < 0.5) {
    return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lgamma(1 - x);
  }
  const z = x - 1;
  let sum = LANCZOS[0];
  for (let i = 1; i < LANCZOS.length; i++) sum += LANCZOS[i] / (z + i);
  const t = z + 7.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(sum);
}

function gammaPSeries(a: number, x: number): number {
  let term = 1.0 / a;
  let total = term;
  let ap = a;
  for (let it = 0; it < 1000; it++) {
    ap += 1;
    term *= x / ap;
    total += term;
    if (Math.abs(term) < Math.abs(total) * 1e-15) break;
  }
  return total * Math.exp(-x + a * Math.log(x) - lgamma(a));
}

function gammaQFraction(a: number, x: number): number {
  const tiny = 1e-300;
  let b = x + 1 - a;
  let c = 1 / tiny;
  let d = 1 / b;
  let h = d;
  for (let i = 1; i < 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b;
    d = Math.abs(d) < tiny ? tiny : d;
    c = b + an / c;
    c = Math.abs(c) < tiny ? tiny : c;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}

function chi2Sf(x: number, dof: number): number {
  if (x <= 0) {
    return 1.0;
  }
  const a = dof / 2;
  const y = x / 2;
  if (y < a + 1) {
    return Math.max(0.0, 1.0 - gammaPSeries(a, y));
  }
  return gammaQFraction(a, y);
}

type ChiSquareResult = { statistic: number; dof: number; p_value: number; cramers_v: number };

type Counts = Map<string, number>;

function chiSquareTest(referenceCounts: Counts, currentCounts: Counts): ChiSquareResult {
  const all = [...new Set([...referenceCounts.keys(), ...currentCounts.keys()])].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0));
  const categories = all.filter((c) => (referenceCounts.get(c) ?? 0) + (currentCounts.get(c) ?? 0) > 0);
  const rows = [categories.map((c) => referenceCounts.get(c) ?? 0), categories.map((c) => currentCounts.get(c) ?? 0)];
  const rowTotals = rows.map((r) => r.reduce((s, v) => s + v, 0));
  const grand = rowTotals.reduce((s, v) => s + v, 0);
  if (categories.length < 2 || rowTotals.includes(0)) {
    return { statistic: 0.0, dof: 0, p_value: 1.0, cramers_v: 0.0 };
  }
  let statistic = 0.0;
  for (let col = 0; col < categories.length; col++) {
    const colTotal = rows[0][col] + rows[1][col];
    for (let r = 0; r < 2; r++) {
      const expected = (rowTotals[r] * colTotal) / grand;
      statistic += (rows[r][col] - expected) ** 2 / expected;
    }
  }
  const dof = categories.length - 1;
  return { statistic, dof, p_value: chi2Sf(statistic, dof), cramers_v: Math.sqrt(statistic / grand) };
}

function countCategories(values: readonly string[]): Counts {
  const counts: Counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

type Event = { t: number; amount: number; channel: string; label: number };

class SlidingWindow {
  readonly items: Event[] = [];
  readonly maxlen: number;

  constructor(size: number) {
    if (size < 1) {
      throw new Error(`window size must be at least 1, got ${size}`);
    }
    this.maxlen = size;
  }

  add(item: Event): void {
    this.items.push(item);
    if (this.items.length > this.maxlen) this.items.shift();
  }

  full(): boolean {
    return this.items.length === this.maxlen;
  }

  column<K extends keyof Event>(key: K): Event[K][] {
    return this.items.map((item) => item[key]);
  }
}

type NumericKey = "amount";
type CategoricalKey = "channel";
type Metrics = { [metric: string]: number };

class DriftMonitor {
  readonly referenceValues = new Map<NumericKey, number[]>();
  readonly edges = new Map<NumericKey, number[]>();
  readonly expected = new Map<NumericKey, number[]>();
  readonly referenceCounts = new Map<CategoricalKey, Counts>();

  constructor(
    reference: readonly Event[],
    readonly numeric: NumericKey[],
    readonly categorical: CategoricalKey[],
    bins = 10,
  ) {
    for (const f of numeric) this.referenceValues.set(f, reference.map((r) => r[f]));
    for (const [f, v] of this.referenceValues) this.edges.set(f, quantileEdges(v, bins));
    for (const f of numeric) this.expected.set(f, binFractions(this.referenceValues.get(f)!, this.edges.get(f)!));
    for (const f of categorical) this.referenceCounts.set(f, countCategories(reference.map((r) => r[f])));
  }

  check(window: SlidingWindow): Map<string, Metrics> {
    const report = new Map<string, Metrics>();
    for (const f of this.numeric) {
      const current = window.column(f);
      const ref = this.referenceValues.get(f)!;
      const d = ksStatistic(ref, current);
      report.set(f, {
        psi: psiFromFractions(this.expected.get(f)!, binFractions(current, this.edges.get(f)!)),
        ks: d,
        ks_p: ksPvalue(d, ref.length, current.length),
      });
    }
    for (const f of this.categorical) {
      const result = chiSquareTest(this.referenceCounts.get(f)!, countCategories(window.column(f)));
      report.set(f, { chi2: result.statistic, p: result.p_value, v: result.cramers_v });
    }
    return report;
  }
}

class AlertPolicy {
  familyAlpha = 0.01;
  psiWarn = 0.1;
  psiDrift = 0.25;
  ksDrift = 0.1;
  minCramersV = 0.1;
  patience = 2;
  readonly streaks = new Map<string, number>();

  constructor(readonly nTests: number) {}

  get alpha(): number {
    return this.familyAlpha / this.nTests;
  }

  level(metrics: Metrics): string {
    if ("psi" in metrics) {
      if (metrics.psi >= this.psiDrift || (metrics.ks >= this.ksDrift && metrics.ks_p < this.alpha)) {
        return "drift";
      }
      return metrics.psi >= this.psiWarn ? "warn" : "ok";
    }
    if (metrics.p < this.alpha && metrics.v >= this.minCramersV) {
      return "drift";
    }
    return metrics.p < this.alpha ? "warn" : "ok";
  }

  update(name: string, level: string): string | null {
    const previous = this.streaks.get(name) ?? 0;
    const streak = level === "drift" ? previous + 1 : 0;
    this.streaks.set(name, streak);
    if (streak === this.patience) {
      return "ALERT";
    }
    if (previous >= this.patience && streak === 0) {
      return "resolved";
    }
    return null;
  }
}

type Segment = {
  start: number;
  amount_mean: number;
  amount_sd: number;
  channel_mix: [number, number, number];
  boundary: number;
};

function segment(start: number, amount_mean: number, amount_sd: number, channel_mix: [number, number, number], boundary: number): Segment {
  return { start, amount_mean, amount_sd, channel_mix, boundary };
}

const CHANNELS = ["app", "store", "web"] as const;

const SEGMENTS: readonly Segment[] = [
  segment(0, 100, 20, [0.35, 0.15, 0.5], 120),
  segment(3000, 118, 24, [0.6, 0.1, 0.3], 120),
  segment(5000, 100, 20, [0.35, 0.15, 0.5], 120),
  segment(6500, 100, 20, [0.35, 0.15, 0.5], 105),
];

function segmentAt(t: number, segments: readonly Segment[] = SEGMENTS): Segment {
  let current = segments[0];
  for (const s of segments) {
    if (t >= s.start) current = s;
  }
  return current;
}

function weightedChoice<T>(rng: Random, population: readonly T[], weights: readonly number[]): T {
  const cum: number[] = [];
  let acc = 0;
  for (const w of weights) {
    acc += w;
    cum.push(acc);
  }
  return population[Math.min(bisectRight(cum, rng() * acc), population.length - 1)];
}

function makeStream(n = 9000, seed = 30, segments: readonly Segment[] = SEGMENTS): Event[] {
  const rng = mulberry32(seed);
  const events: Event[] = [];
  for (let t = 0; t < n; t++) {
    const s = segmentAt(t, segments);
    const amount = gauss(rng, s.amount_mean, s.amount_sd);
    const channel = weightedChoice(rng, CHANNELS, s.channel_mix);
    const label = amount + gauss(rng, 0, 6) > s.boundary ? 1 : 0;
    events.push({ t, amount, channel, label });
  }
  return events;
}

function fitThreshold(events: readonly Event[]): number {
  const candidates = numericSort(events.map((e) => e.amount));
  let best = candidates[0];
  let bestAcc = -1.0;
  for (let k = 0; k < candidates.length; k += 5) {
    const threshold = candidates[k];
    const acc = events.filter((e) => (e.amount > threshold) === (e.label === 1)).length / events.length;
    if (acc > bestAcc) {
      best = threshold;
      bestAcc = acc;
    }
  }
  return best;
}

function labeledAccuracy(events: readonly Event[], predictions: readonly number[], now: number, size: number, delay: number): number | null {
  const knownEnd = now - delay;
  const start = Math.max(0, knownEnd - size);
  if (knownEnd <= start) {
    return null;
  }
  let hits = 0;
  for (let i = start; i < knownEnd; i++) if (predictions[i] === events[i].label) hits++;
  return hits / (knownEnd - start);
}

type WindowRow = {
  end: number;
  metrics: Map<string, Metrics>;
  levels: Map<string, string>;
  accuracy: number | null;
  events: string[];
};

function runMonitoring(
  events: readonly Event[],
  referenceSize = 2000,
  windowSize = 500,
  step = 250,
  labelDelay = 500,
  accuracyDrop = 0.05,
): [WindowRow[], number, number] {
  const reference = events.slice(0, referenceSize);
  const threshold = fitThreshold(reference);
  const predictions = events.map((e) => (e.amount > threshold ? 1 : 0));
  let refHits = 0;
  for (let i = 0; i < referenceSize; i++) if (predictions[i] === events[i].label) refHits++;
  const referenceAccuracy = refHits / referenceSize;
  const monitor = new DriftMonitor(reference, ["amount"], ["channel"]);
  const policy = new AlertPolicy(2);
  const window = new SlidingWindow(windowSize);
  const rows: WindowRow[] = [];
  for (const e of events.slice(referenceSize)) {
    window.add(e);
    const now = e.t + 1;
    if (!window.full() || (now - referenceSize) % step) {
      continue;
    }
    const metrics = monitor.check(window);
    const levels = new Map<string, string>();
    for (const [name, m] of metrics) levels.set(name, policy.level(m));
    const accuracy = labeledAccuracy(events, predictions, now, windowSize, labelDelay);
    if (accuracy !== null) {
      levels.set("accuracy", accuracy < referenceAccuracy - accuracyDrop ? "drift" : "ok");
    }
    const notes: string[] = [];
    for (const [name, level] of levels) {
      const outcome = policy.update(name, level);
      if (outcome) {
        notes.push(`${outcome} ${name}`);
      }
    }
    rows.push({ end: now, metrics, levels, accuracy, events: notes });
  }
  return [rows, threshold, referenceAccuracy];
}

function firstAlert(rows: readonly WindowRow[], name: string, after: number): number | null {
  for (const row of rows) {
    if (row.end > after && row.events.includes(`ALERT ${name}`)) {
      return row.end;
    }
  }
  return null;
}

function pyOpt(x: number | null): string {
  return x === null ? "None" : String(x);
}

function main(): void {
  const events = makeStream();
  const [rows, threshold, referenceAccuracy] = runMonitoring(events);
  console.log("Stream: 9000 events. Reference = first 2000. Window 500, step 250, label delay 500.");
  console.log("Changes: covariate drift 3000-5000, normal 5000-6500, concept drift from 6500.");
  console.log(`Model: predict 1 when amount > ${fx(threshold, 1)}. Reference accuracy ${fx(referenceAccuracy, 3)}.\n`);
  console.log(`${"end".padStart(5)}  ${"PSI".padStart(5)}  ${"KS D".padStart(5)}  ${"chi2 p".padStart(7)}  ${"acc".padStart(5)}  levels (amount/channel/accuracy)  events`);
  for (const row of rows) {
    const amount = row.metrics.get("amount")!;
    const channel = row.metrics.get("channel")!;
    const acc = row.accuracy === null ? "  -  " : fx(row.accuracy, 3);
    const levels = ["amount", "channel", "accuracy"].map((k) => row.levels.get(k) ?? "-").join("/");
    console.log(
      `${String(row.end).padStart(5)}  ${fx(amount.psi, 3).padStart(5)}  ${fx(amount.ks, 3).padStart(5)}  ${ex(channel.p, 1).padStart(7)}  ${acc}  ` +
        `${levels.padEnd(33)}  ${row.events.join(", ")}`,
    );
  }
  const covariate = firstAlert(rows, "amount", 3000);
  const concept = firstAlert(rows, "accuracy", 6500);
  const quiet = rows.filter((r) => r.end > 7000 && r.levels.get("amount") !== "ok").map((r) => r.end);
  console.log(`\nCovariate drift injected at 3000, input alert at ${pyOpt(covariate)}.`);
  console.log(`Concept drift injected at 6500, accuracy alert at ${pyOpt(concept)} (labels arrive 500 events late).`);
  console.log(
    `Input monitors after 7000: ${quiet.length === 0 ? "quiet" : `flagged [${quiet.join(", ")}]`}. Only outcomes showed the concept drift.`,
  );
}

export {};

main();
