// Lesson: Information Theory (phase 01 / lesson 09)
// TypeScript port of code/information_theory.py. Node standard library only.
// Source: phases/01-math-foundations/09-information-theory/docs/en.md
// Run: npx tsx phases/01-math-foundations/09-information-theory/code/information_theory.ts
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

function randint(random: Random, low: number, high: number): number {
  return low + Math.floor(random() * (high - low + 1));
}

function choice<T>(random: Random, options: T[]): T {
  return options[Math.floor(random() * options.length)]!;
}

function formatFloat(value: number): string {
  if (Number.isInteger(value)) {
    return value.toFixed(1);
  }
  return String(value);
}

function formatList(values: number[]): string {
  return `[${values.map(formatFloat).join(", ")}]`;
}

function formatMatrix(rows: number[][]): string {
  return `[${rows.map(formatList).join(", ")}]`;
}

function formatExponent(value: number, digits: number): string {
  const [mantissa, exponent] = value.toExponential(digits).split("e");
  const sign = exponent!.startsWith("-") ? "-" : "+";
  const power = exponent!.replace(/^[+-]/, "").padStart(2, "0");
  return `${mantissa}e${sign}${power}`;
}

function sum(values: number[]): number {
  let total = 0;
  for (const value of values) {
    total += value;
  }
  return total;
}

function informationContent(p: number, base = 2): number {
  if (p <= 0) {
    return Infinity;
  }
  if (p >= 1) {
    return 0.0;
  }
  return -Math.log(p) / Math.log(base);
}

function entropy(probs: number[], base = 2): number {
  let total = 0;
  for (const p of probs) {
    if (p > 0) {
      total += p * informationContent(p, base);
    }
  }
  return total;
}

function crossEntropy(p: number[], q: number[], base = 2): number {
  if (p.length !== q.length) {
    throw new Error("p and q must have the same length");
  }
  let total = 0.0;
  for (let i = 0; i < p.length; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi > 0) {
      if (qi <= 0) {
        return Infinity;
      }
      total += pi * (-Math.log(qi) / Math.log(base));
    }
  }
  return total;
}

function klDivergence(p: number[], q: number[], base = 2): number {
  return crossEntropy(p, q, base) - entropy(p, base);
}

function rowMarginals(jointProbs: number[][]): number[] {
  return jointProbs.map((row) => sum(row));
}

function columnMarginals(jointProbs: number[][]): number[] {
  const cols = jointProbs[0]!.length;
  const margins: number[] = [];
  for (let j = 0; j < cols; j++) {
    margins.push(sum(jointProbs.map((row) => row[j]!)));
  }
  return margins;
}

function mutualInformation(jointProbs: number[][], base = 2): number {
  const rows = jointProbs.length;
  const cols = jointProbs[0]!.length;

  const marginX = rowMarginals(jointProbs);
  const marginY = columnMarginals(jointProbs);

  let mi = 0.0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const pxy = jointProbs[i]![j]!;
      if (pxy > 0 && marginX[i]! > 0 && marginY[j]! > 0) {
        mi += (pxy * Math.log(pxy / (marginX[i]! * marginY[j]!))) / Math.log(base);
      }
    }
  }
  return mi;
}

function softmax(logits: number[]): number[] {
  const maxLogit = Math.max(...logits);
  const exps = logits.map((z) => Math.exp(z - maxLogit));
  const total = sum(exps);
  return exps.map((e) => e / total);
}

function crossEntropyLoss(trueClass: number, logits: number[]): number {
  const maxLogit = Math.max(...logits);
  const logSumExp = maxLogit + Math.log(sum(logits.map((z) => Math.exp(z - maxLogit))));
  return logSumExp - logits[trueClass]!;
}

function negativeLogLikelihood(labels: number[], allLogits: number[][]): number {
  let total = 0;
  for (let i = 0; i < labels.length; i++) {
    total += crossEntropyLoss(labels[i]!, allLogits[i]!);
  }
  return total / labels.length;
}

function perplexity(avgCrossEntropy: number, base = "e"): number {
  if (base === "e") {
    return Math.exp(avgCrossEntropy);
  }
  return 2 ** avgCrossEntropy;
}

function conditionalEntropy(jointProbs: number[][], base = 2): number {
  const rows = jointProbs.length;
  const cols = jointProbs[0]!.length;

  const marginX = rowMarginals(jointProbs);

  let hYX = 0.0;
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      const pxy = jointProbs[i]![j]!;
      if (pxy > 0 && marginX[i]! > 0) {
        const pYGivenX = pxy / marginX[i]!;
        hYX -= (pxy * Math.log(pYGivenX)) / Math.log(base);
      }
    }
  }
  return hYX;
}

