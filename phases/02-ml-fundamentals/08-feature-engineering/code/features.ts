// Lesson: Feature Engineering (phase 02 / lesson 08)
// TypeScript port of code/features.py. Node standard library only.
// Source: phases/02-ml-fundamentals/08-feature-engineering/docs/en.md
// Run: npx tsx phases/02-ml-fundamentals/08-feature-engineering/code/features.ts

type Maybe = number | null;
type Category = string | number;

class Random {
  private state: number;
  private spare: number | null = null;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  uniform(a: number, b: number): number {
    return a + (b - a) * this.next();
  }

  choice<T>(items: T[]): T {
    if (items.length === 0) throw new Error("cannot choose from an empty sequence");
    return items[Math.floor(this.next() * items.length)];
  }

  gauss(mu: number, sigma: number): number {
    if (this.spare !== null) {
      const value = this.spare;
      this.spare = null;
      return mu + sigma * value;
    }
    let u = 0;
    while (u === 0) u = this.next();
    const v = this.next();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return mu + sigma * r * Math.cos(2 * Math.PI * v);
  }
}

function requireValues(values: unknown[], name: string): void {
  if (values.length === 0) throw new Error(`${name} needs at least one value`);
}

function sum(values: number[]): number {
  return values.reduce((s, v) => s + v, 0);
}

function pyNum(x: number): string {
  if (Number.isInteger(x)) return x.toFixed(1);
  return String(x);
}

function pyRepr(value: unknown): string {
  if (value === null) return "None";
  if (value === true) return "True";
  if (value === false) return "False";
  if (typeof value === "string") return `'${value}'`;
  if (typeof value === "number") return pyNum(value);
  if (Array.isArray(value)) return `[${value.map(pyRepr).join(", ")}]`;
  throw new Error("pyRepr supports None, booleans, strings, numbers, and lists");
}

function intList(values: number[]): string {
  return `[${values.join(", ")}]`;
}

function round(x: number, digits: number): number {
  const f = 10 ** digits;
  return Math.round(x * f) / f;
}

function minMaxScale(values: number[]): number[] {
  requireValues(values, "min_max_scale");
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (hi === lo) return values.map(() => 0);
  return values.map((v) => (v - lo) / (hi - lo));
}

function standardize(values: number[]): number[] {
  requireValues(values, "standardize");
  const n = values.length;
  const mean = sum(values) / n;
  const variance = sum(values.map((v) => (v - mean) ** 2)) / n;
  const std = variance > 0 ? Math.sqrt(variance) : 1;
  return values.map((v) => (v - mean) / std);
}

function logTransform(values: number[]): number[] {
  return values.map((v) => {
    if (v <= -1) throw new Error("log_transform needs values greater than -1");
    return Math.log(v + 1);
  });
}

function binValues(values: number[], nBins = 5): number[] {
  requireValues(values, "bin_values");
  if (nBins < 1) throw new Error("n_bins must be at least 1");
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const width = (hi - lo) / nBins;
  if (width === 0) return values.map(() => 0);
  return values.map((v) => Math.min(Math.trunc((v - lo) / width), nBins - 1));
}

function polynomialFeatures(row: number[], degree = 2): number[] {
  const n = row.length;
  const result = row.slice();
  if (degree >= 2) {
    for (let i = 0; i < n; i++) result.push(row[i] ** 2);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) result.push(row[i] * row[j]);
  }
  return result;
}

