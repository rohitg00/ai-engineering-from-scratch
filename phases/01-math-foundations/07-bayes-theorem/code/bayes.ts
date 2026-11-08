// Lesson: Bayes' Theorem (phase 01 / lesson 07)
// TypeScript port of code/bayes.py. Node standard library only.
// Source: phases/01-math-foundations/07-bayes-theorem/docs/en.md
// Run: npx tsx phases/01-math-foundations/07-bayes-theorem/code/bayes.ts
type Random = () => number;

function mulberry32(seed: number): Random {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(random: Random, mean: number, std: number): number {
  let u1 = random();
  while (u1 === 0) {
    u1 = random();
  }
  const u2 = random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + std * z;
}

function percent(value: number, digits: number): string {
  return `${(value * 100).toFixed(digits)}%`;
}

function bayes(prior: number, likelihood: number, falsePositiveRate: number): number {
  const evidence = likelihood * prior + falsePositiveRate * (1 - prior);
  const posterior = (likelihood * prior) / evidence;
  return posterior;
}

function sequentialBayes(
  prior: number,
  likelihood: number,
  falsePositiveRate: number,
  numTests: number,
): number {
  let current = prior;
  for (let i = 0; i < numTests; i++) {
    current = bayes(current, likelihood, falsePositiveRate);
    console.log(`  After test ${i + 1}: P(sick|positive) = ${current.toFixed(6)}`);
  }
  return current;
}

class NaiveBayes {
  smoothing: number;
  classCounts = new Map<string, number>();
  wordCounts = new Map<string, Map<string, number>>();
  classWordTotals = new Map<string, number>();
  vocab = new Set<string>();

  constructor(smoothing = 1.0) {
    this.smoothing = smoothing;
  }

  train(documents: string[], labels: string[]): void {
    for (let i = 0; i < documents.length; i++) {
      const doc = documents[i]!;
      const label = labels[i]!;
      this.classCounts.set(label, (this.classCounts.get(label) ?? 0) + 1);
      if (!this.wordCounts.has(label)) {
        this.wordCounts.set(label, new Map());
      }
      const counts = this.wordCounts.get(label)!;
      const words = doc.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
      for (const word of words) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
        this.classWordTotals.set(label, (this.classWordTotals.get(label) ?? 0) + 1);
        this.vocab.add(word);
      }
    }
  }

  logPrior(cls: string): number {
    let totalDocs = 0;
    for (const count of this.classCounts.values()) {
      totalDocs += count;
    }
    return Math.log((this.classCounts.get(cls) ?? 0) / totalDocs);
  }

  logLikelihood(word: string, cls: string): number {
    const count = this.wordCounts.get(cls)?.get(word) ?? 0;
    const total = this.classWordTotals.get(cls) ?? 0;
    const vocabSize = this.vocab.size;
    return Math.log((count + this.smoothing) / (total + this.smoothing * vocabSize));
  }

  predict(document: string): string {
    const words = document.toLowerCase().split(/\s+/).filter((word) => this.vocab.has(word));
    let bestClass = "";
    let bestScore = -Infinity;

    for (const cls of this.classCounts.keys()) {
      let score = this.logPrior(cls);
      for (const word of words) {
        score += this.logLikelihood(word, cls);
      }
      if (score > bestScore) {
        bestScore = score;
        bestClass = cls;
      }
    }

    return bestClass;
  }

  predictProba(document: string): Map<string, number> {
    const words = document.toLowerCase().split(/\s+/).filter((word) => this.vocab.has(word));
    const scores = new Map<string, number>();

    for (const cls of this.classCounts.keys()) {
      let score = this.logPrior(cls);
      for (const word of words) {
        score += this.logLikelihood(word, cls);
      }
      scores.set(cls, score);
    }

    const maxScore = Math.max(...scores.values());
    const expScores = new Map<string, number>();
    let total = 0;
    for (const [cls, score] of scores) {
      const value = Math.exp(score - maxScore);
      expScores.set(cls, value);
      total += value;
    }
    const probabilities = new Map<string, number>();
    for (const [cls, value] of expScores) {
      probabilities.set(cls, value / total);
    }
    return probabilities;
  }

  topWords(cls: string, n = 10): [string, number][] {
    const vocabSize = this.vocab.size;
    const total = this.classWordTotals.get(cls) ?? 0;
    const probs: [string, number][] = [];
    for (const word of this.vocab) {
      const count = this.wordCounts.get(cls)?.get(word) ?? 0;
      probs.push([word, (count + this.smoothing) / (total + this.smoothing * vocabSize)]);
    }
    probs.sort((a, b) => b[1] - a[1]);
    return probs.slice(0, n);
  }
}

