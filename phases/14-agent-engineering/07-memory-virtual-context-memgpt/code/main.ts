// Lesson: Agent Memory: Virtual Context and Memory Paging (phase 14 / lesson 07)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/14-agent-engineering/07-memory-virtual-context-memgpt/docs/en.md
// Run: npx tsx phases/14-agent-engineering/07-memory-virtual-context-memgpt/code/main.ts

export {};

class PyTuple {
  constructor(public items: unknown[]) {}
}

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

function pyRepr(v: unknown): string {
  if (typeof v === "string") return pyStr(v);
  if (v instanceof PyTuple) {
    if (v.items.length === 1) return `(${pyRepr(v.items[0])},)`;
    return "(" + v.items.map(pyRepr).join(", ") + ")";
  }
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  if (v !== null && typeof v === "object") {
    return "{" + Object.entries(v as Record<string, unknown>).map(([k, x]) => `${pyStr(k)}: ${pyRepr(x)}`).join(", ") + "}";
  }
  return String(v);
}

function pySplit(s: string): string[] {
  return s.split(/\s+/).filter((t) => t.length > 0);
}

interface Message {
  role: string;
  text: string;
}

class MainContext {
  core: Record<string, string> = {};
  messages: Message[] = [];
  evicted: Message[] = [];

  constructor(public maxMessages = 4) {}

  append(role: string, text: string): void {
    this.messages.push({ role, text });
    while (this.messages.length > this.maxMessages) this.evicted.push(this.messages.shift() as Message);
  }

  render(): string {
    const parts: string[] = ["[core]"];
    const keys = Object.keys(this.core).sort();
    for (const key of keys) parts.push(`  ${key}: ${this.core[key]}`);
    parts.push("[messages]");
    for (const msg of this.messages) parts.push(`  ${msg.role}: ${msg.text}`);
    return parts.join("\n");
  }
}

interface ArchivalRecord {
  rid: string;
  text: string;
  tags: PyTuple;
  sessionId: string;
  turnId: number;
}

class ArchivalStore {
  private records: ArchivalRecord[] = [];
  private counter = 0;

  insert(text: string, tags: PyTuple = new PyTuple([]), sessionId = "s0", turnId = 0): string {
    this.counter += 1;
    const rid = `a${String(this.counter).padStart(3, "0")}`;
    this.records.push({ rid, text, tags, sessionId, turnId });
    return rid;
  }

  search(query: string, topK = 3): ArchivalRecord[] {
    const qTokens = new Set(pySplit(query.toLowerCase()));
    const scored: Array<[number, ArchivalRecord]> = [];
    for (const record of this.records) {
      const rTokens = new Set(pySplit(record.text.toLowerCase()));
      if (rTokens.size === 0) continue;
      let overlap = 0;
      for (const t of qTokens) if (rTokens.has(t)) overlap += 1;
      if (overlap === 0) continue;
      const score = overlap / (qTokens.size + rTokens.size - overlap);
      scored.push([score, record]);
    }
    scored.sort((a, b) => b[0] - a[0]);
    return scored.slice(0, topK).map((p) => p[1]);
  }

  count(): number {
    return this.records.length;
  }
}

type Args = Record<string, unknown>;

class MemoryTools {
  constructor(public main: MainContext, public archival: ArchivalStore) {}

  coreMemoryAppend(section: string, text: string): string {
    const existing = this.main.core[section] ?? "";
    this.main.core[section] = existing ? (existing + " " + text).trim() : text;
    return `core[${section}] appended: ${this.main.core[section].length} chars`;
  }

  coreMemoryReplace(section: string, old: string, replacement: string): string {
    const current = this.main.core[section] ?? "";
    if (!current.includes(old)) return `error: ${pyStr(old)} not in core[${section}]`;
    this.main.core[section] = current.split(old).join(replacement);
    return `core[${section}] replaced`;
  }

  archivalMemoryInsert(text: string, tags: PyTuple = new PyTuple([])): string {
    const rid = this.archival.insert(text, tags);
    return `stored ${rid} (${this.archival.count()} records)`;
  }

  archivalMemorySearch(query: string, topK = 3): string {
    const hits = this.archival.search(query, topK);
    if (hits.length === 0) return "no matches";
    return hits.map((h) => `  ${h.rid}: ${h.text}`).join("\n");
  }

