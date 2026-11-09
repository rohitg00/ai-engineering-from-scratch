// Lesson: Shared Memory and Blackboard Patterns (phase 16 / lesson 13)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/13-shared-memory-blackboard/code/main.ts

import { createHash } from "node:crypto";

interface ProvenanceEntry {
  id: number;
  writer: string;
  topic: string;
  content: string;
  timestamp: number;
  prompt_hash: string;
  source_uri: string | null;
  supersedes: number | null;
  flags: string[];
}

function promptHash(prompt: string): string {
  return createHash("sha256").update(prompt, "utf-8").digest("hex").slice(0, 10);
}

function pyStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
  if (q === "'") out = out.replace(/'/g, "\\'");
  return q + out + q;
}

class MessagePool {
  entries: ProvenanceEntry[] = [];
  private nextId = 0;

  write(writer: string, content: string, prompt: string, sourceUri: string | null = null,
    topic = "default", supersedes: number | null = null): number {
    const eid = this.nextId;
    this.nextId += 1;
    this.entries.push({
      id: eid,
      writer,
      topic,
      content,
      timestamp: Date.now() / 1000,
      prompt_hash: promptHash(prompt),
      source_uri: sourceUri,
      supersedes,
      flags: [],
    });
    return eid;
  }

  readAll(): ProvenanceEntry[] {
    return [...this.entries];
  }

  flag(entryId: number, flag: string): void {
    for (const e of this.entries) {
      if (e.id === entryId) {
        e.flags.push(flag);
        return;
      }
    }
  }
}

type Callback = (e: ProvenanceEntry) => void;

class Blackboard {
  topics = new Map<string, ProvenanceEntry[]>();
  subscribers = new Map<string, Callback[]>();
  private nextId = 0;

  publish(writer: string, topic: string, content: string, prompt: string, sourceUri: string | null = null): number {
    const eid = this.nextId;
    this.nextId += 1;
    const e: ProvenanceEntry = {
      id: eid,
      writer,
      topic,
      content,
      timestamp: Date.now() / 1000,
      prompt_hash: promptHash(prompt),
      source_uri: sourceUri,
      supersedes: null,
      flags: [],
    };
    if (!this.topics.has(topic)) this.topics.set(topic, []);
    this.topics.get(topic)!.push(e);
    const subs = [...(this.subscribers.get(topic) ?? [])];
    for (const cb of subs) cb(e);
    return eid;
  }

  subscribe(topic: string, cb: Callback): void {
    if (!this.subscribers.has(topic)) this.subscribers.set(topic, []);
    this.subscribers.get(topic)!.push(cb);
  }

  readTopic(topic: string): ProvenanceEntry[] {
    return [...(this.topics.get(topic) ?? [])];
  }
}

const FAKE_SOURCES = new Map<string, string>([
  ["https://arxiv.org/paper-1", "The study reports a 4.2% accuracy improvement over the baseline."],
  ["https://arxiv.org/paper-2", "Dataset size was 12,500 examples."],
]);

function retrievalAgent(pool: MessagePool, uri: string, hallucinate: boolean): number {
  let content = FAKE_SOURCES.get(uri)!;
  if (hallucinate && content.includes("4.2%")) content = content.split("4.2%").join("42%");
  return pool.write("retriever", content, `Fetch and summarize ${uri}`, uri);
}

function summarizerAgent(pool: MessagePool): number {
  const retrieved = pool.readAll().filter((e) => e.writer === "retriever");
  if (retrieved.length === 0) return pool.write("summarizer", "no source", "Summarize retrieval", null);
  const latest = retrieved[retrieved.length - 1].content;
  const summary = `Summary: study reports a significant result -- ${latest.split(".")[0]}.`;
  return pool.write("summarizer", summary, "Summarize retrieval", null);
}

function analystAgent(pool: MessagePool): number {
  const summaries = pool.readAll().filter((e) => e.writer === "summarizer");
  if (summaries.length === 0) return pool.write("analyst", "no summary", "Draw conclusions", null);
  const latest = summaries[summaries.length - 1].content;
  const verdict = latest.includes("42%") ? "Recommend adoption" : "Recommend further review";
  return pool.write("analyst", `Analyst verdict: ${verdict} (based on: ${latest})`, "Draw conclusions", null);
}

function verifierAgent(pool: MessagePool): [number, string][] {
  const findings: [number, string][] = [];
  for (const e of pool.readAll()) {
    if (e.source_uri && FAKE_SOURCES.has(e.source_uri)) {
      const truth = FAKE_SOURCES.get(e.source_uri)!;
      if (e.content !== truth) {
        findings.push([e.id, `mismatch with ${e.source_uri}: fetched text was ${pyStr(truth)}`]);
      }
    }
  }
  return findings;
}

function runWithoutVerifier(): void {
  console.log("=".repeat(72));
  console.log("RUN 1: no verifier; hallucination propagates");
  console.log("=".repeat(72));
  const pool = new MessagePool();
  retrievalAgent(pool, "https://arxiv.org/paper-1", true);
  summarizerAgent(pool);
  analystAgent(pool);
  for (const e of pool.readAll()) {
    console.log(`  [${e.id}] ${e.writer.padEnd(11)} (${e.prompt_hash}) :: ${e.content}`);
  }
  console.log("\nfinal report uses hallucinated 42% figure; no alarm raised.");
}

function runWithVerifier(): void {
  console.log("\n" + "=".repeat(72));
  console.log("RUN 2: read-only verifier re-fetches sources and flags");
  console.log("=".repeat(72));
  const pool = new MessagePool();
  retrievalAgent(pool, "https://arxiv.org/paper-1", true);
  summarizerAgent(pool);
  const findings = verifierAgent(pool);
  for (const [eid, reason] of findings) pool.flag(eid, reason);
  analystAgent(pool);

  for (const e of pool.readAll()) {
    const flagStr = e.flags.length > 0 ? ` [FLAGGED: ${e.flags.join("; ")}]` : "";
    console.log(`  [${e.id}] ${e.writer.padEnd(11)} (${e.prompt_hash}) :: ${e.content}${flagStr}`);
  }
  if (findings.length > 0) {
    console.log(`\nverifier surfaced ${findings.length} inconsistency. downstream agents can suppress the verdict.`);
  }
}

function demoBlackboard(): void {
  console.log("\n" + "=".repeat(72));
  console.log("BLACKBOARD DEMO: topic-keyed pub/sub, not every agent reads everything");
  console.log("=".repeat(72));
  const bb = new Blackboard();
  const received: { prices: number[]; alerts: number[] } = { prices: [], alerts: [] };

  bb.subscribe("prices", (e) => received.prices.push(e.id));
  bb.subscribe("alerts", (e) => received.alerts.push(e.id));

  bb.publish("scraper-1", "prices", "AAPL=192.4", "poll market");
  bb.publish("scraper-2", "prices", "MSFT=401.2", "poll market");
  bb.publish("risk-engine", "alerts", "ALERT: AAPL moved >2% in 60s", "watch prices");

  console.log(`  price subscribers got ids: [${received.prices.join(", ")}]`);
  console.log(`  alert subscribers got ids: [${received.alerts.join(", ")}]`);
  console.log("  (note: price subscribers never saw the alert; that is the point)");
}

function main(): void {
  runWithoutVerifier();
  runWithVerifier();
  demoBlackboard();
  console.log("\nTakeaways:");
  console.log("  1. shared state without provenance launders hallucinations into downstream reasoning");
  console.log("  2. a read-only verifier with independent source access catches memory poisoning");
  console.log("  3. a blackboard scales past a full pool because agents only read what they subscribe to");
}

main();
