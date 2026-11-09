// Lesson: GloVe, FastText, and Subword Embeddings (phase 05 / lesson 04)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/04-glove-fasttext-subword/code/main.ts

type Pair = [string, string];

function pyStrList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function charNgrams(word: string, nMin = 3, nMax = 6): Set<string> {
  const wrapped = `<${word}>`;
  const grams = new Set<string>([wrapped]);
  for (let n = nMin; n <= nMax; n++) {
    for (let i = 0; i < wrapped.length - n + 1; i++) {
      grams.add(wrapped.slice(i, i + n));
    }
  }
  return grams;
}

function learnBpe(corpus: Map<string, number>, kMerges: number): Pair[] {
  let vocab: [string[], number][] = [];
  for (const [word, freq] of corpus) {
    vocab.push([[...word, "</w>"], freq]);
  }

  const merges: Pair[] = [];
  for (let step = 0; step < kMerges; step++) {
    const pairFreq = new Map<string, { pair: Pair; count: number }>();
    for (const [tokens, freq] of vocab) {
      for (let i = 0; i + 1 < tokens.length; i++) {
        const key = tokens[i] + "\u0000" + tokens[i + 1];
        const entry = pairFreq.get(key);
        if (entry) entry.count += freq;
        else pairFreq.set(key, { pair: [tokens[i], tokens[i + 1]], count: freq });
      }
    }
    if (pairFreq.size === 0) break;
    let best: { pair: Pair; count: number } | undefined;
    for (const entry of pairFreq.values()) {
      if (best === undefined || entry.count > best.count) best = entry;
    }
    const [a, b] = best!.pair;
    merges.push([a, b]);

    const newVocab: [string[], number][] = [];
    for (const [tokens, freq] of vocab) {
      const newTokens: string[] = [];
      let i = 0;
      while (i < tokens.length) {
        if (i + 1 < tokens.length && tokens[i] === a && tokens[i + 1] === b) {
          newTokens.push(tokens[i] + tokens[i + 1]);
          i += 2;
        } else {
          newTokens.push(tokens[i]);
          i += 1;
        }
      }
      newVocab.push([newTokens, freq]);
    }
    vocab = newVocab;
  }
  return merges;
}

function applyBpe(word: string, merges: Pair[]): string[] {
  let tokens = [...word, "</w>"];
  for (const [a, b] of merges) {
    const newTokens: string[] = [];
    let i = 0;
    while (i < tokens.length) {
      if (i + 1 < tokens.length && tokens[i] === a && tokens[i + 1] === b) {
        newTokens.push(a + b);
        i += 2;
      } else {
        newTokens.push(tokens[i]);
        i += 1;
      }
    }
    tokens = newTokens;
  }
  return tokens;
}

function main(): void {
  console.log("=== FastText n-grams ===");
  for (const word of ["where", "whereupon"]) {
    const grams = [...charNgrams(word)].sort();
    console.log(`${word.padEnd(12)} ${grams.length} grams, e.g., ${pyStrList(grams.slice(0, 5))}`);
  }
  const whereupon = charNgrams("whereupon");
  const shared = [...charNgrams("where")].filter((g) => whereupon.has(g));
  console.log(`shared n-grams between where / whereupon: ${shared.length}`);
  console.log();

  console.log("=== BPE on toy corpus ===");
  const corpus = new Map<string, number>([
    ["low", 5], ["lower", 2], ["newest", 6], ["widest", 3],
    ["lowest", 4], ["newer", 2],
  ]);
  const merges = learnBpe(corpus, 10);
  console.log(`learned ${merges.length} merges:`);
  for (const [a, b] of merges) {
    console.log(`  '${a}' + '${b}' -> '${a + b}'`);
  }
  console.log();

  for (const test of ["lowest", "slowest", "lower", "newish"]) {
    const tokens = applyBpe(test, merges);
    console.log(`${test.padEnd(10)} -> ${pyStrList(tokens)}`);
  }
}

main();

export {};