function jointEntropy(jointProbs: number[][], base = 2): number {
  let total = 0.0;
  for (const row of jointProbs) {
    for (const pxy of row) {
      if (pxy > 0) {
        total -= (pxy * Math.log(pxy)) / Math.log(base);
      }
    }
  }
  return total;
}

function labelSmoothingDemo(): void {
  console.log();
  console.log("=".repeat(60));
  console.log("LABEL SMOOTHING AND CROSS-ENTROPY");
  console.log("=".repeat(60));

  const numClasses = 4;
  const trueClass = 2;
  const logits = [1.0, 0.5, 3.0, 0.2];
  const probs = softmax(logits);

  const hardTarget = new Array<number>(numClasses).fill(0.0);
  hardTarget[trueClass] = 1.0;

  const epsilons = [0.0, 0.05, 0.1, 0.2];
  console.log(`\n  Logits:  ${formatList(logits)}`);
  console.log(`  Softmax: [${probs.map((p) => p.toFixed(4)).join(", ")}]`);
  console.log(`  True class: ${trueClass}`);
  console.log();

  for (const eps of epsilons) {
    const softTarget = new Array<number>(numClasses).fill(eps / numClasses);
    softTarget[trueClass] = 1 - eps + eps / numClasses;

    const ce = crossEntropy(softTarget, probs, Math.E);
    const targetEntropy = entropy(softTarget, Math.E);
    const label = eps === 0.0 ? "hard" : `eps=${formatFloat(eps)}`;
    const targetText = `[${softTarget.map((t) => `'${t.toFixed(3)}'`).join(", ")}]`;
    console.log(
      `  ${label.padStart(8)}  target=${targetText}  ` +
        `H(target)=${targetEntropy.toFixed(4)}  CE=${ce.toFixed(4)}`,
    );
  }

  console.log();
  console.log("  Higher epsilon -> higher target entropy -> acts as regularization");
}

function featureSelectionMiDemo(): void {
  console.log();
  console.log("=".repeat(60));
  console.log("FEATURE SELECTION VIA MUTUAL INFORMATION");
  console.log("=".repeat(60));

  const random = mulberry32(42);
  const n = 200;

  const target: number[] = [];
  for (let i = 0; i < n; i++) {
    target.push(choice(random, [0, 1]));
  }

  const features = new Map<string, number[]>();
  features.set("strong_signal", target.map((t) => t ^ (random() < 0.1 ? 1 : 0)));
  features.set("weak_signal", target.map((t) => t ^ (random() < 0.35 ? 1 : 0)));
  const noise: number[] = [];
  for (let i = 0; i < n; i++) {
    noise.push(choice(random, [0, 1]));
  }
  features.set("noise", noise);
  features.set("constant", new Array<number>(n).fill(0));

  const positives = sum(target);
  console.log(`\n  Samples: ${n}`);
  console.log(`  Target balance: ${positives}/${n - positives}`);
  console.log();

  const miScores: [string, number][] = [];
  for (const [name, feat] of features) {
    const joint = [
      [0, 0],
      [0, 0],
    ];
    for (let i = 0; i < n; i++) {
      joint[feat[i]!]![target[i]!]! += 1;
    }
    const jointP = joint.map((row) => row.map((c) => c / n));
    const mi = mutualInformation(jointP, 2);
    miScores.push([name, mi]);
  }

  miScores.sort((a, b) => b[1] - a[1]);
  console.log("  Feature MI ranking:");
  for (const [name, mi] of miScores) {
    const bar = "#".repeat(Math.trunc(mi * 200));
    console.log(`    ${name.padStart(16)}  MI = ${mi.toFixed(4)} bits  ${bar}`);
  }

  console.log();
  console.log("  Strong signal has highest MI. Noise and constant have ~0.");
}