  conversationSearch(query: string): string {
    const q = query.toLowerCase();
    const all = [...this.main.evicted, ...this.main.messages].reverse();
    for (const msg of all) {
      if (msg.text.toLowerCase().includes(q)) return `found (${msg.role}): ${msg.text}`;
    }
    return "no matches";
  }

  dispatch(name: string, args: Args): string | undefined {
    const s = (k: string): string => {
      if (!(k in args)) throw new TypeError(`missing required argument: ${pyStr(k)}`);
      return args[k] as string;
    };
    if (name === "core_memory_append") return this.coreMemoryAppend(s("section"), s("text"));
    if (name === "core_memory_replace") return this.coreMemoryReplace(s("section"), s("old"), s("new"));
    if (name === "archival_memory_insert") return this.archivalMemoryInsert(s("text"), args.tags as PyTuple | undefined);
    if (name === "archival_memory_search") return this.archivalMemorySearch(s("query"), args.top_k as number | undefined);
    if (name === "conversation_search") return this.conversationSearch(s("query"));
    return undefined;
  }
}

interface ToolCall {
  name: string;
  args: Args;
}

function runScriptedAgent(tools: MemoryTools, script: ToolCall[]): string[] {
  const observations: string[] = [];
  for (const call of script) {
    try {
      const out = tools.dispatch(call.name, call.args);
      if (out === undefined) {
        observations.push(`error: unknown tool ${pyStr(call.name)}`);
        continue;
      }
      observations.push(out);
    } catch (e) {
      const err = e as Error;
      observations.push(`error: ${err.name}: ${err.message}`);
    }
  }
  return observations;
}

function main(): void {
  console.log("=".repeat(70));
  console.log("MEMGPT VIRTUAL CONTEXT: Phase 14, Lesson 07");
  console.log("=".repeat(70));

  const mainCtx = new MainContext(3);
  const archival = new ArchivalStore();
  const tools = new MemoryTools(mainCtx, archival);

  mainCtx.append("user", "my name is ava and I ship agents for a living");
  mainCtx.append("assistant", "noted. what are you building right now?");
  mainCtx.append("user", "a retrieval bot for our sales org, 12 tools so far");
  mainCtx.append("assistant", "12 tools is in the long-horizon band; plan for drift");

  const script: ToolCall[] = [
    { name: "core_memory_append", args: { section: "persona", text: "the agent remembers user details politely" } },
    { name: "core_memory_append", args: { section: "user", text: "name=ava, role=ships agents" } },
    {
      name: "archival_memory_insert",
      args: { text: "ava is building a retrieval bot with 12 tools for sales", tags: new PyTuple(["project", "ava"]) },
    },
    {
      name: "archival_memory_insert",
      args: { text: "long-horizon tool chains drift after 20 steps per BFCL V4", tags: new PyTuple(["bfcl", "tools"]) },
    },
    {
      name: "archival_memory_insert",
      args: { text: "sleep-time compute consolidates memory asynchronously", tags: new PyTuple(["letta", "memory"]) },
    },
  ];
  const observations = runScriptedAgent(tools, script);

  console.log("\ntool trace (memory writes)");
  for (let i = 0; i < Math.min(script.length, observations.length); i++) {
    console.log(`  ${script[i].name}(${pyRepr(script[i].args)}) -> ${observations[i]}`);
  }

  console.log("\nfilling main context until eviction kicks in");
  mainCtx.append("user", "what were you saying about tool chains?");
  mainCtx.append("assistant", "let me check archival");

  console.log(`\nmain context (${mainCtx.messages.length} messages, ${mainCtx.evicted.length} evicted)`);
  console.log(mainCtx.render());

  console.log("\npage in: archival_memory_search('tool chains drift')");
  const hit = tools.archivalMemorySearch("tool chains drift", 2);
  console.log(hit);

  console.log("\nconversation_search for 'retrieval bot'");
  console.log(tools.conversationSearch("retrieval bot"));

  console.log();
  console.log("pattern: memory is interrupt-driven. agent calls a tool, runtime");
  console.log("fetches, result splices back as observation. same as Unix read().");
}

main();
