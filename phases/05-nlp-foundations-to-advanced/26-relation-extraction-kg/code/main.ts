// Lesson: Relation Extraction & Knowledge Graph Construction (phase 05 / lesson 26)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/docs/en.md
// Run: npx tsx phases/05-nlp-foundations-to-advanced/26-relation-extraction-kg/code/main.ts

type Triple = { subject: string; relation: string; object: string; span: [number, number]; evidence: string };
type Edge = [string, string, string];

const PATTERNS: [RegExp, string][] = [
  [/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) was born in ([A-Z][A-Za-z]+)/g, "P19"],
  [/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) founded ([A-Z][A-Za-z]+(?: Inc)?)/g, "P112"],
  [/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) (?:became|is|was) CEO of ([A-Z][A-Za-z]+(?: Inc)?)/g, "P169"],
  [/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) works? (?:at|for) ([A-Z][A-Za-z]+(?: Inc)?)/g, "P108"],
  [/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) (?:studied|graduated) (?:at|from) ([A-Z][A-Za-z]+(?: University)?)/g, "P69"],
  [/([A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)?) (?:acquired|bought) ([A-Z][A-Za-z]+(?: Inc)?)/g, "P1830"],
];

const RELATION_LABELS: Record<string, string> = {
  P19: "place of birth",
  P112: "founded",
  P169: "CEO of",
  P108: "employer",
  P69: "educated at",
  P1830: "acquired",
};

function extract(text: string): Triple[] {
  const triples: Triple[] = [];
  for (const [pattern, rel] of PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const start = m.index ?? 0;
      triples.push({
        subject: m[1],
        relation: rel,
        object: m[2],
        span: [start, start + m[0].length],
        evidence: m[0],
      });
    }
  }
  return triples;
}

function verify(triples: Triple[], text: string): Triple[] {
  const verified: Triple[] = [];
  for (const t of triples) {
    const [s, e] = t.span;
    if (text.slice(s, e) !== t.evidence) continue;
    if (!text.includes(t.subject) || !text.includes(t.object)) continue;
    verified.push(t);
  }
  return verified;
}

function buildGraph(triples: Triple[]): Map<string, Edge[]> {
  const graph = new Map<string, Edge[]>();
  for (const t of triples) {
    if (!graph.has(t.subject)) graph.set(t.subject, []);
    graph.get(t.subject)!.push([t.relation, t.object, t.evidence]);
  }
  return graph;
}

function printGraph(graph: Map<string, Edge[]>): void {
  const subjects = [...graph.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const subj of subjects) {
    for (const [rel, obj, ev] of graph.get(subj)!) {
      const label = RELATION_LABELS[rel] ?? rel;
      console.log(`  (${subj}) --[${label}]--> (${obj})`);
      console.log(`      evidence: "${ev}"`);
    }
  }
}

function main(): void {
  const doc =
    "Tim Cook became CEO of Apple in 2011. " +
    "Steve Jobs founded Apple in 1976. " +
    "Larry Page founded Google with Sergey Brin. " +
    "Sundar Pichai is CEO of Google. " +
    "Satya Nadella was born in Hyderabad. " +
    "Elon Musk acquired Twitter in 2022. " +
    "Dario Amodei studied at Princeton University. " +
    "Yann LeCun works at Meta.";

  console.log("=== rule-based relation extraction (with provenance) ===");
  console.log(`document: ${doc}`);
  console.log();

  const triples = extract(doc);
  const verified = verify(triples, doc);

  console.log(`extracted: ${triples.length}  verified: ${verified.length}`);
  console.log();
  const graph = buildGraph(verified);
  printGraph(graph);

  console.log();
  console.log("=== query: Tim Cook's employer ===");
  for (const [rel, obj, ev] of graph.get("Tim Cook") ?? []) {
    if (rel === "P169") {
      console.log(`  Tim Cook is CEO of ${obj}`);
      console.log(`  source: "${ev}"`);
    }
  }

  console.log();
  console.log("note: rule-based RE = high precision, low recall.");
  console.log("production stacks mix patterns + REBEL + LLM with AEVS verification.");
}

main();

export {};
