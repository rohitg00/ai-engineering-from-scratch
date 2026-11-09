// Lesson: Handoffs and Routines: Stateless Orchestration (phase 16 / lesson 11)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/16-multi-agent-and-swarms/11-handoffs-and-routines/docs/en.md
// Run: npx tsx phases/16-multi-agent-and-swarms/11-handoffs-and-routines/code/main.ts

export {};

type AgentFn = ((...args: string[]) => string | Agent) & { fnName: string };

class Agent {
  constructor(public name: string, public instructions: string, public functions: AgentFn[] = []) {}
}

interface Msg {
  role: string;
  content: string;
  sender: string | null;
}

function named(fnName: string, fn: (...args: string[]) => string | Agent): AgentFn {
  return Object.assign(fn, { fnName });
}

function triageAgentFactory(): Agent {
  const transferToRefunds = named("transfer_to_refunds", () => refundAgent);
  const transferToSales = named("transfer_to_sales", () => salesAgent);
  const transferToSupport = named("transfer_to_support", () => supportAgent);
  return new Agent(
    "triage",
    "Route user to: refunds, sales, or support.",
    [transferToRefunds, transferToSales, transferToSupport],
  );
}

function refundAgentFactory(): Agent {
  const processRefund = named("process_refund", (orderId: string) => `Refund processed for order ${orderId}.`);
  return new Agent("refund", "Handle refund requests.", [processRefund]);
}

function salesAgentFactory(): Agent {
  const quoteProduct = named("quote_product", (product: string) => `Quote for ${product}: $99/mo.`);
  return new Agent("sales", "Handle sales inquiries.", [quoteProduct]);
}

function supportAgentFactory(): Agent {
  const openTicket = named("open_ticket", (issue: string) => `Ticket opened for: ${issue}`);
  return new Agent("support", "Handle technical support.", [openTicket]);
}

const triageAgent = triageAgentFactory();
const refundAgent = refundAgentFactory();
const salesAgent = salesAgentFactory();
const supportAgent = supportAgentFactory();

function call(current: Agent, fnName: string, ...args: string[]): string | Agent {
  return current.functions.find((f) => f.fnName === fnName)!(...args);
}

function scriptedRouter(current: Agent, userMsg: string): string | Agent {
  const text = userMsg.toLowerCase();
  if (current.name === "triage") {
    if (text.includes("refund") || text.includes("money back")) return call(current, "transfer_to_refunds");
    if (text.includes("buy") || text.includes("price")) return call(current, "transfer_to_sales");
    if (text.includes("broken") || text.includes("bug")) return call(current, "transfer_to_support");
    return "Could you tell me what you need help with?";
  }
  if (current.name === "refund") {
    let order = "42";
    for (const word of userMsg.split(/\s+/).filter((w) => w !== "")) {
      if (/^[0-9]+$/.test(word)) {
        order = word;
        break;
      }
    }
    return call(current, "process_refund", order);
  }
  if (current.name === "sales") {
    const product = "enterprise plan";
    return call(current, "quote_product", product);
  }
  if (current.name === "support") {
    return call(current, "open_ticket", userMsg);
  }
  return "[no response]";
}

function runSwarm(startAgent: Agent, userMessages: string[]): Msg[] {
  const history: Msg[] = [];
  let active = startAgent;
  for (const user of userMessages) {
    history.push({ role: "user", content: user, sender: null });
    let out = scriptedRouter(active, user);
    if (out instanceof Agent) {
      history.push({ role: "assistant", content: `(handoff to ${out.name})`, sender: active.name });
      active = out;
      out = scriptedRouter(active, user);
    }
    history.push({ role: "assistant", content: String(out), sender: active.name });
  }
  return history;
}

function render(history: Msg[]): void {
  for (const m of history) {
    const tag = m.sender ? m.sender : m.role;
    console.log(`  [${tag.padStart(8)}]: ${m.content}`);
  }
}

function main(): void {
  console.log("Handoff-driven orchestration -- OpenAI Swarm shape");
  console.log("-".repeat(54));

  const scenarios: [string, string[]][] = [
    ["Refund flow", ["I need a refund on order 77"]],
    ["Sales flow", ["I want to buy the enterprise plan. what's the price?"]],
    ["Support flow", ["my dashboard is broken"]],
    ["Ambiguous", ["hello"]],
  ];
  for (const [label, msgs] of scenarios) {
    console.log(`\n=== ${label} ===`);
    const history = runSwarm(triageAgent, msgs);
    render(history);
  }

  console.log("\nKey insight: every handoff is a tool call returning an Agent.");
  console.log("The framework's sole job is detecting Agent-valued returns and switching active agent.");
  console.log("No state machine. No DSL. The agent prompts ARE the routing logic.");
}

main();
