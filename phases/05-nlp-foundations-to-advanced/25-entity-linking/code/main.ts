// Lesson: Entity Linking & Disambiguation (phase 05 / lesson 25)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/25-entity-linking/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/25-entity-linking/code/main.ts

const ALIAS_INDEX: Record<string, string[]> = {
  jordan: ["Q41421", "Q810", "Q254110", "Q3308285"],
  paris: ["Q90", "Q663094", "Q55411"],
  apple: ["Q312", "Q89"],
  washington: ["Q23", "Q1223", "Q61"],
  python: ["Q28865", "Q83320"],
};

const KB_DESC: Record<string, string> = {
  Q41421: "Michael Jordan American basketball player Chicago Bulls six championships",
  Q810: "Jordan country Middle East kingdom capital Amman Arabic",
  Q254110: "Michael B Jordan American actor Black Panther Creed film",
  Q3308285: "Michael I Jordan Berkeley professor machine learning statistics",
  Q90: "Paris capital of France Eiffel Tower Seine river city",
  Q663094: "Paris Texas city United States Lamar County",
  Q55411: "Paris Hilton American socialite hotel heiress television personality",
  Q312: "Apple Inc American technology company iPhone Mac Tim Cook Cupertino",
  Q89: "Apple fruit tree species Malus domestica red green grown worldwide",
  Q23: "George Washington American founding father first president",
  Q1223: "Washington state Pacific northwest United States Seattle capital Olympia",
  Q61: "Washington DC capital city of United States federal district",
  Q28865: "Python programming language Guido van Rossum interpreted dynamic",
  Q83320: "Python snake nonvenomous constrictor species Asia Africa large",
};

const PRIORS: Record<string, number> = {
  Q41421: 0.5, Q810: 0.2, Q254110: 0.2, Q3308285: 0.1,
  Q90: 0.85, Q663094: 0.05, Q55411: 0.1,
  Q312: 0.7, Q89: 0.3,
  Q23: 0.4, Q1223: 0.3, Q61: 0.3,
  Q28865: 0.8, Q83320: 0.2,
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

function tokenize(text: string): Set<string> {
  return new Set(text.toLowerCase().match(/[a-z0-9]+/g) ?? []);
}

function disambiguate(mention: string, context: string, usePrior = true): [string | null, number] {
  const candidates = ALIAS_INDEX[mention.toLowerCase()] ?? [];
  if (candidates.length === 0) return [null, 0.0];
  const ctxTokens = tokenize(context);
  const scored: [string, number, number, number][] = [];
  for (const cand of candidates) {
    const descTokens = tokenize(KB_DESC[cand] ?? "");
    let jac: number;
    if (descTokens.size === 0) {
      jac = 0.0;
    } else {
      let overlap = 0;
      for (const t of ctxTokens) if (descTokens.has(t)) overlap++;
      const union = ctxTokens.size + descTokens.size - overlap;
      jac = union ? overlap / union : 0.0;
    }
    const prior = usePrior ? (PRIORS[cand] ?? 0.0) : 1.0;
    const score = jac + 0.1 * prior;
    scored.push([cand, score, jac, prior]);
  }
  scored.sort((a, b) => b[1] - a[1]);
  return [scored[0][0], scored[0][1]];
}

function runEval(testCases: [string, string, string][], usePrior: boolean): number {
  let correct = 0;
  console.log(`=== disambiguation ${usePrior ? "with" : "without"} prior ===`);
  for (const [mention, context, gold] of testCases) {
    const [pred, score] = disambiguate(mention, context, usePrior);
    const ok = pred === gold;
    correct += ok ? 1 : 0;
    const tag = ok ? "  OK" : "MISS";
    console.log(
      `  [${tag}] mention=${mention.padEnd(10)} pred=${String(pred ?? "None").padEnd(7)} gold=${gold.padEnd(7)} score=${pyFixed(score, 3)}`,
    );
    console.log(`         context: ${context.slice(0, 70)}...`);
  }
  console.log(`  accuracy: ${correct}/${testCases.length} (${pyFixed((100 * correct) / testCases.length, 1)}%)`);
  console.log();
  return correct;
}

function main(): void {
  const testCases: [string, string, string][] = [
    ["Jordan", "Jordan scored 45 points against the Lakers last night.", "Q41421"],
    ["Jordan", "Jordan borders Syria, Iraq, and Saudi Arabia in the Middle East.", "Q810"],
    ["Jordan", "Jordan starred in the superhero movie Black Panther.", "Q254110"],
    ["Jordan", "Jordan's work on variational inference shaped machine learning.", "Q3308285"],
    ["Paris", "Paris is the capital of France and home to the Eiffel Tower.", "Q90"],
    ["Paris", "Paris Texas is a small city in Lamar County.", "Q663094"],
    ["Paris", "Paris Hilton is a television personality and heiress.", "Q55411"],
    ["Apple", "Apple announced the new iPhone at their Cupertino event.", "Q312"],
    ["Apple", "An apple a day keeps the doctor away; the fruit is rich in fiber.", "Q89"],
    ["Python", "Python is a popular programming language used for data science.", "Q28865"],
    ["Python", "The python is a large nonvenomous snake found in Asia.", "Q83320"],
  ];

  runEval(testCases, true);
  runEval(testCases, false);

  console.log("note: toy 11-case test set.");
  console.log("production EL uses Wikipedia alias dumps (~18M aliases) and encoder-based disambiguation.");
}

main();

export {};
