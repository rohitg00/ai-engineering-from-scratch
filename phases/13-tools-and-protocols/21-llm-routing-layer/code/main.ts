// Lesson: LLM Routing Layer: LiteLLM, OpenRouter, Portkey (phase 13 / lesson 21)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/13-tools-and-protocols/21-llm-routing-layer/docs/en.md
// Run: npx tsx phases/13-tools-and-protocols/21-llm-routing-layer/code/main.ts

type Message = { role: string; content: string };
type Dict = { [key: string]: any };

const PRICES: { [key: string]: [number, number] } = {
  "openai/gpt-4o": [5.0, 15.0],
  "openai/gpt-4o-mini": [0.15, 0.6],
  "anthropic/claude-sonnet": [3.0, 15.0],
  "anthropic/claude-haiku": [0.8, 4.0],
  "google/gemini-pro": [1.25, 5.0],
};

const OUTAGE: Set<string> = new Set();

class RuntimeError extends Error {}

const SLEEP_CELL = new Int32Array(new SharedArrayBuffer(4));

function sleep(seconds: number): void {
  Atomics.wait(SLEEP_CELL, 0, 0, seconds * 1000);
}

function pyStrRepr(s: string): string {
  const quote = s.includes("'") && !s.includes('"') ? '"' : "'";
  let out = "";
  for (const c of s) {
    if (c === "\\") out += "\\\\";
    else if (c === quote) out += "\\" + c;
    else if (c === "\n") out += "\\n";
    else if (c === "\r") out += "\\r";
    else if (c === "\t") out += "\\t";
    else if (c.charCodeAt(0) < 0x20 || c.charCodeAt(0) === 0x7f) out += "\\x" + c.charCodeAt(0).toString(16).padStart(2, "0");
    else out += c;
  }
  return quote + out + quote;
}

function pyStrList(items: string[]): string {
  return "[" + items.map(pyStrRepr).join(", ") + "]";
}

function provider_call(model: string, messages: Message[]): Dict {
  if (OUTAGE.has(model)) throw new RuntimeError(`simulated 5xx from ${model}`);
  sleep(0.01);
  const last = messages[messages.length - 1].content;
  const lastChars = [...last];
  const out_toks = Math.max(20, Math.floor(lastChars.length / 3));
  return {
    id: `resp_${model.replaceAll("/", "_")}`,
    model,
    choices: [{ message: { role: "assistant", content: `[${model}] echoed: ${lastChars.slice(0, 60).join("")}` } }],
    usage: { prompt_tokens: Math.floor(lastChars.length / 4), completion_tokens: out_toks },
  };
}

const ROUTES: { [key: string]: string[] } = {
  smart: ["openai/gpt-4o", "anthropic/claude-sonnet", "google/gemini-pro"],
  fast: ["openai/gpt-4o-mini", "anthropic/claude-haiku"],
};

const PII_PATTERNS: RegExp[] = [/\b\d{3}-\d{2}-\d{4}\b/g, /\b\d{16}\b/g];

function redact_pii(text: string): [string, boolean] {
  let redacted = false;
  for (const pat of PII_PATTERNS) {
    pat.lastIndex = 0;
    if (pat.test(text)) {
      pat.lastIndex = 0;
      text = text.replace(pat, "[REDACTED]");
      redacted = true;
    }
  }
  return [text, redacted];
}

class Invocation {
  alias: string;
  chosen_model = "";
  attempts: string[] = [];
  input_tokens = 0;
  output_tokens = 0;
  cost_usd = 0.0;
  redacted = false;
  response: Dict | null = null;
  error: string | null = null;

  constructor(alias: string) {
    this.alias = alias;
  }
}

function route(alias: string, messages: Message[]): Invocation {
  const inv = new Invocation(alias);
  const new_msgs: Message[] = [];
  for (const m of messages) {
    const [txt, r] = redact_pii(m.content);
    if (r) inv.redacted = true;
    new_msgs.push({ role: m.role, content: txt });
  }
  const chain = ROUTES[alias] ?? [alias];
  for (const model of chain) {
    inv.attempts.push(model);
    try {
      const resp = provider_call(model, new_msgs);
      inv.chosen_model = model;
      inv.response = resp;
      const u = resp["usage"];
      inv.input_tokens = u["prompt_tokens"];
      inv.output_tokens = u["completion_tokens"];
      const [in_rate, out_rate] = PRICES[model] ?? [0, 0];
      inv.cost_usd = (u["prompt_tokens"] * in_rate + u["completion_tokens"] * out_rate) / 1_000_000;
      return inv;
    } catch (e) {
      if (e instanceof RuntimeError) continue;
      throw e;
    }
  }
  inv.error = "all providers failed";
  return inv;
}

function demo(): void {
  console.log("=".repeat(72));
  console.log("PHASE 13 LESSON 20 - LLM ROUTING GATEWAY");
  console.log("=".repeat(72));

  console.log("\n--- scenario 1: smart route, primary available ---");
  let inv = route("smart", [{ role: "user", content: "explain MCP" }]);
  console.log(`  chosen  : ${inv.chosen_model}`);
  console.log(`  attempts: ${pyStrList(inv.attempts)}`);
  console.log(`  tokens  : in=${inv.input_tokens} out=${inv.output_tokens}`);
  console.log(`  cost    : $${inv.cost_usd.toFixed(6)}`);
  console.log(`  reply   : ${inv.response?.["choices"][0]["message"]["content"]}`);

  console.log("\n--- scenario 2: openai/gpt-4o OUTAGE -> falls back to Claude ---");
  OUTAGE.add("openai/gpt-4o");
  inv = route("smart", [{ role: "user", content: "same request" }]);
  console.log(`  chosen  : ${inv.chosen_model}`);
  console.log(`  attempts: ${pyStrList(inv.attempts)}`);
  console.log(`  cost    : $${inv.cost_usd.toFixed(6)}`);
  OUTAGE.clear();

  console.log("\n--- scenario 3: PII in input gets redacted pre-dispatch ---");
  inv = route("fast", [{ role: "user", content: "contact me at SSN 123-45-6789 please" }]);
  console.log(`  redacted: ${inv.redacted ? "True" : "False"}`);
  console.log(`  reply   : ${inv.response?.["choices"][0]["message"]["content"]}`);

  console.log("\n--- scenario 4: all providers down ---");
  for (const model of ROUTES["fast"]) OUTAGE.add(model);
  inv = route("fast", [{ role: "user", content: "help" }]);
  console.log(`  attempts: ${pyStrList(inv.attempts)}`);
  console.log(`  error   : ${inv.error}`);
}

demo();

export {};
