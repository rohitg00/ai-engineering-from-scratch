// Lesson: Text Processing: Tokenization, Stemming, Lemmatization (phase 05 / lesson 01)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/01-text-processing/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/01-text-processing/code/main.ts

type Tagged = [string, string];
type Tagger = (tokens: string[]) => Tagged[];

const WORD_RE = /[A-Za-z]+(?:'[A-Za-z]+)?|[0-9]+|[^\sA-Za-z0-9]/g;

function pyStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === q) out += "\\" + q;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else out += ch;
  }
  return q + out + q;
}

function pyList(items: string[]): string {
  return "[" + items.map(pyStr).join(", ") + "]";
}

function tokenize(text: string): string[] {
  return text.match(WORD_RE) ?? [];
}

function stemStep1a(word: string): string {
  if (word.endsWith("sses")) return word.slice(0, -2);
  if (word.endsWith("ies")) return word.slice(0, -2);
  if (word.endsWith("ss")) return word;
  if (word.endsWith("s") && word.length > 1) return word.slice(0, -1);
  return word;
}

const LEMMA_TABLE = new Map<string, string>([
  ["running|VERB", "run"],
  ["ran|VERB", "run"],
  ["runs|VERB", "run"],
  ["better|ADJ", "good"],
  ["best|ADJ", "good"],
  ["cats|NOUN", "cat"],
  ["cat|NOUN", "cat"],
  ["were|VERB", "be"],
  ["was|VERB", "be"],
  ["is|VERB", "be"],
]);

function lemmatize(word: string, pos: string): string {
  const key = `${word.toLowerCase()}|${pos}`;
  const hit = LEMMA_TABLE.get(key);
  if (hit !== undefined) return hit;
  if (pos === "VERB" && word.endsWith("ing")) return word.slice(0, -3);
  if (pos === "NOUN" && word.endsWith("s")) return word.slice(0, -1);
  return word.toLowerCase();
}

function preprocess(text: string, posTagger?: Tagger): { tokens: string[]; stems: string[]; lemmas: string[] } {
  const tokens = tokenize(text);
  const stems = tokens.map((t) => stemStep1a(t.toLowerCase()));
  const tags: Tagged[] = posTagger ? posTagger(tokens) : tokens.map((t): Tagged => [t, "NOUN"]);
  const lemmas = tags.map(([word, pos]) => lemmatize(word, pos));
  return { tokens, stems, lemmas };
}

function demoPosTagger(tokens: string[]): Tagged[] {
  const verbs = new Set(["running", "ran", "runs", "were", "was", "is", "watched"]);
  const adjs = new Set(["better", "best"]);
  const out: Tagged[] = [];
  for (const t of tokens) {
    const low = t.toLowerCase();
    if (verbs.has(low)) out.push([t, "VERB"]);
    else if (adjs.has(low)) out.push([t, "ADJ"]);
    else out.push([t, "NOUN"]);
  }
  return out;
}

function main(): void {
  const text = "The cats were running at 3pm.";
  const result = preprocess(text, demoPosTagger);
  console.log(`input:  ${text}`);
  console.log(`tokens: ${pyList(result.tokens)}`);
  console.log(`stems:  ${pyList(result.stems)}`);
  console.log(`lemmas: ${pyList(result.lemmas)}`);
}

main();

export {};
