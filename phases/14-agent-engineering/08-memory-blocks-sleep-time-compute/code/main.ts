// Lesson: Memory Blocks and Sleep-Time Compute (phase 14 / lesson 08)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/docs/en.md
// Run: npx tsx phases/14-agent-engineering/08-memory-blocks-sleep-time-compute/code/main.ts

export {};

function pyStr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const ch of s) {
    if (ch === "\\") out += "\\\\";
    else if (ch === quote) out += "\\" + ch;
    else if (ch === "\n") out += "\\n";
    else if (ch === "\t") out += "\\t";
    else if (ch === "\r") out += "\\r";
    else out += ch;
  }
  return quote + out + quote;
}

class Block {
  value = "";
  version = 0;
  history: string[] = [];

  constructor(public label: string, public description = "", public limit = 300) {}

  append(text: string): string {
    const old = this.value;
    this.value = this.value ? (this.value + " " + text).trim() : text;
    this.version += 1;
    this.history.push(old);
    return `${this.label} v${this.version} (${this.value.length}/${this.limit})`;
  }

  replace(old: string, replacement: string): string {
    if (!this.value.includes(old)) return `error: ${pyStr(old)} not in ${this.label}`;
    const prev = this.value;
    this.value = this.value.split(old).join(replacement);
    this.version += 1;
    this.history.push(prev);
    return `${this.label} v${this.version} replaced`;
  }

  rewrite(text: string): string {
    const prev = this.value;
    this.value = text;
    this.version += 1;
    this.history.push(prev);
    return `${this.label} v${this.version} rewritten (${this.value.length}/${this.limit})`;
  }

  nearLimit(threshold = 0.8): boolean {
    return this.value.length >= Math.trunc(this.limit * threshold);
  }
}

class BlockStore {
  private blocks = new Map<string, Block>();

  create(label: string, description: string, limit = 300): Block {
    const block = new Block(label, description, limit);
    this.blocks.set(label, block);
    return block;
  }

  get(label: string): Block | undefined {
    return this.blocks.get(label);
  }

  labels(): string[] {
    return [...this.blocks.keys()].sort();
  }

  render(): string {
    const lines: string[] = [];
    for (const label of this.labels()) {
      const block = this.blocks.get(label) as Block;
      lines.push(`[${block.label} v${block.version} ${block.value.length}/${block.limit}]`);
      lines.push(`  ${block.value}`);
    }
    return lines.join("\n");
  }
}

interface ArchivalRecord {
  rid: string;
  text: string;
  valid: boolean;
}

class Archival {
  private records: ArchivalRecord[] = [];
  private counter = 0;

  insert(text: string): string {
    this.counter += 1;
    const rid = `a${String(this.counter).padStart(3, "0")}`;
    this.records.push({ rid, text, valid: true });
    return rid;
  }

  invalidate(rid: string): boolean {
    for (const record of this.records) {
      if (record.rid === rid) {
        record.valid = false;
        return true;
      }
    }
    return false;
  }

  validRecords(): ArchivalRecord[] {
    return this.records.filter((r) => r.valid);
  }

  allRecords(): ArchivalRecord[] {
    return [...this.records];
  }
}

class PrimaryAgent {
  trace: string[] = [];

  constructor(public blocks: BlockStore, public archival: Archival) {}

  turn(userText: string, writes: Array<[string, string, string]>): string {
    this.trace.push(`user: ${userText}`);
    for (const [kind, labelOrText, payload] of writes) {
      if (kind === "block_append") {
        const block = this.blocks.get(labelOrText);
        if (block !== undefined) this.trace.push(`  block_append -> ${block.append(payload)}`);
      } else if (kind === "archival_insert") {
        const rid = this.archival.insert(payload);
        this.trace.push(`  archival_insert -> ${rid}`);
      }
    }
    const response = `response to: ${userText}`;
    this.trace.push(`assistant: ${response}`);
    return response;
  }
}

class SleepTimeAgent {
  trace: string[] = [];

  constructor(public blocks: BlockStore, public archival: Archival) {}

  run(contradictions: Array<[string, string]>): void {
    this.trace.push("sleep-time pass start");
    for (const label of this.blocks.labels()) {
      const block = this.blocks.get(label);
      if (block === undefined) continue;
      if (block.nearLimit()) {
        const summary = summarize(block.value, Math.floor(block.limit / 2));
        const result = block.rewrite(summary);
        this.trace.push(`  consolidate ${label}: ${result}`);
      }
    }
    for (const [claim, reason] of contradictions) {
      for (const record of this.archival.allRecords()) {
        if (record.valid && record.text.toLowerCase().includes(claim.toLowerCase())) {
          this.archival.invalidate(record.rid);
          this.trace.push(`  invalidate ${record.rid} (${reason}): ${record.text.slice(0, 50)}...`);
        }
      }
    }
    this.trace.push("sleep-time pass end");
  }
}

function summarize(text: string, targetLen: number): string {
  const sentences = text
    .split(".")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length === 0) return text.slice(0, targetLen);
  const picked: string[] = [];
  let total = 0;
  for (const sentence of sentences) {
    if (total + sentence.length + 1 > targetLen) break;
    picked.push(sentence);
    total += sentence.length + 2;
  }
  return picked.join(". ") + ".";
}

function main(): void {
  console.log("=".repeat(70));
  console.log("LETTA MEMORY BLOCKS + SLEEP-TIME COMPUTE: Phase 14, Lesson 08");
  console.log("=".repeat(70));

  const blocks = new BlockStore();
  blocks.create("human", "facts about the user", 180);
  blocks.create("persona", "the agent's self-concept", 160);
  blocks.create("task", "the current task scope", 220);
  const archival = new Archival();

  const primary = new PrimaryAgent(blocks, archival);
  const sleep = new SleepTimeAgent(blocks, archival);

  primary.turn("my name is ava, I ship agents for a living, I live in Berlin", [
    ["block_append", "human", "name=ava role=ships_agents city=Berlin"],
  ]);
  primary.turn("today help me plan a 30-lesson curriculum on agent engineering", [
    ["block_append", "task", "plan 30-lesson agent curriculum, target senior eng"],
    ["archival_insert", "", "ava prefers concise, citation-heavy writing over tutorial-style"],
  ]);
  primary.turn("I moved to Lisbon last month; update your notes", [
    ["block_append", "human", "city=Lisbon (updated from Berlin)"],
    ["archival_insert", "", "ava lives in Berlin - old address, outdated"],
  ]);
  primary.turn("also the curriculum target is senior and staff engineers, not junior", [
    ["block_append", "task", "audience=senior+staff eng, cite arXiv and first-party framework docs"],
  ]);

  console.log("\nprimary turns (writes are fast and raw)");
  for (const line of primary.trace) console.log(`  ${line}`);

  console.log("\nblocks after primary phase (pre-consolidation)");
  console.log(blocks.render());

  sleep.run([["ava lives in Berlin", "human block updated city to Lisbon; Berlin archival claim is stale"]]);

  console.log("\nsleep-time trace");
  for (const line of sleep.trace) console.log(`  ${line}`);

  console.log("\nblocks after sleep-time (consolidated)");
  console.log(blocks.render());

  console.log("\narchival state");
  for (const record of archival.allRecords()) {
    const status = record.valid ? "VALID  " : "INVALID";
    console.log(`  ${record.rid} [${status}] ${record.text}`);
  }

  console.log();
  console.log("key property: primary-turn latency is unchanged by consolidation.");
  console.log("sleep-time can run a stronger, slower model: it is off the path.");
}

main();
