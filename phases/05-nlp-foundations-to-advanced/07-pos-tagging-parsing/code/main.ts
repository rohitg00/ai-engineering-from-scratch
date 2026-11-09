// Lesson: POS Tagging and Syntactic Parsing (phase 05 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/07-pos-tagging-parsing/code/main.ts

type Example = [string[], string[]];
type Counter = Map<string, number>;
type Table = Map<string, Counter>;

const TRAIN: Example[] = [
  [["The", "cat", "sat", "on", "the", "mat"], ["DET", "NOUN", "VERB", "ADP", "DET", "NOUN"]],
  [["A", "dog", "ran", "across", "the", "road"], ["DET", "NOUN", "VERB", "ADP", "DET", "NOUN"]],
  [["Cats", "chase", "mice"], ["NOUN", "VERB", "NOUN"]],
  [["Dogs", "bark", "loudly"], ["NOUN", "VERB", "ADV"]],
  [["The", "mat", "is", "red"], ["DET", "NOUN", "AUX", "ADJ"]],
  [["A", "red", "cat", "sat"], ["DET", "ADJ", "NOUN", "VERB"]],
];

function pyStrList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function bump(counter: Counter, key: string): void {
  counter.set(key, (counter.get(key) ?? 0) + 1);
}

function row(table: Table, key: string): Counter {
  let c = table.get(key);
  if (!c) {
    c = new Map();
    table.set(key, c);
  }
  return c;
}

function mostCommon(counter: Counter): string {
  let best = "";
  let bestCount = -Infinity;
  for (const [k, v] of counter) {
    if (v > bestCount) {
      best = k;
      bestCount = v;
    }
  }
  return best;
}

function total(counter: Counter): number {
  let s = 0;
  for (const v of counter.values()) s += v;
  return s;
}

function trainMft(examples: Example[]): [Map<string, string>, string] {
  const wordTagCounts: Table = new Map();
  const allTags: Counter = new Map();
  for (const [tokens, tags] of examples) {
    tokens.forEach((token, i) => {
      bump(row(wordTagCounts, token.toLowerCase()), tags[i]);
      bump(allTags, tags[i]);
    });
  }
  const wordBest = new Map<string, string>();
  for (const [w, c] of wordTagCounts) wordBest.set(w, mostCommon(c));
  const defaultTag = mostCommon(allTags);
  return [wordBest, defaultTag];
}

function predictMft(tokens: string[], wordBest: Map<string, string>, defaultTag: string): string[] {
  return tokens.map((t) => wordBest.get(t.toLowerCase()) ?? defaultTag);
}

function trainHmm(examples: Example[]): [Table, Table, Set<string>, Set<string>] {
  const transitions: Table = new Map();
  const emissions: Table = new Map();
  const tags = new Set<string>();
  const vocab = new Set<string>();
  for (const [tokens, ts] of examples) {
    let prev = "<BOS>";
    tokens.forEach((token, i) => {
      const tag = ts[i];
      bump(row(transitions, prev), tag);
      bump(row(emissions, tag), token.toLowerCase());
      tags.add(tag);
      vocab.add(token.toLowerCase());
      prev = tag;
    });
    bump(row(transitions, prev), "<EOS>");
  }
  return [transitions, emissions, tags, vocab];
}

function logProb(table: Table, given: string, key: string, smoothDenom: number, alpha: number): number {
  return Math.log(((row(table, given).get(key) ?? 0) + alpha) / smoothDenom);
}

function viterbi(
  tokens: string[],
  transitions: Table,
  emissions: Table,
  tags: Set<string>,
  vocab: Set<string>,
  alpha = 0.01,
): string[] {
  const tagsList = [...tags];
  const n = tokens.length;
  const V = Array.from({ length: n }, () => new Array<number>(tagsList.length).fill(0.0));
  const back = Array.from({ length: n }, () => new Array<number>(tagsList.length).fill(0));

  tagsList.forEach((tag, j) => {
    const emDenom = total(row(emissions, tag)) + alpha * (vocab.size + 1);
    const trDenom = total(row(transitions, "<BOS>")) + alpha * (tagsList.length + 1);
    const tr = logProb(transitions, "<BOS>", tag, trDenom, alpha);
    const em = logProb(emissions, tag, tokens[0].toLowerCase(), emDenom, alpha);
    V[0][j] = tr + em;
    back[0][j] = 0;
  });

  for (let i = 1; i < n; i++) {
    tagsList.forEach((tag, j) => {
      const emDenom = total(row(emissions, tag)) + alpha * (vocab.size + 1);
      const em = logProb(emissions, tag, tokens[i].toLowerCase(), emDenom, alpha);
      let bestPrev = 0;
      let bestScore = -1e30;
      tagsList.forEach((prevTag, k) => {
        const trDenom = total(row(transitions, prevTag)) + alpha * (tagsList.length + 1);
        const tr = logProb(transitions, prevTag, tag, trDenom, alpha);
        const score = V[i - 1][k] + tr + em;
        if (score > bestScore) {
          bestScore = score;
          bestPrev = k;
        }
      });
      V[i][j] = bestScore;
      back[i][j] = bestPrev;
    });
  }

  let lastBest = 0;
  for (let j = 1; j < tagsList.length; j++) {
    if (V[n - 1][j] > V[n - 1][lastBest]) lastBest = j;
  }
  const path = [lastBest];
  for (let i = n - 1; i > 0; i--) path.push(back[i][path[path.length - 1]]);
  return path.reverse().map((j) => tagsList[j]);
}

function main(): void {
  const [wordBest, defaultTag] = trainMft(TRAIN);
  const [transitions, emissions, tags, vocab] = trainHmm(TRAIN);

  const testSentences = [
    "The cat chased the dog".split(" "),
    "A red mat is here".split(" "),
    "Dogs bark".split(" "),
  ];

  for (const sent of testSentences) {
    const mft = predictMft(sent, wordBest, defaultTag);
    const hmm = viterbi(sent, transitions, emissions, tags, vocab);
    console.log(`tokens: ${pyStrList(sent)}`);
    console.log(`  mft : ${pyStrList(mft)}`);
    console.log(`  hmm : ${pyStrList(hmm)}`);
    console.log();
  }
}

main();

export {};
