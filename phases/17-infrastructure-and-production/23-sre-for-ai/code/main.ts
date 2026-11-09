// Lesson: SRE for AI: Multi-Agent Incident Response, Runbooks, Predictive Detection (phase 17 / lesson 23)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/17-infrastructure-and-production/23-sre-for-ai/docs/en.md
// Run: npx tsx phases/17-infrastructure-and-production/23-sre-for-ai/code/main.ts

interface AgentHypothesis {
  agent: string;
  rootCause: string;
  confidence: number;
  evidence: string[];
}

function hypothesis(agent: string, rootCause: string, confidence: number, evidence: string[]): AgentHypothesis {
  return { agent, rootCause, confidence, evidence };
}

function logAgent(incident: string): AgentHypothesis {
  if (incident.toLowerCase().includes("checkout")) {
    return hypothesis("LogAgent", "vLLM OOM from KV cache spike on /api/llm", 0.78, [
      "frequency: 142 errors/min",
      "pattern: 'kv_cache_allocation_failed'",
      "node: pod-gpu-3",
    ]);
  }
  return hypothesis("LogAgent", "unclear", 0.35, ["logs show no obvious pattern"]);
}

function metricAgent(_incident: string): AgentHypothesis {
  return hypothesis("MetricAgent", "GPU memory utilization hit 98% 4 minutes before error spike", 0.82, [
    "DCGM_FI_DEV_FB_USED >= 97% for 240s",
    "correlation with error onset: 0.93",
  ]);
}

function runbookAgent(_incident: string): AgentHypothesis {
  return hypothesis("RunbookAgent", "Matches runbook RB-017: KV cache OOM under burst concurrency", 0.88, [
    "runbook: RB-017",
    "last applied: 2026-01-14",
    "safe action: restart pod + lower --gpu-memory-utilization to 0.85",
  ]);
}

type Value = string | number | boolean | string[];

function pyRepr(v: Value): string {
  if (Array.isArray(v)) return `[${v.map((s) => `'${s}'`).join(", ")}]`;
  if (typeof v === "boolean") return v ? "True" : "False";
  return String(v);
}

function supervisor(hypotheses: AgentHypothesis[]): Map<string, Value> {
  const rootCauses = new Map<string, AgentHypothesis[]>();
  for (const h of hypotheses) {
    const key = h.rootCause.split(" on ")[0].split(" hit ")[0].slice(0, 30);
    const group = rootCauses.get(key) ?? [];
    group.push(h);
    rootCauses.set(key, group);
  }

  const total = (hs: AgentHypothesis[]): number => hs.reduce((acc, h) => acc + h.confidence, 0);
  const ranked = [...rootCauses.entries()].sort((a, b) => -total(a[1]) - -total(b[1]));
  const [topKey, topAgents] = ranked[0];
  const adversarialAgreement = topAgents.length >= 2;
  const action = "restart pod + lower --gpu-memory-utilization";

  return new Map<string, Value>([
    ["top_root_cause", topKey],
    ["supporting_agents", topAgents.map((h) => h.agent)],
    ["aggregated_confidence", total(topAgents) / topAgents.length],
    ["adversarial_agreement", adversarialAgreement],
    ["proposed_action", action],
    ["safety_gate", !adversarialAgreement ? "human approval required" : "safe action auto-approved"],
  ]);
}

function main(): void {
  console.log("=".repeat(80));
  console.log("AI SRE TRIAGE: multi-agent investigation of a production incident");
  console.log("=".repeat(80));
  const incident = "High error rate in /checkout/generate-summary, last 6 min";
  console.log(`\nIncident: ${incident}\n`);

  const hypotheses = [logAgent(incident), metricAgent(incident), runbookAgent(incident)];
  for (const h of hypotheses) {
    console.log(`[${h.agent}] confidence=${h.confidence.toFixed(2)}`);
    console.log(`  root cause: ${h.rootCause}`);
    for (const e of h.evidence) console.log(`  - ${e}`);
    console.log();
  }

  const decision = supervisor(hypotheses);
  console.log("-".repeat(80));
  console.log("SUPERVISOR");
  console.log("-".repeat(80));
  for (const [k, v] of decision) console.log(`  ${k}: ${pyRepr(v)}`);

  console.log("\nNote: the supervisor only proposes narrow safe actions.");
  console.log("Broad changes (topology, code, IAM) always escalate to a human commander.");
}

main();