function demoBayesTheorem(): void {
  console.log("=".repeat(60));
  console.log("BAYES' THEOREM: MEDICAL TEST");
  console.log("=".repeat(60));

  const prior = 0.0001;
  const likelihood = 0.99;
  const fpr = 0.01;

  const posterior = bayes(prior, likelihood, fpr);
  console.log(`\n  Disease prevalence (prior):   ${prior}`);
  console.log(`  Test sensitivity (likelihood): ${likelihood}`);
  console.log(`  False positive rate:           ${fpr}`);
  console.log(
    `  P(sick | positive):            ${posterior.toFixed(4)} (${(posterior * 100).toFixed(2)}%)`,
  );
  console.log(
    `\n  Despite 99% test accuracy, only ${(posterior * 100).toFixed(2)}% of positives are truly sick.`,
  );

  console.log(`\n  Sequential testing (2 positive tests):`);
  sequentialBayes(prior, likelihood, fpr, 2);
}

function demoSpamFilter(): void {
  console.log("\n" + "=".repeat(60));
  console.log("BAYES' THEOREM: SPAM FILTER");
  console.log("=".repeat(60));

  const pSpam = 0.3;
  const pLotteryGivenSpam = 0.05;
  const pLotteryGivenHam = 0.001;

  const pLottery = pLotteryGivenSpam * pSpam + pLotteryGivenHam * (1 - pSpam);
  const pSpamGivenLottery = (pLotteryGivenSpam * pSpam) / pLottery;

  console.log(`\n  P(spam):                 ${pSpam}`);
  console.log(`  P('lottery' | spam):     ${pLotteryGivenSpam}`);
  console.log(`  P('lottery' | not spam): ${pLotteryGivenHam}`);
  console.log(
    `  P(spam | 'lottery'):     ${pSpamGivenLottery.toFixed(4)} (${(pSpamGivenLottery * 100).toFixed(1)}%)`,
  );
}

function demoNaiveBayes(): void {
  console.log("\n" + "=".repeat(60));
  console.log("NAIVE BAYES SPAM CLASSIFIER");
  console.log("=".repeat(60));

  const trainDocs = [
    "win free money now",
    "free lottery ticket winner",
    "claim your prize today free",
    "urgent offer free cash",
    "congratulations you won free",
    "meeting tomorrow at noon",
    "project update attached",
    "can we schedule a call",
    "quarterly report review",
    "lunch on thursday sounds good",
    "team standup notes attached",
    "please review the pull request",
  ];

  const trainLabels = [
    "spam", "spam", "spam", "spam", "spam",
    "ham", "ham", "ham", "ham", "ham", "ham", "ham",
  ];

  const classifier = new NaiveBayes(1.0);
  classifier.train(trainDocs, trainLabels);

  const spamCount = trainLabels.filter((label) => label === "spam").length;
  const hamCount = trainLabels.filter((label) => label === "ham").length;
  console.log(`\n  Training: ${trainDocs.length} documents (${spamCount} spam, ${hamCount} ham)`);
  console.log(`  Vocabulary size: ${classifier.vocab.size}`);

  const testMessages = [
    "free money waiting for you",
    "meeting rescheduled to friday",
    "you won a free prize",
    "please review the attached report",
    "urgent free offer claim now",
    "can we discuss the project update",
  ];

  console.log("\n  Predictions:");
  for (const msg of testMessages) {
    const prediction = classifier.predict(msg);
    const proba = classifier.predictProba(msg);
    const confidence = proba.get(prediction)!;
    console.log(`    '${msg}'`);
    console.log(`      -> ${prediction} (confidence: ${confidence.toFixed(3)})`);
  }

  console.log("\n  Top 5 spam indicator words:");
  for (const [word, prob] of classifier.topWords("spam", 5)) {
    console.log(`    ${word}: ${prob.toFixed(4)}`);
  }

  console.log("\n  Top 5 ham indicator words:");
  for (const [word, prob] of classifier.topWords("ham", 5)) {
    console.log(`    ${word}: ${prob.toFixed(4)}`);
  }
}

