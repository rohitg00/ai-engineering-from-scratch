// Lesson: Coreference Resolution (phase 05 / lesson 24)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/24-coreference-resolution/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/24-coreference-resolution/code/main.ts

type Features = Record<string, string>;
type Mention = { text: string; span: [number, number]; type: string; features: Features };

const PRONOUNS: Record<string, Features> = {
  he: { gender: "m", number: "sg", type: "prp" },
  him: { gender: "m", number: "sg", type: "prp" },
  his: { gender: "m", number: "sg", type: "prp" },
  she: { gender: "f", number: "sg", type: "prp" },
  her: { gender: "f", number: "sg", type: "prp" },
  hers: { gender: "f", number: "sg", type: "prp" },
  it: { gender: "n", number: "sg", type: "prp" },
  its: { gender: "n", number: "sg", type: "prp" },
  they: { gender: "u", number: "pl", type: "prp" },
  them: { gender: "u", number: "pl", type: "prp" },
  their: { gender: "u", number: "pl", type: "prp" },
};

const FEMALE_FIRST = new Set(["mary", "alice", "sarah", "sophia", "emma", "olivia", "ava", "isabella", "maya", "jane"]);
const MALE_FIRST = new Set(["john", "james", "david", "tim", "steve", "michael", "bob", "adam", "peter", "carl"]);
const NEUTER_HEADS = new Set([
  "company", "firm", "corporation", "product", "device", "phone", "laptop", "computer",
  "organization", "team", "group", "agency", "bank",
]);

const DETERMINERS = new Set(["the", "a", "an"]);

function pyDict(d: Features): string {
  return "{" + Object.entries(d).map(([k, v]) => `'${k}': '${v}'`).join(", ") + "}";
}

function pyStrList(items: string[]): string {
  return "[" + items.map((s) => `'${s}'`).join(", ") + "]";
}

function isUpperFirst(tok: string): boolean {
  const c = tok[0];
  return c !== c.toLowerCase() && c === c.toUpperCase();
}

function isAlpha(tok: string): boolean {
  return /^\p{L}+$/u.test(tok);
}

function extractMentions(text: string): Mention[] {
  const mentions: Mention[] = [];
  text.split(/(?<=[.!?])\s+/).forEach((sent, sentIdx) => {
    const tokens = sent.match(/[A-Za-z]+|[^\s]/g) ?? [];
    let i = 0;
    while (i < tokens.length) {
      const tok = tokens[i];
      const low = tok.toLowerCase();
      if (Object.hasOwn(PRONOUNS, low)) {
        mentions.push({ text: tok, span: [sentIdx, i], type: "pronoun", features: PRONOUNS[low] });
        i += 1;
        continue;
      }
      if (DETERMINERS.has(low) && i + 1 < tokens.length) {
        const head = tokens[i + 1].toLowerCase();
        if (NEUTER_HEADS.has(head)) {
          mentions.push({
            text: `${tok} ${tokens[i + 1]}`,
            span: [sentIdx, i],
            type: "nominal",
            features: { gender: "n", number: "sg", head },
          });
          i += 2;
          continue;
        }
      }
      if (isUpperFirst(tok) && isAlpha(tok) && !DETERMINERS.has(low)) {
        let j = i + 1;
        while (j < tokens.length && isUpperFirst(tokens[j]) && isAlpha(tokens[j])) j += 1;
        const name = tokens.slice(i, j).join(" ");
        const gender = inferGender(name);
        mentions.push({ text: name, span: [sentIdx, i], type: "ne", features: { gender, number: "sg" } });
        i = j;
        continue;
      }
      i += 1;
    }
  });
  return mentions;
}

function inferGender(name: string): string {
  const first = name.split(/\s+/)[0].toLowerCase();
  if (FEMALE_FIRST.has(first)) return "f";
  if (MALE_FIRST.has(first)) return "m";
  return "u";
}

function agreementScore(mention: Mention, candidate: Mention): number {
  let score = 0.0;
  const mf = mention.features;
  const cf = candidate.features;
  if (mf.number === cf.number) score += 1.0;
  if (mf.gender === "u" || cf.gender === "u" || mf.gender === cf.gender) score += 1.0;
  else score -= 2.0;
  return score;
}

function recencyScore(mention: Mention, candidate: Mention): number {
  const delta =
    (mention.span[0] - candidate.span[0]) * 2 + Math.max(0, mention.span[1] - candidate.span[1]) * 0.01;
  return -delta;
}

function resolve(mentions: Mention[]): [Mention, Mention | null][] {
  const links: [Mention, Mention | null][] = [];
  mentions.forEach((m, i) => {
    if (m.type !== "pronoun") return;
    const candidates = mentions.slice(0, i).filter((c) => c.type === "ne" || c.type === "nominal");
    if (candidates.length === 0) {
      links.push([m, null]);
      return;
    }
    let best = candidates[0];
    let bestScore = agreementScore(m, best) + recencyScore(m, best);
    for (const c of candidates.slice(1)) {
      const s = agreementScore(m, c) + recencyScore(m, c);
      if (s > bestScore) {
        best = c;
        bestScore = s;
      }
    }
    links.push([m, best]);
  });
  return links;
}

function clusters(mentions: Mention[], links: [Mention, Mention | null][]): string[][] {
  const parent = new Map<Mention, Mention>(mentions.map((m): [Mention, Mention] => [m, m]));

  const find = (start: Mention): Mention => {
    let x = start;
    while (parent.get(x) !== x) {
      parent.set(x, parent.get(parent.get(x)!)!);
      x = parent.get(x)!;
    }
    return x;
  };

  const union = (a: Mention, b: Mention): void => {
    parent.set(find(a), find(b));
  };

  for (const [m, ant] of links) {
    if (ant !== null) union(m, ant);
  }
  const groups = new Map<Mention, string[]>();
  for (const m of mentions) {
    const root = find(m);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(m.text);
  }
  return [...groups.values()];
}

function main(): void {
  const doc =
    "Tim Cook walked onto the stage. " +
    "He announced the new iPhone. " +
    "The company also showed a laptop. " +
    "It will ship in June. " +
    "Mary Chen joined Apple last year. " +
    "She leads the AI team. " +
    "Her team built the voice assistant. " +
    "The device impressed the audience.";

  console.log("=== toy rule-based coreference ===");
  console.log(`document: ${doc}`);
  console.log();

  const mentions = extractMentions(doc);
  console.log(`extracted ${mentions.length} mentions:`);
  for (const m of mentions) {
    console.log(`  [${m.type.padEnd(7)}] ${m.text.padEnd(22)} feats=${pyDict(m.features)}`);
  }

  console.log();
  const links = resolve(mentions);
  console.log("pronoun links:");
  for (const [pronoun, antecedent] of links) {
    const antText = antecedent ? antecedent.text : "<none>";
    console.log(`  ${pronoun.text.padEnd(8)} -> ${antText}`);
  }

  console.log();
  console.log("clusters:");
  clusters(mentions, links).forEach((cluster, i) => {
    if (cluster.length > 1) console.log(`  cluster ${i}: ${pyStrList(cluster)}`);
  });

  console.log();
  console.log("note: rules handle easy pronouns; production models are span-based neural.");
  console.log("note: neuter pronoun 'it' / 'its' prefers neuter-head nominals like 'the company'.");
}

main();

export {};
