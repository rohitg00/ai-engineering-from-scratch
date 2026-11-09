// Lesson: Hybrid Memory: Vector + Graph + KV (phase 14 / lesson 09)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/09-hybrid-memory-mem0/docs/en.md
// Run: npx tsx phases/14-agent-engineering/09-hybrid-memory-mem0/code/main.ts

export {};

const nowSeconds = (): number => Date.now() / 1000;

function pySplit(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length > 0);
}

interface MemRecord {
  rid: string;
  text: string;
  scope: string;
  userId: string;
  sessionId: string;
  importance: number;
  ts: number;
  tags: string[];
}

class VectorStore {
  private records = new Map<string, MemRecord>();

  add(record: MemRecord): void {
    this.records.set(record.rid, record);
  }

  search(query: string, topK = 5): Array<[number, MemRecord]> {
    const qTokens = new Set(pySplit(query.toLowerCase()));
    const scored: Array<[number, MemRecord]> = [];
    for (const record of this.records.values()) {
      const rTokens = new Set(pySplit(record.text.toLowerCase()));
      if (rTokens.size === 0) continue;
      let overlap = 0;
      for (const t of qTokens) if (rTokens.has(t)) overlap += 1;
      if (overlap === 0) continue;
      const union = new Set([...qTokens, ...rTokens]);
      const score = overlap / union.size;
      scored.push([score, record]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, topK);
  }
}

interface KVKey {
  userId: string;
  factType: string;
  entity: string;
}

class KVStore {
  private map = new Map<string, [KVKey, MemRecord]>();

  private static id(key: KVKey): string {
    return JSON.stringify([key.userId, key.factType, key.entity]);
  }

  put(key: KVKey, record: MemRecord): void {
    this.map.set(KVStore.id(key), [key, record]);
  }

  get(key: KVKey): MemRecord | undefined {
    return this.map.get(KVStore.id(key))?.[1];
  }

  byUser(userId: string): MemRecord[] {
    return [...this.map.values()].filter(([k]) => k.userId === userId).map(([, r]) => r);
  }
}

interface Edge {
  subject: string;
  relation: string;
  obj: string;
  valid: boolean;
  ts: number;
}

class GraphStore {
  private edges: Edge[] = [];

  addEdge(subject: string, relation: string, obj: string): void {
    for (const edge of this.edges) {
      if (edge.valid && edge.subject === subject && edge.relation === relation) edge.valid = false;
    }
    this.edges.push({ subject, relation, obj, valid: true, ts: nowSeconds() });
  }

  neighbors(subject: string, validOnly = true): Edge[] {
    return this.edges.filter((e) => e.subject === subject && (e.valid || !validOnly));
  }

  allEdges(): Edge[] {
    return [...this.edges];
  }
}

interface Mem0Config {
  wRelevance: number;
  wImportance: number;
  wRecency: number;
  recencyHalflifeS: number;
}

const defaultConfig = (): Mem0Config => ({ wRelevance: 0.6, wImportance: 0.2, wRecency: 0.2, recencyHalflifeS: 86400.0 });

interface AddOptions {
  userId: string;
  sessionId?: string;
  scope?: string;
  importance?: number;
  tags?: string[];
  kvTriples?: Array<[string, string]>;
  graphTriples?: Array<[string, string, string]>;
}

class Mem0 {
  vector = new VectorStore();
  kv = new KVStore();
  graph = new GraphStore();
  config: Mem0Config;
  private counter = 0;

  constructor(config?: Mem0Config) {
    this.config = config ?? defaultConfig();
  }

  add(text: string, opts: AddOptions): string {
    this.counter += 1;
    const rid = `m${String(this.counter).padStart(3, "0")}`;
    const record: MemRecord = {
      rid,
      text,
      scope: opts.scope ?? "user",
      userId: opts.userId,
      sessionId: opts.sessionId ?? "s0",
      importance: opts.importance ?? 0.5,
      ts: nowSeconds(),
      tags: opts.tags ?? [],
    };
    this.vector.add(record);
    for (const [factType, entity] of opts.kvTriples ?? []) {
      this.kv.put({ userId: opts.userId, factType, entity }, record);
    }
    for (const [subject, relation, obj] of opts.graphTriples ?? []) this.graph.addEdge(subject, relation, obj);
    return rid;
  }

  private recencyScore(record: MemRecord, now: number): number {
    const elapsed = Math.max(0.0, now - record.ts);
    const half = this.config.recencyHalflifeS;
    return half > 0 ? 0.5 ** (elapsed / half) : 1.0;
  }