function demoMleVsMap(): void {
  console.log("\n" + "=".repeat(60));
  console.log("MLE vs MAP ESTIMATION");
  console.log("=".repeat(60));

  const heads = 7;
  const total = 10;

  const mle = heads / total;
  console.log(`\n  Observed: ${heads} heads in ${total} flips`);
  console.log(`  MLE estimate: ${mle.toFixed(4)}`);

  let alpha = 2;
  let beta = 2;
  const mapEstimate = (heads + alpha - 1) / (total + alpha + beta - 2);
  console.log(`\n  Beta(${alpha},${beta}) prior (mild bias toward 0.5)`);
  console.log(`  MAP estimate: ${mapEstimate.toFixed(4)}`);

  alpha = 10;
  beta = 10;
  const mapStrong = (heads + alpha - 1) / (total + alpha + beta - 2);
  console.log(`\n  Beta(${alpha},${beta}) prior (strong bias toward 0.5)`);
  console.log(`  MAP estimate: ${mapStrong.toFixed(4)}`);

  console.log("\n  Stronger prior pulls the estimate toward 0.5 (prior mean).");
  console.log("  This is the same effect as L2 regularization pulling weights toward zero.");
}

function betaUpdate(
  alpha: number,
  betaParam: number,
  successes: number,
  failures: number,
): [number, number] {
  return [alpha + successes, betaParam + failures];
}

function sequentialUpdateDemo(): void {
  console.log("\n" + "=".repeat(60));
  console.log("SEQUENTIAL BAYESIAN UPDATING");
  console.log("=".repeat(60));

  let alpha = 1;
  let betaParam = 1;
  console.log(`\n  Starting prior: Beta(${alpha}, ${betaParam})`);
  console.log(`  Prior mean: ${(alpha / (alpha + betaParam)).toFixed(4)}`);

  const batches: [number, number, string][] = [
    [7, 3, "Day 1: 7 heads, 3 tails"],
    [5, 5, "Day 2: 5 heads, 5 tails"],
    [3, 7, "Day 3: 3 heads, 7 tails"],
    [6, 4, "Day 4: 6 heads, 4 tails"],
  ];

  for (const [successes, failures, description] of batches) {
    [alpha, betaParam] = betaUpdate(alpha, betaParam, successes, failures);
    const mean = alpha / (alpha + betaParam);
    console.log(`\n  ${description}`);
    console.log(`  Posterior: Beta(${alpha}, ${betaParam})`);
    console.log(`  Posterior mean: ${mean.toFixed(4)}`);
    const variance =
      (alpha * betaParam) / ((alpha + betaParam) ** 2 * (alpha + betaParam + 1));
    const std = variance ** 0.5;
    console.log(`  Posterior std:  ${std.toFixed(4)}`);
  }

  console.log(`\n  Final belief after all data: Beta(${alpha}, ${betaParam})`);
  console.log(`  Mean = ${(alpha / (alpha + betaParam)).toFixed(4)}`);

  let alphaBatch = 1;
  let betaBatch = 1;
  let totalSuccesses = 0;
  let totalFailures = 0;
  for (const [successes, failures] of batches) {
    totalSuccesses += successes;
    totalFailures += failures;
  }
  alphaBatch += totalSuccesses;
  betaBatch += totalFailures;
  console.log(`\n  Batch update (all data at once): Beta(${alphaBatch}, ${betaBatch})`);
  console.log(`  Mean = ${(alphaBatch / (alphaBatch + betaBatch)).toFixed(4)}`);
  const same = alpha === alphaBatch && betaParam === betaBatch;
  console.log(`  Sequential and batch give the same result: ${same ? "True" : "False"}`);
}