function main(): void {
  console.log("=".repeat(60));
  console.log("INFORMATION CONTENT (SURPRISE)");
  console.log("=".repeat(60));

  const events: [string, number][] = [
    ["Fair coin heads", 0.5],
    ["Rolling a 6", 1 / 6],
    ["1-in-1000 event", 0.001],
    ["Certain event", 1.0],
  ];
  for (const [name, p] of events) {
    console.log(
      `  ${name.padEnd(20)}  p=${p.toFixed(4).padEnd(8)}  surprise=${informationContent(p).toFixed(4)} bits`,
    );
  }

  console.log();
  console.log("=".repeat(60));
  console.log("ENTROPY");
  console.log("=".repeat(60));

  const distributions = new Map<string, number[]>([
    ["Fair coin", [0.5, 0.5]],
    ["Biased coin (99/1)", [0.99, 0.01]],
    ["Fair die (6 sides)", new Array<number>(6).fill(1 / 6)],
    ["Loaded die", [0.5, 0.1, 0.1, 0.1, 0.1, 0.1]],
  ]);
  for (const [name, probs] of distributions) {
    console.log(`  ${name.padEnd(25)}  H = ${entropy(probs).toFixed(4)} bits`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("CROSS-ENTROPY AND KL DIVERGENCE");
  console.log("=".repeat(60));

  const trueDist = [0.7, 0.2, 0.1];
  const goodModel = [0.6, 0.25, 0.15];
  const badModel = [0.1, 0.1, 0.8];

  const hTrue = entropy(trueDist);
  const ceGood = crossEntropy(trueDist, goodModel);
  const ceBad = crossEntropy(trueDist, badModel);
  const klGood = klDivergence(trueDist, goodModel);
  const klBad = klDivergence(trueDist, badModel);

  console.log(`  True distribution:    ${formatList(trueDist)}`);
  console.log(`  Good model:           ${formatList(goodModel)}`);
  console.log(`  Bad model:            ${formatList(badModel)}`);
  console.log();
  console.log(`  H(true):              ${hTrue.toFixed(4)} bits`);
  console.log(`  H(true, good):        ${ceGood.toFixed(4)} bits`);
  console.log(`  H(true, bad):         ${ceBad.toFixed(4)} bits`);
  console.log(`  KL(true || good):     ${klGood.toFixed(4)} bits`);
  console.log(`  KL(true || bad):      ${klBad.toFixed(4)} bits`);
  console.log();
  console.log(`  Verify: H(P,Q) = H(P) + KL(P||Q)`);
  console.log(
    `  Good: ${hTrue.toFixed(4)} + ${klGood.toFixed(4)} = ${(hTrue + klGood).toFixed(4)}  (CE = ${ceGood.toFixed(4)})`,
  );
  console.log(
    `  Bad:  ${hTrue.toFixed(4)} + ${klBad.toFixed(4)} = ${(hTrue + klBad).toFixed(4)}  (CE = ${ceBad.toFixed(4)})`,
  );

  console.log();
  console.log("=".repeat(60));
  console.log("KL DIVERGENCE IS NOT SYMMETRIC");
  console.log("=".repeat(60));

  const p = [0.9, 0.1];
  const q = [0.5, 0.5];
  console.log(`  P = ${formatList(p)},  Q = ${formatList(q)}`);
  console.log(`  KL(P || Q) = ${klDivergence(p, q).toFixed(4)} bits`);
  console.log(`  KL(Q || P) = ${klDivergence(q, p).toFixed(4)} bits`);
  console.log(`  They differ because KL is not a true distance metric.`);

  console.log();
  console.log("=".repeat(60));
  console.log("CROSS-ENTROPY LOSS FOR CLASSIFICATION");
  console.log("=".repeat(60));

  const logits = [2.0, 1.0, 0.1];
  const trueClass = 0;
  const probs = softmax(logits);
  const loss = crossEntropyLoss(trueClass, logits);

  console.log(`  Logits:       ${formatList(logits)}`);
  console.log(`  Softmax:      [${probs.map((value) => value.toFixed(4)).join(", ")}]`);
  console.log(`  True class:   ${trueClass}`);
  console.log(`  CE loss:      ${loss.toFixed(4)} nats`);
  console.log(`  Perplexity:   ${perplexity(loss).toFixed(2)}`);

  console.log();
  console.log("  Trying different true classes with same logits:");
  for (let c = 0; c < 3; c++) {
    const classLoss = crossEntropyLoss(c, logits);
    console.log(`    Class ${c}: loss=${classLoss.toFixed(4)}  prob=${probs[c]!.toFixed(4)}`);
  }

  console.log();
  console.log("=".repeat(60));
  console.log("CROSS-ENTROPY = NEGATIVE LOG-LIKELIHOOD");
  console.log("=".repeat(60));

  let random = mulberry32(42);
  const nSamples = 1000;
  const nClasses = 3;
  const labels: number[] = [];
  for (let i = 0; i < nSamples; i++) {
    labels.push(randint(random, 0, nClasses - 1));
  }
  const allLogits: number[][] = [];
  for (let i = 0; i < nSamples; i++) {
    const row: number[] = [];
    for (let k = 0; k < nClasses; k++) {
      row.push(gauss(random, 0, 1));
    }
    allLogits.push(row);
  }

  const ceAvg = negativeLogLikelihood(labels, allLogits);
  let logLikelihoodSum = 0;
  for (let i = 0; i < nSamples; i++) {
    logLikelihoodSum -= crossEntropyLoss(labels[i]!, allLogits[i]!);
  }
  const nllAvg = -logLikelihoodSum / nSamples;

  console.log(`  Samples:               ${nSamples}`);
  console.log(`  Cross-entropy loss:    ${ceAvg.toFixed(6)} nats`);
  console.log(`  Neg log-likelihood:    ${nllAvg.toFixed(6)} nats`);
  console.log(`  Difference:            ${formatExponent(Math.abs(ceAvg - nllAvg), 2)}`);
  console.log(`  They are identical. Minimizing CE = maximizing likelihood.`);

  console.log();
  console.log("=".repeat(60));
  console.log("MUTUAL INFORMATION");
  console.log("=".repeat(60));

  const independent = [
    [0.25, 0.25],
    [0.25, 0.25],
  ];
  const dependent = [
    [0.45, 0.05],
    [0.05, 0.45],
  ];
  const partial = [
    [0.3, 0.2],
    [0.1, 0.4],
  ];

  console.log(`  Independent:   MI = ${mutualInformation(independent).toFixed(4)} bits`);
  console.log(`  Dependent:     MI = ${mutualInformation(dependent).toFixed(4)} bits`);
  console.log(`  Partial:       MI = ${mutualInformation(partial).toFixed(4)} bits`);

  console.log();
  console.log("=".repeat(60));
  console.log("BITS VS NATS");
  console.log("=".repeat(60));

  const fairCoin = [0.5, 0.5];
  console.log(`  Fair coin entropy:`);
  console.log(`    In bits (log2): ${entropy(fairCoin, 2).toFixed(4)}`);
  console.log(`    In nats (ln):   ${entropy(fairCoin, Math.E).toFixed(4)}`);
  console.log(`    1 bit = ${(1 / Math.log2(Math.E)).toFixed(4)} nats`);
  console.log(`    1 nat = ${Math.log2(Math.E).toFixed(4)} bits`);

  console.log();
  console.log("=".repeat(60));
  console.log("PERPLEXITY IN LANGUAGE MODELS");
  console.log("=".repeat(60));

  random = mulberry32(123);
  const vocabSize = 50;
  const sequenceLength = 100;
  const trueTokens: number[] = [];
  for (let i = 0; i < sequenceLength; i++) {
    trueTokens.push(randint(random, 0, vocabSize - 1));
  }
  const tokenLogits: number[][] = [];
  for (let i = 0; i < sequenceLength; i++) {
    const row: number[] = [];
    for (let k = 0; k < vocabSize; k++) {
      row.push(gauss(random, 0, 1));
    }
    tokenLogits.push(row);
  }

  const avgCe = negativeLogLikelihood(trueTokens, tokenLogits);
  const ppl = perplexity(avgCe);

  console.log(`  Vocab size:        ${vocabSize}`);
  console.log(`  Sequence length:   ${sequenceLength}`);
  console.log(`  Avg CE loss:       ${avgCe.toFixed(4)} nats`);
  console.log(`  Perplexity:        ${ppl.toFixed(2)}`);
  console.log(`  Random baseline:   ${vocabSize.toFixed(2)} (uniform over vocab)`);
  console.log(`  The model is better than random if perplexity < vocab size.`);

  console.log();
  console.log("=".repeat(60));
  console.log("CONDITIONAL AND JOINT ENTROPY");
  console.log("=".repeat(60));

  const jointDep = [
    [0.45, 0.05],
    [0.05, 0.45],
  ];
  const jointIndep = [
    [0.25, 0.25],
    [0.25, 0.25],
  ];

  console.log(`\n  Dependent joint distribution: ${formatMatrix(jointDep)}`);
  console.log(`    Joint entropy H(X,Y):     ${jointEntropy(jointDep).toFixed(4)} bits`);
  console.log(`    Conditional H(Y|X):       ${conditionalEntropy(jointDep).toFixed(4)} bits`);
  console.log(`    Mutual information I(X;Y):${mutualInformation(jointDep).toFixed(4)} bits`);

  const hxDep = entropy(rowMarginals(jointDep));
  const hyxDep = conditionalEntropy(jointDep);
  console.log(`    H(X):                     ${hxDep.toFixed(4)} bits`);
  console.log(
    `    Verify: H(X,Y) = H(X) + H(Y|X) = ${hxDep.toFixed(4)} + ${hyxDep.toFixed(4)} = ${(hxDep + hyxDep).toFixed(4)}`,
  );

  console.log(`\n  Independent joint distribution: ${formatMatrix(jointIndep)}`);
  console.log(`    Joint entropy H(X,Y):     ${jointEntropy(jointIndep).toFixed(4)} bits`);
  console.log(`    Conditional H(Y|X):       ${conditionalEntropy(jointIndep).toFixed(4)} bits`);
  console.log(`    Mutual information I(X;Y):${mutualInformation(jointIndep).toFixed(4)} bits`);
  console.log("    When independent: H(Y|X) = H(Y) and I(X;Y) = 0");

  labelSmoothingDemo();
  featureSelectionMiDemo();
}

main();
