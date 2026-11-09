// Lesson: Multilingual NLP (phase 05 / lesson 18)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/18-multilingual-nlp/code/main.ts

type Features = Record<string, string>;

const LANGUAGE_FEATURES: Record<string, Features> = {
  english: { word_order: "SVO", script: "Latin", family: "Germanic" },
  german: { word_order: "SVO", script: "Latin", family: "Germanic" },
  french: { word_order: "SVO", script: "Latin", family: "Romance" },
  spanish: { word_order: "SVO", script: "Latin", family: "Romance" },
  italian: { word_order: "SVO", script: "Latin", family: "Romance" },
  hindi: { word_order: "SOV", script: "Devanagari", family: "Indic" },
  marathi: { word_order: "SOV", script: "Devanagari", family: "Indic" },
  bengali: { word_order: "SOV", script: "Bengali", family: "Indic" },
  urdu: { word_order: "SOV", script: "Arabic", family: "Indic" },
  arabic: { word_order: "VSO", script: "Arabic", family: "Semitic" },
  japanese: { word_order: "SOV", script: "Kanji", family: "Japonic" },
};

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

function similarity(a: string, b: string): number {
  const fa = LANGUAGE_FEATURES[a];
  const fb = LANGUAGE_FEATURES[b];
  const keys = Object.keys(fa);
  const matches = keys.filter((k) => fa[k] === fb[k]).length;
  return matches / keys.length;
}

function rankSourceLanguages(target: string, candidates: string[]): [string, number][] {
  const scored = candidates
    .filter((cand) => cand !== target)
    .map((cand): [string, number] => [cand, similarity(target, cand)]);
  scored.sort((x, y) => y[1] - x[1]);
  return scored;
}

function simulateTransferAccuracy(target: string, source: string): number {
  const sim = similarity(target, source);
  const baseAccuracy = 0.45;
  const maxBoost = 0.45;
  return Math.min(0.95, baseAccuracy + sim * maxBoost);
}

function main(): void {
  const candidates = Object.keys(LANGUAGE_FEATURES);
  const targets = ["marathi", "urdu", "arabic", "japanese"];

  console.log("=== source language selection (qWALS-style similarity) ===");
  for (const target of targets) {
    const ranking = rankSourceLanguages(target, candidates).slice(0, 4);
    console.log(`\n  target: ${target}`);
    for (const [source, sim] of ranking) {
      const expected = simulateTransferAccuracy(target, source);
      console.log(`    source=${source.padEnd(10)}  sim=${pyFixed(sim, 2)}  simulated_acc=${pyFixed(expected * 100, 0)}%`);
    }
  }

  console.log();
  console.log("note: real similarity comes from qWALS / lang2vec, not a 3-feature toy.");
  console.log("key insight: for Marathi, Hindi is a better source than English.");
}

main();

export {};
