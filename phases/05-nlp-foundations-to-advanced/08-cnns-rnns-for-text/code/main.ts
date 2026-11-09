// Lesson: CNNs and RNNs for Text (phase 05 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/08-cnns-rnns-for-text/code/main.ts

function pyFixed(x: number, d: number): string {
  if (Object.is(x, -0)) return "-" + (0).toFixed(d);
  const wide = Math.abs(x).toFixed(Math.min(100, d + 25));
  const dot = wide.indexOf(".");
  const cut = dot + 1 + d;
  if (/^50*$/.test(wide.slice(cut))) {
    const head = wide.slice(0, d === 0 ? dot : cut);
    if (Number(head[head.length - 1]) % 2 === 0) return (x < 0 ? "-" : "") + head;
  }
  return x.toFixed(d);
}

function pyExp(x: number, d: number): string {
  return x.toExponential(d).replace(/e([+-])(\d)$/, "e$10$2");
}

function pyFloat(x: number): string {
  if (Object.is(x, -0)) return "-0.0";
  return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

function pyRound(x: number, d: number): number {
  const r = Number(pyFixed(x, d));
  return r === 0 && (x < 0 || Object.is(x, -0)) ? -0 : r;
}

function vanishingGradientSim(seqLen: number, recurrentWeight = 0.9): number {
  return Math.pow(recurrentWeight, seqLen);
}

function conv1dOverEmbeddings(embeddings: number[][], filterMatrix: number[][], bias = 0.0): number[] {
  const filterWidth = filterMatrix.length;
  const embedDim = embeddings[0].length;
  const out: number[] = [];
  for (let i = 0; i < embeddings.length - filterWidth + 1; i++) {
    let total = bias;
    for (let k = 0; k < filterWidth; k++) {
      for (let d = 0; d < embedDim; d++) {
        total += embeddings[i + k][d] * filterMatrix[k][d];
      }
    }
    out.push(0.0 > total ? 0.0 : total);
  }
  return out;
}

function maxPool(values: number[]): number {
  return values.length ? Math.max(...values) : 0.0;
}

function main(): void {
  console.log("=== vanishing gradient sim ===");
  for (const length of [10, 50, 100, 200]) {
    console.log(
      `  len=${String(length).padStart(3)}  w=0.9  gradient attenuation = ${pyExp(vanishingGradientSim(length), 2)}`,
    );
  }
  console.log("  a plain RNN loses 99.99% of its gradient by step 100.");
  console.log();

  console.log("=== TextCNN conceptual pass ===");
  const embeddings = [
    [1.0, 0.2, 0.5],
    [0.8, 0.9, 0.1],
    [0.3, 0.4, 0.7],
    [0.6, 0.5, 0.5],
    [0.1, 0.8, 0.2],
  ];
  const filterW2 = [
    [0.5, 0.0, 0.5],
    [0.2, 0.3, 0.1],
  ];
  const filterW3 = [
    [0.3, 0.3, 0.3],
    [0.2, 0.4, 0.1],
    [0.5, 0.2, 0.1],
  ];

  const actW2 = conv1dOverEmbeddings(embeddings, filterW2, -0.5);
  const actW3 = conv1dOverEmbeddings(embeddings, filterW3, -0.4);

  const list = (xs: number[]): string => "[" + xs.map((x) => pyFloat(pyRound(x, 2))).join(", ") + "]";
  console.log(`  5 tokens x 3 embed_dim`);
  console.log(`  width-2 filter activations: ${list(actW2)}`);
  console.log(`  width-3 filter activations: ${list(actW3)}`);
  console.log(`  max-pooled features:        [${pyFixed(maxPool(actW2), 2)}, ${pyFixed(maxPool(actW3), 2)}]`);
}

main();

export {};
