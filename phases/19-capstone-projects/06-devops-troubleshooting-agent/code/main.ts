// Lesson: Capstone 06: DevOps Troubleshooting Agent for Kubernetes (phase 19 / lesson 06)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/19-capstone-projects/06-devops-troubleshooting-agent/docs/en.md
// Run: npx tsx phases/19-capstone-projects/06-devops-troubleshooting-agent/code/main.ts

export {};

type Attrs = Record<string, string | number>;

class Node {
  constructor(public kind: string, public name: string, public attrs: Attrs = {}) {}

  get key(): string {
    return `${this.kind}/${this.name}`;
  }
}

class Graph {
  nodes = new Map<string, Node>();
  edges: [string, string, string][] = [];

  add(n: Node): void {
    this.nodes.set(n.key, n);
  }

  link(src: string, rel: string, dst: string): void {
    this.edges.push([src, rel, dst]);
  }

  neighbors(key: string): [string, string][] {
    const out: [string, string][] = this.edges.filter(([s]) => s === key).map(([, rel, dst]) => [rel, dst]);
    for (const [src, rel, dst] of this.edges) if (dst === key) out.push([rel, src]);
    return out;
  }
}

function buildSampleCluster(): Graph {
  const g = new Graph();
  const dep = new Node("Deployment", "checkout-api", { revision: 42, image: "checkout-api:v2.41", deployed_at: "14m ago" });
  const rs = new Node("ReplicaSet", "checkout-api-abc");
  const node = new Node("Node", "ip-10-2-3-4", { kernel: "6.1.109" });
  const pods = [0, 1, 2].map((i) => new Node("Pod", `checkout-api-abc-${i}`, { phase: "Running" }));
  const svc = new Node("Service", "checkout-api");
  const prom = new Node("Prom", "error_rate{deployment=checkout-api}", { last_15m: "mean=0.14 up_trend", threshold: 0.05 });
  const loki = new Node("Loki", "namespace=prod,app=checkout-api", { last_15m: "500 errors on /api/v2/pay, stack = NullHealthz" });

  for (const n of [dep, rs, node, svc, prom, loki, ...pods]) g.add(n);
  g.link(dep.key, "OWNS", rs.key);
  for (const p of pods) {
    g.link(rs.key, "OWNS", p.key);
    g.link(p.key, "SCHEDULED_ON", node.key);
  }
  g.link(svc.key, "EXPOSES", dep.key);
  g.link(dep.key, "OBSERVED_BY", prom.key);
  g.link(dep.key, "OBSERVED_BY", loki.key);
  return g;
}

class Hypothesis {
  constructor(
    public title: string,
    public citations: string[],
    public recency_mins: number,
    public specificity: number,
    public path_len: number,
  ) {}

  score(): number {
    const recencyW = Math.max(0.0, 1.0 - this.recency_mins / 60.0);
    const pathW = 1.0 / (1 + this.path_len);
    return recencyW * 0.35 + this.specificity * 0.35 + (Math.min(this.citations.length, 5) / 5) * 0.2 + pathW * 0.1;
  }
}

function rootCause(g: Graph, alerted: string): Hypothesis[] {
  const hyps: Hypothesis[] = [];
  const telemetry: Node[] = [];
  for (const [, neighborKey] of g.neighbors(alerted)) {
    const n = g.nodes.get(neighborKey);
    if (n && ["Prom", "Loki", "Tempo"].includes(n.kind)) telemetry.push(n);
  }

  const dep = g.nodes.get(alerted);
  if (dep && dep.kind === "Deployment") {
    const deployed = String(dep.attrs.deployed_at ?? "");
    const mins = deployed.includes("m") ? parseInt(deployed.split("m")[0], 10) : 999;
    hyps.push(new Hypothesis(`bad rollout: image ${dep.attrs.image} fails /healthz`, telemetry.map((t) => t.name), mins, 0.82, 0));
  }

  const nodes = g.neighbors(alerted).filter(([, dst]) => dst.startsWith("Node/")).map(([, dst]) => g.nodes.get(dst) as Node);
  if (nodes.length > 0) {
    hyps.push(new Hypothesis(`node-level pressure on ${nodes[0].name} (kernel=${nodes[0].attrs.kernel})`, nodes.map((n) => n.name), 30, 0.45, 2));
  }

  hyps.push(new Hypothesis("DNS flap in kube-system/coredns", [], 60, 0.2, 4));

  return [...hyps].sort((a, b) => b.score() - a.score());
}

class AuditEvent {
  considered = true;
  approved = false;
  executed = false;
  approver: string | null = null;
  result: string | null = null;

  constructor(public ts: number, public tool: string, public args: Record<string, unknown>) {}
}

class Agent {
  audit: AuditEvent[] = [];
  read_only_tools = ["kubectl_get", "kubectl_describe", "promql", "logql", "traceql"];
  destructive_tools = ["kubectl_scale", "kubectl_rollback", "kubectl_delete", "argocd_rollback"];

  constructor(public graph: Graph) {}

  call(tool: string, args: Record<string, unknown>, approver: string | null = null): AuditEvent {
    const ev = new AuditEvent(Date.now() / 1000, tool, args);
    if (this.read_only_tools.includes(tool)) {
      ev.executed = true;
      ev.result = "ok (read-only)";
    } else if (this.destructive_tools.includes(tool)) {
      if (approver) {
        ev.approved = true;
        ev.approver = approver;
        ev.executed = true;
        ev.result = `executed by ${approver}`;
      } else {
        ev.result = "blocked: no slack approval";
      }
    } else {
      ev.result = "blocked: unknown tool";
    }
    this.audit.push(ev);
    return ev;
  }
}

function pyStr(s: string): string {
  if (s.includes("'") && !s.includes('"')) return `"${s}"`;
  return `'${s.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function pyJson(obj: Record<string, string | boolean | null>): string {
  return "{" + Object.entries(obj).map(([k, v]) => `${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ") + "}";
}

function main(): void {
  const g = buildSampleCluster();
  const agent = new Agent(g);

  const alerted = "Deployment/checkout-api";
  console.log(`=== alert received: ${alerted} (error rate 14%) ===`);

  agent.call("promql", { query: "rate(http_requests_total{status=~'5..'}[5m])" });
  agent.call("logql", { query: '{app="checkout-api"} |~ "stack"' });

  const hyps = rootCause(g, alerted);
  console.log("\nranked hypotheses:");
  hyps.forEach((h, i) => {
    console.log(`  #${i + 1} score=${h.score().toFixed(3)}  ${h.title}`);
    console.log(`     citations: [${h.citations.map(pyStr).join(", ")}]`);
  });

  console.log("\nproposing remediation:");
  let ev = agent.call("argocd_rollback", { app: "checkout-api", to_revision: 41 });
  console.log(`  ${ev.tool}: ${ev.result}`);

  console.log("\nslack approval granted by alice@sre");
  ev = agent.call("argocd_rollback", { app: "checkout-api", to_revision: 41 }, "alice@sre");
  console.log(`  ${ev.tool}: ${ev.result}`);

  console.log("\naudit log:");
  for (const e of agent.audit) {
    console.log(" ", pyJson({ tool: e.tool, executed: e.executed, approved: e.approved, approver: e.approver, result: e.result }));
  }
}

main();