  search(query: string, opts: { userId: string; scope?: string | null; topK?: number }): Array<[number, MemRecord]> {
    const topK = opts.topK ?? 5;
    const scope = opts.scope ?? null;
    const now = nowSeconds();
    const vectorHits = this.vector.search(query, topK * 3);
    const fused = new Map<string, [number, MemRecord]>();
    for (const [rel, record] of vectorHits) {
      if (scope !== null && record.scope !== scope) continue;
      if (record.userId !== opts.userId && record.scope === "user") continue;
      const recency = this.recencyScore(record, now);
      const score =
        this.config.wRelevance * rel + this.config.wImportance * record.importance + this.config.wRecency * recency;
      fused.set(record.rid, [score, record]);
    }
    for (const record of this.kv.byUser(opts.userId)) {
      if (fused.has(record.rid)) continue;
      const recency = this.recencyScore(record, now);
      const score =
        this.config.wRelevance * 0.4 + this.config.wImportance * record.importance + this.config.wRecency * recency;
      fused.set(record.rid, [score, record]);
    }
    const ordered = [...fused.values()].sort((a, b) => b[0] - a[0]);
    return ordered.slice(0, topK);
  }
}

function main(): void {
  console.log("=".repeat(70));
  console.log("MEM0 HYBRID MEMORY: Phase 14, Lesson 09");
  console.log("=".repeat(70));

  const mem = new Mem0();

  mem.add("ava prefers citation-heavy, terse writing over tutorial style", {
    userId: "ava",
    sessionId: "s001",
    importance: 0.7,
    tags: ["preference", "writing"],
    kvTriples: [["writing_style", "terse_citation_heavy"]],
  });
  mem.add("ava is building a 30-lesson curriculum on agent engineering", {
    userId: "ava",
    sessionId: "s001",
    importance: 0.9,
    tags: ["project"],
    kvTriples: [["project", "agent_curriculum"]],
    graphTriples: [["ava", "owns_project", "agent_curriculum"]],
  });
  mem.add("ava lives in Berlin", {
    userId: "ava",
    sessionId: "s001",
    importance: 0.6,
    tags: ["profile"],
    kvTriples: [["city", "Berlin"]],
    graphTriples: [["ava", "lives_in", "Berlin"]],
  });
  mem.add("ava moved to Lisbon last month", {
    userId: "ava",
    sessionId: "s002",
    importance: 0.8,
    tags: ["profile", "update"],
    kvTriples: [["city", "Lisbon"]],
    graphTriples: [["ava", "lives_in", "Lisbon"]],
  });
  mem.add("bob requested a refund for invoice 4711", {
    userId: "bob",
    sessionId: "s010",
    importance: 0.9,
    tags: ["billing"],
    kvTriples: [["refund_request", "4711"]],
  });

  console.log("\nvector-only recall for 'writing style preferences'");
  for (const [score, record] of mem.vector.search("writing style preferences", 3)) {
    console.log(`  ${score.toFixed(3)}  ${record.rid}  ${record.text}`);
  }

  console.log("\ngraph recall for entities linked to 'ava'");
  for (const edge of mem.graph.neighbors("ava", false)) {
    const status = edge.valid ? "VALID  " : "INVALID";
    console.log(`  [${status}] ${edge.subject} --${edge.relation}--> ${edge.obj}`);
  }

  console.log("\nKV recall for ava all facts");
  for (const record of mem.kv.byUser("ava")) console.log(`  ${record.rid}  ${record.text}`);

  console.log("\nfused top-3 for ava, query 'where does ava live'");
  for (const [score, record] of mem.search("where does ava live", { userId: "ava", topK: 3 })) {
    console.log(`  ${score.toFixed(3)}  ${record.rid}  ${record.text}`);
  }

  console.log("\nfused top-3 for ava, query 'what is she building'");
  for (const [score, record] of mem.search("what is ava building", { userId: "ava", topK: 3 })) {
    console.log(`  ${score.toFixed(3)}  ${record.rid}  ${record.text}`);
  }

  console.log("\nscope isolation: bob's refund does not leak to ava's search");
  const hits = mem.search("refund invoice", { userId: "ava", topK: 5 });
  console.log(`  ava results: ${hits.length}  (expect 0 user-scoped hits from bob)`);
  for (const [score, record] of hits) console.log(`    ${score.toFixed(3)}  ${record.userId}  ${record.text}`);

  console.log();
  console.log("fusion: relevance + importance + recency. per-product weight tuning.");
}

main();
