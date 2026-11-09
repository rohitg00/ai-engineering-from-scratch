// Lesson: Feature Stores and Training-Serving Skew (phase 02 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/docs/en.md
// Run: npx tsx phases/02-ml-fundamentals/21-feature-stores-and-training-serving-skew/code/main.ts

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

function uniform(rng: Random, a: number, b: number): number {
  return a + (b - a) * rng();
}

function randint(rng: Random, a: number, b: number): number {
  return a + Math.floor(rng() * (b - a + 1));
}

function choice<T>(rng: Random, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)];
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

function round2(x: number): number {
  return Number(fx(x, 2)) + 0;
}

function stripZeros(s: string): string {
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

function fg(x: number): string {
  if (x === 0) return "0";
  const [mantissa, expText] = x.toExponential(5).split("e");
  const exp = Number(expText);
  if (exp < -4 || exp >= 6) {
    return `${stripZeros(mantissa)}e${exp < 0 ? "-" : "+"}${String(Math.abs(exp)).padStart(2, "0")}`;
  }
  return stripZeros(x.toFixed(5 - exp));
}

function pct(x: number, digits: number): string {
  return `${fx(x * 100, digits)}%`;
}

function pyFloat(x: number): string {
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function strCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

type Values = { [name: string]: number };

function pyDict(values: Values): string {
  return `{${Object.entries(values).map(([k, v]) => `'${k}': ${pyFloat(v)}`).join(", ")}}`;
}

type Event = { entity: string; day: number; amount: number };

class FeatureDefinition {
  constructor(
    readonly name: string,
    readonly entity: string,
    readonly aggregate: string,
    readonly windowDays: number | null,
    readonly defaultValue: number,
    readonly version = 1,
    readonly owner = "growth-team",
    readonly description = "",
  ) {}

  equals(other: FeatureDefinition): boolean {
    return (
      this.name === other.name &&
      this.entity === other.entity &&
      this.aggregate === other.aggregate &&
      this.windowDays === other.windowDays &&
      this.defaultValue === other.defaultValue &&
      this.version === other.version &&
      this.owner === other.owner &&
      this.description === other.description
    );
  }

  compute(events: readonly Event[], asOf: number): number {
    let visible = events.filter((e) => e.day <= asOf);
    if (this.windowDays !== null) {
      const windowDays = this.windowDays;
      visible = visible.filter((e) => e.day > asOf - windowDays);
    }
    if (this.aggregate === "count") {
      return visible.length;
    }
    if (this.aggregate === "sum") {
      return round2(visible.reduce((s, e) => s + e.amount, 0));
    }
    if (this.aggregate === "days_since_last") {
      return visible.length > 0 ? asOf - Math.max(...visible.map((e) => e.day)) : this.defaultValue;
    }
    throw new Error(`unknown aggregate '${this.aggregate}'`);
  }
}

class FeatureRegistry {
  private readonly definitions = new Map<string, FeatureDefinition>();

  private static key(name: string, version: number): string {
    return `${name}\u0000${version}`;
  }

  register(definition: FeatureDefinition): void {
    const key = FeatureRegistry.key(definition.name, definition.version);
    const existing = this.definitions.get(key);
    if (existing !== undefined && !existing.equals(definition)) {
      throw new Error(`${definition.name} v${definition.version} already exists: bump the version`);
    }
    this.definitions.set(key, definition);
  }

  get(name: string, version: number | null = null): FeatureDefinition {
    const versions = [...this.definitions.values()].filter((d) => d.name === name).map((d) => d.version);
    if (versions.length === 0) {
      throw new Error(`KeyError: '${name}'`);
    }
    const found = this.definitions.get(FeatureRegistry.key(name, version !== null ? version : Math.max(...versions)));
    if (found === undefined) {
      throw new Error(`KeyError: ('${name}', ${version})`);
    }
    return found;
  }

  resolve(ref: string): FeatureDefinition {
    if (!ref.includes("@")) {
      return this.get(ref);
    }
    const at = ref.indexOf("@");
    const name = ref.slice(0, at);
    const version = ref.slice(at + 1);
    if (!/^\d+$/.test(version)) {
      throw new Error(`bad feature reference '${ref}': use name@version, such as spend_30d@1`);
    }
    return this.get(name, Number(version));
  }

  names(): string[] {
    return [...new Set([...this.definitions.values()].map((d) => d.name))].sort(strCompare);
  }

  compute(names: readonly string[], events: readonly Event[], asOf: number): Values {
    const out: Values = {};
    for (const name of names) out[name] = this.resolve(name).compute(events, asOf);
    return out;
  }

  fillDefaults(names: readonly string[], values: Values | null): Values {
    const v = values ?? {};
    const out: Values = {};
    for (const name of names) out[name] = name in v ? v[name] : this.resolve(name).defaultValue;
    return out;
  }
}

type FeatureRow = { entity: string; day: number; values: Values };
type LabelRow = { entity: string; day: number; label: number };
type JoinedRow = { entity: string; day: number; label: number; feature_day: number | null; values: Values | null };

function groupEvents(events: readonly Event[]): Map<string, Event[]> {
  const grouped = new Map<string, Event[]>();
  for (const event of events) {
    const list = grouped.get(event.entity);
    if (list) list.push(event);
    else grouped.set(event.entity, [event]);
  }
  return grouped;
}

function backfill(registry: FeatureRegistry, names: readonly string[], events: readonly Event[], days: readonly number[]): FeatureRow[] {
  const rows: FeatureRow[] = [];
  const grouped = groupEvents(events);
  for (const entity of [...grouped.keys()].sort(strCompare)) {
    const entityEvents = grouped.get(entity)!;
    for (const day of days) {
      rows.push({ entity, day, values: registry.compute(names, entityEvents, day) });
    }
  }
  return rows;
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

function pointInTimeJoin(labels: readonly LabelRow[], rows: readonly FeatureRow[], ttlDays: number | null = null): JoinedRow[] {
  const byEntity = new Map<string, FeatureRow[]>();
  for (const row of rows) {
    const list = byEntity.get(row.entity);
    if (list) list.push(row);
    else byEntity.set(row.entity, [row]);
  }
  const daysIndex = new Map<string, number[]>();
  for (const [entity, entityRows] of byEntity) {
    entityRows.sort((a, b) => a.day - b.day);
    daysIndex.set(entity, entityRows.map((r) => r.day));
  }
  const joined: JoinedRow[] = [];
  for (const label of labels) {
    const days = daysIndex.get(label.entity) ?? [];
    const pos = bisectRight(days, label.day) - 1;
    let match: FeatureRow | null = pos >= 0 ? byEntity.get(label.entity)![pos] : null;
    if (match !== null && ttlDays !== null && label.day - match.day > ttlDays) {
      match = null;
    }
    joined.push({
      entity: label.entity,
      day: label.day,
      label: label.label,
      feature_day: match ? match.day : null,
      values: match ? match.values : null,
    });
  }
  return joined;
}

function naiveLatestJoin(labels: readonly LabelRow[], rows: readonly FeatureRow[]): JoinedRow[] {
  const latest = new Map<string, FeatureRow>();
  for (const row of rows) {
    const current = latest.get(row.entity);
    if (current === undefined || row.day > current.day) {
      latest.set(row.entity, row);
    }
  }
  return labels.map((label) => {
    const match = latest.get(label.entity);
    return {
      entity: label.entity,
      day: label.day,
      label: label.label,
      feature_day: match ? match.day : null,
      values: match ? match.values : null,
    };
  });
}

class OnlineStore {
  private readonly latest = new Map<string, FeatureRow>();

  constructor(readonly ttlDays: number) {}

  write(row: FeatureRow): void {
    const current = this.latest.get(row.entity);
    if (current === undefined || row.day >= current.day) {
      this.latest.set(row.entity, row);
    }
  }

  read(entity: string, now: number): Values | null {
    const row = this.latest.get(entity);
    if (row === undefined || row.day > now || now - row.day > this.ttlDays) {
      return null;
    }
    return { ...row.values };
  }

  age(entity: string, now: number): number | null {
    const row = this.latest.get(entity);
    return row === undefined ? null : now - row.day;
  }
}

function materialize(rows: readonly FeatureRow[], store: OnlineStore, upToDay: number): number {
  let written = 0;
  for (const row of rows) {
    if (row.day <= upToDay) {
      store.write(row);
      written += 1;
    }
  }
  return written;
}

function trainingFeatures(registry: FeatureRegistry, names: readonly string[], joined: readonly JoinedRow[]): Values[] {
  return joined.map((row) => registry.fillDefaults(names, row.values));
}

function servingFeatures(registry: FeatureRegistry, names: readonly string[], store: OnlineStore, entity: string, now: number): Values {
  return registry.fillDefaults(names, store.read(entity, now));
}

type Request = [string, number];

function requestKey([entity, day]: Request): string {
  return `${entity}\u0000${day}`;
}

function compareRequests(a: Request, b: Request): number {
  return strCompare(a[0], b[0]) || a[1] - b[1];
}

function logServingRequests(
  registry: FeatureRegistry,
  names: readonly string[],
  offline: readonly FeatureRow[],
  requests: readonly Request[],
  ttlDays: number,
): Map<string, Values> {
  const store = new OnlineStore(ttlDays);
  const log = new Map<string, Values>();
  for (const req of [...requests].sort((a, b) => a[1] - b[1])) {
    const [entity, day] = req;
    materialize(offline, store, day);
    log.set(requestKey(req), servingFeatures(registry, names, store, entity, day));
  }
  return log;
}

function legacyServingFeatures(events: readonly Event[], now: number): Values {
  const recent = events.filter((e) => now - 30 <= e.day && e.day <= now);
  const past = events.filter((e) => e.day <= now).map((e) => e.day);
  return {
    days_since_last_purchase: past.length > 0 ? now - Math.max(...past) : -1.0,
    purchases_30d: recent.length,
    spend_30d: round2(recent.reduce((s, e) => s + e.amount, 0)),
  };
}

type SkewReport = { feature: string; compared: number; mismatch_rate: number; mean_abs_diff: number; flagged: boolean };

function detectSkew(
  training: Map<string, Values>,
  serving: Map<string, Values>,
  features: readonly string[],
  tolerance = 1e-6,
  maxMismatchRate = 0.01,
): SkewReport[] {
  const onlyOne = [...training.keys()].filter((k) => !serving.has(k)).length + [...serving.keys()].filter((k) => !training.has(k)).length;
  if (onlyOne > 0) {
    throw new Error(`${onlyOne} keys are in only one view: log and compare the same requests`);
  }
  if (training.size === 0) {
    throw new Error("no requests to compare");
  }
  const keys = [...training.keys()].sort(strCompare);
  const reports: SkewReport[] = [];
  for (const feature of features) {
    const diffs = keys.map((k) => Math.abs(training.get(k)![feature] - serving.get(k)![feature]));
    const mismatches = diffs.filter((d) => d > tolerance).length;
    const rate = mismatches / keys.length;
    const meanDiff = diffs.reduce((s, d) => s + d, 0) / keys.length;
    reports.push({ feature, compared: keys.length, mismatch_rate: rate, mean_abs_diff: meanDiff, flagged: rate > maxMismatchRate });
  }
  return reports;
}

const FEATURES = ["days_since_last_purchase", "purchases_30d", "spend_30d"];

function buildRegistry(): FeatureRegistry {
  const registry = new FeatureRegistry();
  registry.register(new FeatureDefinition("purchases_30d", "user", "count", 30, 0.0, 1, "growth-team", "purchases in the last 30 days"));
  registry.register(new FeatureDefinition("spend_30d", "user", "sum", 30, 0.0, 1, "growth-team", "spend in the last 30 days"));
  registry.register(new FeatureDefinition("days_since_last_purchase", "user", "days_since_last", null, 365.0, 1, "growth-team", "days since the last purchase"));
  return registry;
}

function makeEvents(nUsers = 300, days = 180, seed = 11): [Event[], Map<string, number | null>] {
  const rng = mulberry32(seed);
  const events: Event[] = [];
  const churnDay = new Map<string, number | null>();
  for (let u = 0; u < nUsers; u++) {
    const user = `u${String(u).padStart(3, "0")}`;
    const rate = uniform(rng, 0.08, 0.35);
    const stop = rng() < 0.5 ? randint(rng, 40, 170) : null;
    churnDay.set(user, stop);
    for (let day = 0; day < days; day++) {
      if (stop !== null && day >= stop) break;
      if (rng() < rate) {
        events.push({ entity: user, day, amount: round2(uniform(rng, 5, 80)) });
      }
    }
  }
  return [events, churnDay];
}

function makeLabels(events: readonly Event[], labelDays: readonly number[], horizon = 30): LabelRow[] {
  const grouped = groupEvents(events);
  const labels: LabelRow[] = [];
  for (const user of [...grouped.keys()].sort(strCompare)) {
    const userEvents = grouped.get(user)!;
    for (const day of labelDays) {
      if (!userEvents.some((e) => e.day <= day)) continue;
      const future = userEvents.some((e) => day < e.day && e.day <= day + horizon);
      labels.push({ entity: user, day, label: future ? 0 : 1 });
    }
  }
  return labels;
}

function fitIdleRule(features: readonly Values[], labels: readonly number[]): [number, number] {
  let bestThreshold = 0.0;
  let bestAcc = -1.0;
  for (let threshold = 0; threshold < 120; threshold++) {
    const acc = ruleAccuracy(threshold, features, labels);
    if (acc > bestAcc) {
      bestThreshold = threshold;
      bestAcc = acc;
    }
  }
  return [bestThreshold, bestAcc];
}

function ruleAccuracy(threshold: number, features: readonly Values[], labels: readonly number[]): number {
  const preds = features.map((f) => (f.days_since_last_purchase > threshold ? 1 : 0));
  return preds.filter((p, i) => p === labels[i]).length / labels.length;
}

const SNAPSHOT_DAYS: number[] = [];
for (let d = 7; d < 176; d += 7) SNAPSHOT_DAYS.push(d);
const TTL_DAYS = 10;

function main(): void {
  const registry = buildRegistry();
  const [events] = makeEvents();
  const offline = backfill(registry, FEATURES, events, SNAPSHOT_DAYS);
  console.log("=== Feature registry ===");
  for (const name of registry.names()) {
    const d = registry.get(name);
    const window = d.windowDays ? `${d.windowDays}d` : "all";
    console.log(
      `  ${d.name.padEnd(26)} v${d.version}  entity=${d.entity}  window=${window.padEnd(4)} default=${fg(d.defaultValue)}  ${d.description}`,
    );
  }
  console.log(`  backfilled ${offline.length} rows on ${SNAPSHOT_DAYS.length} weekly snapshot days`);

  console.log("\n=== Point-in-time join versus naive latest join ===");
  const trainLabels = makeLabels(events, [100, 120, 140]);
  const yTrain = trainLabels.map((r) => r.label);
  const pit = pointInTimeJoin(trainLabels, offline, TTL_DAYS);
  const naive = naiveLatestJoin(trainLabels, offline);
  const future = naive.filter((r) => r.feature_day !== null && r.feature_day > r.day).length;
  console.log(`  ${trainLabels.length} labels, churn rate ${fx(yTrain.reduce((s, v) => s + v, 0) / yTrain.length, 2)}`);
  console.log(`  naive join used a snapshot from after the label day for ${pct(future / naive.length, 0)} of rows`);
  const [pitThreshold, pitAcc] = fitIdleRule(trainingFeatures(registry, FEATURES, pit), yTrain);
  const [naiveThreshold, naiveAcc] = fitIdleRule(trainingFeatures(registry, FEATURES, naive), yTrain);
  console.log(`  offline accuracy, naive join: ${fx(naiveAcc, 3)} (rule: idle > ${fg(naiveThreshold)} days)`);
  console.log(`  offline accuracy, PIT join:   ${fx(pitAcc, 3)} (rule: idle > ${fg(pitThreshold)} days)`);
  const laterLabels = makeLabels(events, [145]);
  const later = trainingFeatures(registry, FEATURES, pointInTimeJoin(laterLabels, offline, TTL_DAYS));
  const yLater = laterLabels.map((r) => r.label);
  console.log(`  accuracy on day 145, trained with naive join: ${fx(ruleAccuracy(naiveThreshold, later, yLater), 3)}`);
  console.log(`  accuracy on day 145, trained with PIT join:   ${fx(ruleAccuracy(pitThreshold, later, yLater), 3)}`);

  console.log("\n=== Online store with a TTL of 10 days ===");
  const store = new OnlineStore(TTL_DAYS);
  materialize(offline, store, 145);
  const user = "u001";
  console.log(`  day 145: ${user} row age ${store.age(user, 145)} days -> ${pyDict(servingFeatures(registry, FEATURES, store, user, 145))}`);
  console.log(
    `  day 160: ${user} row age ${store.age(user, 160)} days -> ${pyDict(servingFeatures(registry, FEATURES, store, user, 160))} (expired, defaults)`,
  );

  const grouped = groupEvents(events);
  const rng = mulberry32(5);
  const users = [...[...grouped.keys()].sort(strCompare), ...Array.from({ length: 20 }, (_, i) => `new${String(i).padStart(2, "0")}`)];
  const unique = new Map<string, Request>();
  for (let k = 0; k < 400; k++) {
    const req: Request = [choice(rng, users), randint(rng, 141, 150)];
    unique.set(requestKey(req), req);
  }
  const requests = [...unique.values()].sort(compareRequests);
  console.log(`\n=== Skew checks on ${requests.length} logged requests, days 141 to 150 ===`);
  const joined = pointInTimeJoin(requests.map(([e, d]) => ({ entity: e, day: d, label: 0 })), offline, TTL_DAYS);
  const trainingRows = trainingFeatures(registry, FEATURES, joined);
  const trainingView = new Map<string, Values>(requests.map((r, i) => [requestKey(r), trainingRows[i]]));
  const storeLog = logServingRequests(registry, FEATURES, offline, requests, TTL_DAYS);
  const freshLog = new Map<string, Values>(requests.map((r) => [requestKey(r), registry.compute(FEATURES, grouped.get(r[0]) ?? [], r[1])]));
  const legacyLog = new Map<string, Values>(requests.map((r) => [requestKey(r), legacyServingFeatures(grouped.get(r[0]) ?? [], r[1])]));
  const checks: [string, Map<string, Values>, Map<string, Values>][] = [
    ["online store read  vs  training join (one definition, same snapshots)", trainingView, storeLog],
    ["fresh compute      vs  training join (staleness only)", trainingView, freshLog],
    ["second code path   vs  fresh compute (code differences only)", freshLog, legacyLog],
  ];
  for (const [title, expected, logged] of checks) {
    console.log(`  ${title}`);
    for (const report of detectSkew(expected, logged, FEATURES)) {
      const flag = report.flagged ? "SKEW" : "ok  ";
      console.log(
        `    ${flag} ${report.feature.padEnd(26)} mismatch ${pct(report.mismatch_rate, 1).padStart(6)}  mean |diff| ${fx(report.mean_abs_diff, 2).padStart(7)}`,
      );
    }
  }
}

export {};

main();
