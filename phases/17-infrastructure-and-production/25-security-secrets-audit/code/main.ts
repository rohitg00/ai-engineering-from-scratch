// Lesson: Security: Secrets, API Key Rotation, Audit Logs, Guardrails (phase 17 / lesson 25)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/25-security-secrets-audit/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/25-security-secrets-audit/code/main.ts

import { createHash } from "node:crypto";

const SSN = /\b\d{3}-\d{2}-\d{4}\b/g;
const EMAIL = /\b[\w.+-]+@[\w.-]+\.\w+\b/g;
const PHONE = /(?<!\w)(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

type Kind = "SSN" | "EMAIL" | "PHONE";

class Scrubber {
  tokens = new Map<string, string>();
  counter: Record<Kind, number> = { SSN: 0, EMAIL: 0, PHONE: 0 };

  private tokenFor(kind: Kind, value: string): string {
    const existing = this.tokens.get(value);
    if (existing !== undefined) return existing;
    this.counter[kind] += 1;
    const placeholder = `[${kind}_${String(this.counter[kind]).padStart(3, "0")}]`;
    this.tokens.set(value, placeholder);
    return placeholder;
  }

  scrub(text: string): string {
    text = text.replace(SSN, (m) => this.tokenFor("SSN", m));
    text = text.replace(EMAIL, (m) => this.tokenFor("EMAIL", m));
    text = text.replace(PHONE, (m) => this.tokenFor("PHONE", m));
    return text;
  }
}

interface AuditEntry {
  timestamp: string;
  user: string;
  tenant: string;
  model: string;
  prompt_hash: string;
  response_hash: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  guardrail_trips: string[];
}

function hashShort(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);
}

function pyJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(pyJson).join(", ")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value).map(([k, v]) => `${JSON.stringify(k)}: ${pyJson(v)}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

function auditLogCall(entry: AuditEntry): string {
  return pyJson({
    timestamp: entry.timestamp,
    user: entry.user,
    tenant: entry.tenant,
    model: entry.model,
    prompt_hash: entry.prompt_hash,
    response_hash: entry.response_hash,
    input_tokens: entry.input_tokens,
    output_tokens: entry.output_tokens,
    cost_usd: entry.cost_usd,
    guardrail_trips: entry.guardrail_trips,
  });
}

function utcIsoMicros(): string {
  const iso = new Date().toISOString();
  return `${iso.slice(0, 23)}000`;
}

function main(): void {
  console.log("=".repeat(80));
  console.log("PII SCRUBBER + AUDIT LOG: consistent tokenization across calls");
  console.log("=".repeat(80));
  const scrubber = new Scrubber();

  const prompts = [
    "My SSN is 123-45-6789 and my email is jane.doe@example.com. Phone 415-555-0199.",
    "Please contact 123-45-6789 regarding account jane.doe@example.com.",
    "New user: bob@example.com, SSN 987-65-4321, phone (202) 555-0150.",
  ];

  prompts.forEach((raw, idx) => {
    const scrubbed = scrubber.scrub(raw);
    console.log(`\n[prompt ${idx + 1}]`);
    console.log(`  raw:      ${raw}`);
    console.log(`  scrubbed: ${scrubbed}`);
  });

  console.log(`\nScrubber token table (${scrubber.tokens.size} entries):`);
  for (const [value, placeholder] of scrubber.tokens) {
    const masked = value.length > 6 ? value.slice(0, 3) + "***" : "***";
    console.log(`  ${masked} → ${placeholder}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log("AUDIT LOG: one entry per scrubbed call");
  console.log("=".repeat(80));
  prompts.forEach((raw, idx) => {
    const i = idx + 1;
    const scrubbed = scrubber.scrub(raw);
    const response = `toy response for prompt ${i}`;
    const words = (s: string): number => s.split(/\s+/).filter((w) => w.length > 0).length;
    const entry: AuditEntry = {
      timestamp: utcIsoMicros() + "Z",
      user: `user_${String(i).padStart(3, "0")}`,
      tenant: "tenant_01",
      model: "anthropic/claude-3.7-sonnet",
      prompt_hash: hashShort(scrubbed),
      response_hash: hashShort(response),
      input_tokens: words(scrubbed),
      output_tokens: words(response),
      cost_usd: 0.0012,
      guardrail_trips: [],
    };
    console.log(auditLogCall(entry));
  });
}

main();