function abTestDemo(): void {
  console.log("\n" + "=".repeat(60));
  console.log("BAYESIAN A/B TESTING");
  console.log("=".repeat(60));

  let random = mulberry32(42);

  const aClicks = 50;
  const aViews = 1000;
  const bClicks = 65;
  const bViews = 1000;

  const aAlpha = 1 + aClicks;
  const aBeta = 1 + (aViews - aClicks);
  const bAlpha = 1 + bClicks;
  const bBeta = 1 + (bViews - bClicks);

  console.log(`\n  Variant A: ${aClicks}/${aViews} clicks`);
  console.log(`  Variant B: ${bClicks}/${bViews} clicks`);
  console.log(
    `\n  Posterior A: Beta(${aAlpha}, ${aBeta}), mean = ${(aAlpha / (aAlpha + aBeta)).toFixed(4)}`,
  );
  console.log(
    `  Posterior B: Beta(${bAlpha}, ${bBeta}), mean = ${(bAlpha / (bAlpha + bBeta)).toFixed(4)}`,
  );

  const nSamples = 100000;
  let bWins = 0;
  for (let i = 0; i < nSamples; i++) {
    const sampleA = betaSample(aAlpha, aBeta, random);
    const sampleB = betaSample(bAlpha, bBeta, random);
    if (sampleB > sampleA) {
      bWins += 1;
    }
  }

  const pBBetter = bWins / nSamples;
  console.log(`\n  Monte Carlo samples: ${nSamples}`);
  console.log(`  P(B > A) = ${pBBetter.toFixed(4)}`);

  if (pBBetter > 0.95) {
    console.log("  Decision: Ship variant B");
  } else if (pBBetter < 0.05) {
    console.log("  Decision: Ship variant A");
  } else {
    console.log("  Decision: Keep collecting data");
  }

  console.log("\n  Lift estimate:");
  const lifts: number[] = [];
  random = mulberry32(42);
  for (let i = 0; i < nSamples; i++) {
    const sa = betaSample(aAlpha, aBeta, random);
    const sb = betaSample(bAlpha, bBeta, random);
    if (sa > 0) {
      lifts.push((sb - sa) / sa);
    }
  }
  lifts.sort((a, b) => a - b);
  const medianLift = lifts[Math.floor(lifts.length / 2)]!;
  const low = lifts[Math.floor(lifts.length * 0.05)]!;
  const high = lifts[Math.floor(lifts.length * 0.95)]!;
  console.log(`  Median lift: ${percent(medianLift, 1)}`);
  console.log(`  90% credible interval: [${percent(low, 1)}, ${percent(high, 1)}]`);
}

function betaSample(alpha: number, betaParam: number, random: Random): number {
  const x = gammaSample(alpha, random);
  const y = gammaSample(betaParam, random);
  if (x + y === 0) {
    return 0.5;
  }
  return x / (x + y);
}

function gammaSample(shape: number, random: Random): number {
  if (shape <= 0) {
    throw new Error("Gamma shape parameter must be positive");
  }
  if (shape < 1) {
    return gammaSample(shape + 1, random) * random() ** (1.0 / shape);
  }

  const d = shape - 1.0 / 3.0;
  const c = 1.0 / (9.0 * d) ** 0.5;

  while (true) {
    const x = gauss(random, 0, 1);
    const v = (1 + c * x) ** 3;
    if (v <= 0) {
      continue;
    }
    const u = random();
    if (u < 1 - 0.0331 * x ** 4) {
      return d * v;
    }
    if (Math.log(u) < 0.5 * x ** 2 + d * (1 - v + Math.log(v))) {
      return d * v;
    }
  }
}

demoBayesTheorem();
demoSpamFilter();
demoNaiveBayes();
demoMleVsMap();
sequentialUpdateDemo();
abTestDemo();