function sortedUnique<T extends Category>(values: T[]): T[] {
  const unique = Array.from(new Set(values));
  return unique.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function oneHotEncode<T extends Category>(values: T[]): [number[][], T[]] {
  const categories = sortedUnique(values);
  const index = new Map(categories.map((c, i) => [c, i] as [T, number]));
  const encoded = values.map((v) => {
    const row = new Array<number>(categories.length).fill(0);
    row[index.get(v)!] = 1;
    return row;
  });
  return [encoded, categories];
}

function labelEncode<T extends Category>(values: T[]): [number[], Map<T, number>] {
  const categories = sortedUnique(values);
  const mapping = new Map(categories.map((c, i) => [c, i] as [T, number]));
  return [values.map((v) => mapping.get(v)!), mapping];
}

function targetEncode<T extends Category>(
  featureValues: T[],
  targetValues: number[],
  smoothing = 10,
): [number[], Map<T, number>] {
  requireValues(targetValues, "target_encode");
  if (featureValues.length !== targetValues.length) {
    throw new Error("feature_values and target_values must have the same length");
  }
  const globalMean = sum(targetValues) / targetValues.length;
  const stats = new Map<T, { sum: number; count: number }>();
  featureValues.forEach((feat, i) => {
    if (!stats.has(feat)) stats.set(feat, { sum: 0, count: 0 });
    const s = stats.get(feat)!;
    s.sum += targetValues[i];
    s.count += 1;
  });
  const encoding = new Map<T, number>();
  for (const [cat, s] of stats) {
    const catMean = s.sum / s.count;
    const weight = s.count / (s.count + smoothing);
    encoding.set(cat, weight * catMean + (1 - weight) * globalMean);
  }
  return [featureValues.map((v) => encoding.get(v)!), encoding];
}

function tokens(doc: string): string[] {
  return doc.toLowerCase().split(/\s+/).filter((w) => w.length > 0);
}

function buildVocab(documents: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  for (const doc of documents) {
    for (const word of tokens(doc)) if (!vocab.has(word)) vocab.set(word, vocab.size);
  }
  return vocab;
}

function countVectorize(documents: string[]): [number[][], Map<string, number>] {
  const vocab = buildVocab(documents);
  const vectors = documents.map((doc) => {
    const vec = new Array<number>(vocab.size).fill(0);
    for (const word of tokens(doc)) vec[vocab.get(word)!] += 1;
    return vec;
  });
  return [vectors, vocab];
}

function tfidf(documents: string[]): [number[][], Map<string, number>] {
  const nDocs = documents.length;
  const vocab = buildVocab(documents);
  const docFreq = new Map<string, number>();
  for (const doc of documents) {
    for (const word of new Set(tokens(doc))) docFreq.set(word, (docFreq.get(word) ?? 0) + 1);
  }
  const vectors = documents.map((doc) => {
    const words = tokens(doc);
    const tf = new Map<string, number>();
    for (const w of words) tf.set(w, (tf.get(w) ?? 0) + 1);
    const vec = new Array<number>(vocab.size).fill(0);
    for (const [word, count] of tf) {
      vec[vocab.get(word)!] = (count / words.length) * Math.log(nDocs / docFreq.get(word)!);
    }
    return vec;
  });
  return [vectors, vocab];
}

function present(values: Maybe[]): number[] {
  return values.filter((v): v is number => v !== null);
}

function imputeMean(values: Maybe[]): [number[], number] {
  const p = present(values);
  if (p.length === 0) return [values.map(() => 0), 0];
  const mean = sum(p) / p.length;
  return [values.map((v) => (v === null ? mean : v)), mean];
}

function imputeMedian(values: Maybe[]): [number[], number] {
  const p = present(values).sort((a, b) => a - b);
  if (p.length === 0) return [values.map(() => 0), 0];
  const n = p.length;
  const median = n % 2 === 0 ? (p[n / 2 - 1] + p[n / 2]) / 2 : p[(n - 1) / 2];
  return [values.map((v) => (v === null ? median : v)), median];
}

function imputeMode<T extends Category>(values: (T | null)[]): [(T | null)[], T | null] {
  const p = values.filter((v): v is T => v !== null);
  if (p.length === 0) return [values, null];
  const counts = new Map<T, number>();
  for (const v of p) counts.set(v, (counts.get(v) ?? 0) + 1);
  let mode = p[0];
  for (const [v, c] of counts) if (c > counts.get(mode)!) mode = v;
  return [values.map((v) => (v === null ? mode : v)), mode];
}

function addMissingIndicator(values: Maybe[]): number[] {
  return values.map((v) => (v === null ? 1 : 0));
}

function correlation(x: number[], y: number[]): number {
  requireValues(x, "correlation");
  if (x.length !== y.length) throw new Error("x and y must have the same length");
  const n = x.length;
  const mx = sum(x) / n;
  const my = sum(y) / n;
  let cov = 0;
  let vx = 0;
  let vy = 0;
  for (let i = 0; i < n; i++) {
    cov += (x[i] - mx) * (y[i] - my);
    vx += (x[i] - mx) ** 2;
    vy += (y[i] - my) ** 2;
  }
  const sx = Math.sqrt(vx / n);
  const sy = Math.sqrt(vy / n);
  if (sx === 0 || sy === 0) return 0;
  return cov / n / (sx * sy);
}

function mutualInformation(feature: number[], target: number[], nBins = 10): number {
  requireValues(feature, "mutual_information");
  if (feature.length !== target.length) throw new Error("feature and target must have the same length");
  const lo = Math.min(...feature);
  const hi = Math.max(...feature);
  const width = hi !== lo ? (hi - lo) / nBins : 1;
  const binned = feature.map((f) => Math.min(Math.trunc((f - lo) / width), nBins - 1));
  const n = feature.length;

  const pFeat = new Map<number, number>();
  for (const b of binned) pFeat.set(b, (pFeat.get(b) ?? 0) + 1 / n);
  const pTarget = new Map<number, number>();
  for (const t of target) pTarget.set(t, (pTarget.get(t) ?? 0) + 1 / n);
  const joint = new Map<string, number>();
  binned.forEach((b, i) => {
    const key = `${b}|${target[i]}`;
    joint.set(key, (joint.get(key) ?? 0) + 1);
  });

  let mi = 0;
  for (const b of sortedUnique(binned)) {
    for (const t of sortedUnique(target)) {
      const pJoint = (joint.get(`${b}|${t}`) ?? 0) / n;
      if (pJoint > 0) mi += pJoint * Math.log(pJoint / (pFeat.get(b)! * pTarget.get(t)!));
    }
  }
  return mi;
}

function column(features: number[][], j: number): number[] {
  return features.map((row) => row[j]);
}

function varianceThreshold(features: number[][], threshold = 0.01): number[] {
  requireValues(features, "variance_threshold");
  const selected: number[] = [];
  for (let j = 0; j < features[0].length; j++) {
    const col = column(features, j);
    const mean = sum(col) / col.length;
    const variance = sum(col.map((v) => (v - mean) ** 2)) / col.length;
    if (variance >= threshold) selected.push(j);
  }
  return selected;
}

function removeCorrelated(features: number[][], threshold = 0.9): number[] {
  requireValues(features, "remove_correlated");
  const nFeatures = features[0].length;
  const toRemove = new Set<number>();
  for (let i = 0; i < nFeatures; i++) {
    if (toRemove.has(i)) continue;
    const ci = column(features, i);
    for (let j = i + 1; j < nFeatures; j++) {
      if (toRemove.has(j)) continue;
      if (Math.abs(correlation(ci, column(features, j))) >= threshold) toRemove.add(j);
    }
  }
  return Array.from({ length: nFeatures }, (_, i) => i).filter((i) => !toRemove.has(i));
}

type House = {
  sqft: Maybe;
  bedrooms: number;
  age: Maybe;
  neighborhood: string;
  has_pool: boolean;
  price: number;
};

function makeHousingData(n = 200, seed = 42): House[] {
  const rng = new Random(seed);
  const data: House[] = [];
  for (let i = 0; i < n; i++) {
    const sqft = rng.uniform(500, 5000);
    const bedrooms = rng.choice([1, 2, 3, 4, 5]);
    const age = rng.uniform(0, 50);
    const neighborhood = rng.choice(["downtown", "suburbs", "rural"]);
    const hasPool = rng.choice([true, false]);

    const sqftWithMissing = rng.next() > 0.05 ? sqft : null;
    const ageWithMissing = rng.next() > 0.08 ? age : null;

    const bonus = neighborhood === "downtown" ? 50000 : neighborhood === "suburbs" ? 10000 : 0;
    const price =
      50 * sqft + 20000 * bedrooms - 1000 * age + bonus + (hasPool ? 15000 : 0) + rng.gauss(0, 20000);

    data.push({
      sqft: sqftWithMissing,
      bedrooms,
      age: ageWithMissing,
      neighborhood,
      has_pool: hasPool,
      price,
    });
  }
  return data;
}

function pyMap(map: Map<string, number>): string {
  return `{${Array.from(map, ([k, v]) => `'${k}': ${v}`).join(", ")}}`;
}

function main(): void {
  const data = makeHousingData(200);

  console.log("=== Raw Data Sample ===");
  for (const row of data.slice(0, 3)) {
    const fields = [
      `'sqft': ${pyRepr(row.sqft)}`,
      `'bedrooms': ${row.bedrooms}`,
      `'age': ${pyRepr(row.age)}`,
      `'neighborhood': ${pyRepr(row.neighborhood)}`,
      `'has_pool': ${pyRepr(row.has_pool)}`,
      `'price': ${pyRepr(row.price)}`,
    ];
    console.log(`  {${fields.join(", ")}}`);
  }

  const sqftRaw = data.map((d) => d.sqft);
  const ageRaw = data.map((d) => d.age);
  const prices = data.map((d) => d.price);

  console.log("\n=== Missing Value Handling ===");
  console.log(`  sqft missing: ${sqftRaw.filter((v) => v === null).length}/${sqftRaw.length}`);
  console.log(`  age missing: ${ageRaw.filter((v) => v === null).length}/${ageRaw.length}`);

  const sqftIndicator = addMissingIndicator(sqftRaw);
  const ageIndicator = addMissingIndicator(ageRaw);
  const [sqftImputed, sqftFill] = imputeMedian(sqftRaw);
  const [ageImputed, ageFill] = imputeMean(ageRaw);
  console.log(`  sqft filled with median: ${sqftFill.toFixed(0)}`);
  console.log(`  age filled with mean: ${ageFill.toFixed(1)}`);

  console.log("\n=== Numerical Transforms ===");
  const sqftScaled = standardize(sqftImputed);
  const ageScaled = minMaxScale(ageImputed);
  logTransform(sqftImputed);
  const ageBinned = binValues(ageImputed, 5);
  const mean = sum(sqftScaled) / sqftScaled.length;
  const std = Math.sqrt(sum(sqftScaled.map((v) => v ** 2)) / sqftScaled.length);
  console.log(`  sqft standardized: mean=${mean.toFixed(4)}, std=${std.toFixed(4)}`);
  console.log(`  age min-max: [${Math.min(...ageScaled).toFixed(2)}, ${Math.max(...ageScaled).toFixed(2)}]`);
  console.log(`  age bins: ${intList(sortedUnique(ageBinned))}`);

  console.log("\n=== Categorical Encoding ===");
  const neighborhoods = data.map((d) => d.neighborhood);

  const [ohe, oheCats] = oneHotEncode(neighborhoods);
  console.log(`  One-hot categories: ${pyRepr(oheCats)}`);
  console.log(`  Sample encoding: ${neighborhoods[0]} -> ${intList(ohe[0])}`);

  const [, leMap] = labelEncode(neighborhoods);
  console.log(`  Label encoding map: ${pyMap(leMap)}`);

  const [, teMap] = targetEncode(neighborhoods, prices, 10);
  const rounded = new Map(Array.from(teMap, ([k, v]) => [k, Math.round(v)] as [string, number]));
  console.log(`  Target encoding: ${pyMap(rounded)}`);

  console.log("\n=== Text Features ===");
  const descriptions = [
    "large modern house with pool",
    "small cozy cottage near downtown",
    "spacious family home with large yard",
    "modern apartment downtown with view",
    "rustic cabin in rural area",
  ];
  const [cv, cvVocab] = countVectorize(descriptions);
  console.log(`  Vocabulary size: ${cvVocab.size}`);
  console.log(`  Doc 0 non-zero features: ${cv[0].filter((v) => v > 0).length}`);

  const [tf, tfVocab] = tfidf(descriptions);
  console.log(`  TF-IDF vocabulary size: ${tfVocab.size}`);
  const topWords = Array.from(tfVocab.keys())
    .map((w, order) => ({ w, order, score: tf[0][tfVocab.get(w)!] }))
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, 3)
    .map((x) => x.w);
  console.log(`  Doc 0 top TF-IDF words: ${pyRepr(topWords)}`);

  console.log("\n=== Polynomial Features ===");
  const sampleRow = [sqftScaled[0], ageScaled[0]];
  const poly = polynomialFeatures(sampleRow, 2);
  console.log(`  Input: ${pyRepr(sampleRow.map((v) => round(v, 4)))}`);
  console.log(`  Polynomial: ${pyRepr(poly.map((v) => round(v, 4)))}`);
  console.log("  Features: [x1, x2, x1^2, x2^2, x1*x2]");

  console.log("\n=== Feature Selection ===");
  const featureMatrix = data.map((_, i) =>
    [sqftScaled[i], ageScaled[i], sqftIndicator[i], ageIndicator[i]].concat(ohe[i]),
  );
  console.log(`  Total features: ${featureMatrix[0].length}`);

  const survivingVar = varianceThreshold(featureMatrix, 0.01);
  console.log(`  After variance threshold (0.01): ${survivingVar.length} features kept`);

  const survivingCorr = removeCorrelated(featureMatrix, 0.9);
  console.log(`  After correlation filter (0.9): ${survivingCorr.length} features kept`);

  const avgPrice = sum(prices) / prices.length;
  const binaryPrices = prices.map((p) => (p > avgPrice ? 1 : 0));
  console.log("\n  Mutual information with target:");
  const featureNames = ["sqft", "age", "sqft_missing", "age_missing"].concat(oheCats.map((c) => `neigh_${c}`));
  for (let j = 0; j < featureMatrix[0].length; j++) {
    const mi = mutualInformation(column(featureMatrix, j), binaryPrices, 10);
    console.log(`    ${featureNames[j]}: MI=${mi.toFixed(4)}`);
  }

  console.log("\n  Correlation with price:");
  for (let j = 0; j < featureMatrix[0].length; j++) {
    const corr = correlation(column(featureMatrix, j), prices);
    console.log(`    ${featureNames[j]}: r=${corr.toFixed(4)}`);
  }
}

main();
