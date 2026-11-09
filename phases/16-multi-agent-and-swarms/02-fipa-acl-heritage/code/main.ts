// Lesson: Heritage of FIPA-ACL and Speech Acts (phase 16 / lesson 02)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/02-fipa-acl-heritage/code/main.ts

export {};

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function pyStr(s: string): string {
  const q = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
  if (q === "'") out = out.replace(/'/g, "\\'");
  return q + out + q;
}

function pyRepr(v: Json): string {
  if (v === null) return "None";
  if (typeof v === "string") return pyStr(v);
  if (typeof v === "boolean") return v ? "True" : "False";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v)) return "[" + v.map(pyRepr).join(", ") + "]";
  return "{" + Object.entries(v).map(([k, x]) => `${pyStr(k)}: ${pyRepr(x)}`).join(", ") + "}";
}

const PERFORMATIVES = new Set([
  "inform", "request", "query-if", "query-ref", "propose",
  "accept-proposal", "reject-proposal", "agree", "refuse",
  "confirm", "disconfirm", "not-understood", "cfp",
  "subscribe", "cancel", "failure",
]);

interface ACLInit {
  performative: string;
  sender: string;
  receiver: string;
  content: Json;
  language?: string;
  ontology?: string;
  protocol?: string | null;
  conversation_id?: string | null;
  reply_with?: string | null;
}

class ACLMessage {
  performative: string;
  sender: string;
  receiver: string;
  content: Json;
  language: string;
  ontology: string;
  protocol: string | null;
  conversation_id: string | null;
  reply_with: string | null;

  constructor(init: ACLInit) {
    this.performative = init.performative;
    this.sender = init.sender;
    this.receiver = init.receiver;
    this.content = init.content;
    this.language = init.language ?? "SL0";
    this.ontology = init.ontology ?? "default";
    this.protocol = init.protocol ?? null;
    this.conversation_id = init.conversation_id ?? null;
    this.reply_with = init.reply_with ?? null;
    if (!PERFORMATIVES.has(this.performative)) {
      throw new Error(`unknown performative: ${this.performative}`);
    }
  }

  render(): string {
    const fields = [
      `:sender       ${this.sender}`,
      `:receiver     ${this.receiver}`,
      `:content      ${pyRepr(this.content)}`,
      `:language     ${this.language}`,
      `:ontology     ${this.ontology}`,
    ];
    if (this.protocol) fields.push(`:protocol     ${this.protocol}`);
    if (this.conversation_id) fields.push(`:conversation-id ${this.conversation_id}`);
    if (this.reply_with) fields.push(`:reply-with   ${this.reply_with}`);
    const inner = fields.join("\n  ");
    return `(${this.performative}\n  ${inner}\n)`;
  }
}

type Obj = { [key: string]: Json };

function mcpToolsCallToAcl(req: Obj): ACLMessage {
  const params = req["params"] as Obj;
  return new ACLMessage({
    performative: "request",
    sender: "host",
    receiver: "tool-server",
    content: params["arguments"] ?? {},
    language: "JSON",
    ontology: params["name"] as string,
    protocol: "fipa-request",
    conversation_id: `jsonrpc-${req["id"]}`,
    reply_with: `msg-${req["id"]}`,
  });
}

function mcpResourcesReadToAcl(req: Obj): ACLMessage {
  const params = req["params"] as Obj;
  return new ACLMessage({
    performative: "query-ref",
    sender: "host",
    receiver: "resource-server",
    content: params["uri"],
    language: "URI",
    ontology: "mcp-resource",
    protocol: "fipa-query",
    conversation_id: `jsonrpc-${req["id"]}`,
    reply_with: `msg-${req["id"]}`,
  });
}

function a2aTaskCreateToAcl(task: Obj): ACLMessage {
  return new ACLMessage({
    performative: "request",
    sender: (task["client"] as string | undefined) ?? "client",
    receiver: (task["agent"] as string | undefined) ?? "agent",
    content: task["input"],
    language: "JSON",
    ontology: (task["skill"] as string | undefined) ?? "default",
    protocol: "a2a-task",
    conversation_id: (task["task_id"] as string | undefined) ?? "t-0",
    reply_with: (task["task_id"] as string | undefined) ?? "t-0",
  });
}

function a2aSubscribeToAcl(taskId: string, client: string, agent: string): ACLMessage {
  return new ACLMessage({
    performative: "subscribe",
    sender: client,
    receiver: agent,
    content: { task_id: taskId, event_types: ["state", "artifact"] },
    language: "JSON",
    ontology: "a2a-events",
    protocol: "fipa-subscribe",
    conversation_id: taskId,
  });
}

class Bid {
  constructor(public bidder: string, public price: number, public eta_minutes: number) {}
}

class ContractNet {
  log: ACLMessage[] = [];

  constructor(public manager: string, public bidders: string[]) {}

  cfp(task: string, conv: string): void {
    for (const b of this.bidders) {
      this.log.push(new ACLMessage({
        performative: "cfp",
        sender: this.manager,
        receiver: b,
        content: task,
        ontology: "contract-net",
        protocol: "fipa-contract-net",
        conversation_id: conv,
        reply_with: `cfp-${b}`,
      }));
    }
  }

  propose(bidder: string, bid: Bid, conv: string): void {
    this.log.push(new ACLMessage({
      performative: "propose",
      sender: bidder,
      receiver: this.manager,
      content: { price: bid.price, eta_minutes: bid.eta_minutes },
      ontology: "contract-net",
      protocol: "fipa-contract-net",
      conversation_id: conv,
      reply_with: `propose-${bidder}`,
    }));
  }

  award(winner: string, losers: string[], conv: string): void {
    this.log.push(new ACLMessage({
      performative: "accept-proposal",
      sender: this.manager,
      receiver: winner,
      content: "awarded",
      ontology: "contract-net",
      protocol: "fipa-contract-net",
      conversation_id: conv,
    }));
    for (const L of losers) {
      this.log.push(new ACLMessage({
        performative: "reject-proposal",
        sender: this.manager,
        receiver: L,
        content: "not awarded",
        ontology: "contract-net",
        protocol: "fipa-contract-net",
        conversation_id: conv,
      }));
    }
  }
}

function demoRoundTrip(): void {
  console.log("=".repeat(72));
  console.log("Round-trip: 2026 JSON-RPC / REST <-> FIPA-ACL envelope");
  console.log("=".repeat(72));

  const mcpCall: Obj = {
    jsonrpc: "2.0",
    method: "tools/call",
    params: { name: "lookup_stock", arguments: { symbol: "IBM" } },
    id: 42,
  };
  console.log("\n-- MCP tools/call --");
  console.log(pyRepr(mcpCall));
  console.log("as ACL:");
  console.log(mcpToolsCallToAcl(mcpCall).render());

  const mcpRead: Obj = {
    jsonrpc: "2.0",
    method: "resources/read",
    params: { uri: "file:///etc/hosts" },
    id: 43,
  };
  console.log("\n-- MCP resources/read --");
  console.log(pyRepr(mcpRead));
  console.log("as ACL:");
  console.log(mcpResourcesReadToAcl(mcpRead).render());

  const a2aTask: Obj = {
    client: "research-host",
    agent: "code-review-agent",
    skill: "review-python",
    input: "def f(x): return x",
    task_id: "t-12",
  };
  console.log("\n-- A2A POST /tasks --");
  console.log(pyRepr(a2aTask));
  console.log("as ACL:");
  console.log(a2aTaskCreateToAcl(a2aTask).render());

  console.log("\n-- A2A SSE subscribe --");
  console.log(a2aSubscribeToAcl("t-12", "research-host", "code-review-agent").render());
}

function demoContractNet(): void {
  console.log("\n" + "=".repeat(72));
  console.log("Contract Net Protocol: manager broadcasts cfp, bidders propose");
  console.log("=".repeat(72));

  const cn = new ContractNet("scheduler", ["worker-a", "worker-b", "worker-c"]);
  const conv = "cn-1";

  cn.cfp("compress 10GB log bundle", conv);
  cn.propose("worker-a", new Bid("worker-a", 3, 18), conv);
  cn.propose("worker-b", new Bid("worker-b", 2, 25), conv);
  cn.propose("worker-c", new Bid("worker-c", 4, 10), conv);

  const proposes = cn.log.filter((m) => m.performative === "propose");
  const score = (m: ACLMessage): number => {
    const c = m.content as Obj;
    return (c["price"] as number) + (c["eta_minutes"] as number) / 10;
  };
  let winner = proposes[0];
  for (const m of proposes) {
    if (score(m) < score(winner)) winner = m;
  }
  const losers = proposes.filter((m) => m.sender !== winner.sender).map((m) => m.sender);
  cn.award(winner.sender, losers, conv);

  for (const msg of cn.log) {
    console.log();
    console.log(msg.render());
  }

  const wc = winner.content as Obj;
  console.log(`\nWinner: ${winner.sender} (price ${wc["price"]}, eta ${wc["eta_minutes"]}m)`);
}

function main(): void {
  demoRoundTrip();
  demoContractNet();
  console.log("\nTakeaway: MCP/A2A messages are FIPA-ACL envelopes with JSON syntax.");
  console.log("The structural primitives survive; the ontology and formal semantics do not.");
}

main();
