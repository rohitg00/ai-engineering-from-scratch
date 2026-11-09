// Lesson: Human-in-the-Loop: Propose-Then-Commit (phase 15 / lesson 15)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/15-propose-then-commit/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/15-propose-then-commit/code/main.ts

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type Json = string | number | boolean | null | Json[] | { [k: string]: Json };
type Payload = { [k: string]: string | number };
type ProposalRecord = { [k: string]: Json };

function pyDumps(v: Json, sortKeys: boolean = false): string {
  if (v === null) {
    return "null";
  }
  if (Array.isArray(v)) {
    return `[${v.map((x) => pyDumps(x, sortKeys)).join(", ")}]`;
  }
  if (typeof v === "object") {
    const keys = Object.keys(v);
    if (sortKeys) {
      keys.sort();
    }
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${pyDumps(v[k], sortKeys)}`).join(", ")}}`;
  }
  return JSON.stringify(v);
}

class Proposal {
  constructor(
    public thread_id: string,
    public action: string,
    public payload: Payload,
    public intent: string,
    public lineage: string,
    public blast_radius: string,
    public rollback: string,
  ) {}

  key(): string {
    const sig = pyDumps({ t: this.thread_id, a: this.action, p: this.payload }, true);
    return createHash("sha256").update(sig, "utf8").digest("hex").slice(0, 16);
  }

  fields(): ProposalRecord {
    return {
      thread_id: this.thread_id,
      action: this.action,
      payload: this.payload,
      intent: this.intent,
      lineage: this.lineage,
      blast_radius: this.blast_radius,
      rollback: this.rollback,
    };
  }
}

class Store {
  constructor(public path: string) {
    if (!fs.existsSync(this.path)) {
      fs.writeFileSync(this.path, JSON.stringify({}));
    }
  }

  all(): { [k: string]: ProposalRecord } {
    return JSON.parse(fs.readFileSync(this.path, "utf8")) as { [k: string]: ProposalRecord };
  }

  save(key: string, record: ProposalRecord): void {
    const data = this.all();
    data[key] = record;
    fs.writeFileSync(this.path, JSON.stringify(data));
  }
}

const SIDE_EFFECTS: string[] = [];

function execute(proposal: Proposal): boolean {
  SIDE_EFFECTS.push(`${proposal.action}:${pyDumps(proposal.payload)}`);
  return true;
}

function verify(proposal: Proposal): boolean {
  const needle = `${proposal.action}:${pyDumps(proposal.payload)}`;
  return SIDE_EFFECTS.includes(needle);
}

function pyBool(b: boolean): string {
  return b ? "True" : "False";
}

function propose(store: Store, p: Proposal): string {
  const k = p.key();
  const existing = store.all()[k];
  if (existing) {
    console.log(`  [propose] idempotent: record ${k} already exists (status=${existing.status})`);
    return k;
  }
  const record: ProposalRecord = { status: "waiting", ...p.fields() };
  store.save(k, record);
  console.log(`  [propose] record ${k} stored, waiting for review`);
  return k;
}

function surface(store: Store, k: string): void {
  const r = store.all()[k];
  console.log(`  [surface] proposal ${k}`);
  for (const name of ["intent", "lineage", "blast_radius", "rollback"]) {
    console.log(`    ${name.padEnd(14)} ${r[name]}`);
  }
}

function rubberStampApprove(store: Store, k: string): boolean {
  const r = store.all();
  const rec = r[k];
  rec.status = "approved";
  rec.ack_mode = "rubber_stamp";
  store.save(k, rec);
  console.log("  [approve:rubber-stamp] clicked Approve (no checklist)");
  return true;
}

function checklistApprove(
  store: Store,
  k: string,
  understood: boolean,
  verified: boolean,
  rollbackReady: boolean,
): boolean {
  if (!(understood && verified && rollbackReady)) {
    console.log("  [approve:checklist] REJECTED (incomplete answers)");
    return false;
  }
  const r = store.all();
  const rec = r[k];
  rec.status = "approved";
  rec.ack_mode = "challenge_response";
  store.save(k, rec);
  console.log("  [approve:checklist] APPROVED (all three checks)");
  return true;
}

function commit(store: Store, k: string): boolean {
  const data = store.all();
  const rec = data[k];
  if (rec.status === "committed") {
    console.log(`  [commit] idempotent: ${k} already committed, no re-execute`);
    return true;
  }
  if (rec.status !== "approved") {
    console.log(`  [commit] refusing: ${k} status=${rec.status}`);
    return false;
  }
  const p = new Proposal(
    rec.thread_id as string,
    rec.action as string,
    rec.payload as Payload,
    rec.intent as string,
    rec.lineage as string,
    rec.blast_radius as string,
    rec.rollback as string,
  );
  execute(p);
  rec.status = "committed";
  store.save(k, rec);
  console.log(`  [commit] executed; verify=${pyBool(verify(p))}`);
  return true;
}

function main(): void {
  console.log("=".repeat(80));
  console.log("PROPOSE-THEN-COMMIT HITL (Phase 15, Lesson 15)");
  console.log("=".repeat(80));
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ptc-"));
  const store = new Store(path.join(tmp, "proposals.json"));

  const p = new Proposal(
    "t-001",
    "email.send",
    { to: "team@example.com", subject: "release" },
    "Announce the v1.2 release to the team list",
    "Release notes page /releases/1.2",
    "37 recipients; wrong send = external embarrassment",
    "no in-band rollback; follow up with correction email",
  );

  console.log("\nDemo 1: clean approval flow (challenge-and-response)");
  console.log("-".repeat(80));
  const k = propose(store, p);
  surface(store, k);
  checklistApprove(store, k, true, true, true);
  commit(store, k);

  console.log("\nDemo 2: retry after approval; idempotency catches re-exec");
  console.log("-".repeat(80));
  const initial = SIDE_EFFECTS.length;
  commit(store, k);
  commit(store, k);
  console.log(`  total side effects after 2 retries: ${SIDE_EFFECTS.length} (was ${initial}) -> idempotent`);

  console.log("\nDemo 3: rubber-stamp UI vs challenge-and-response");
  console.log("-".repeat(80));
  const p2 = new Proposal(
    "t-002",
    "db.update",
    { row: 42, col: "status", val: "closed" },
    "Close a stale issue",
    "periodic scan of stale-issue dashboard",
    "one DB row; reversible within 1h backup window",
    "restore row from nightly backup",
  );
  const k2 = propose(store, p2);
  rubberStampApprove(store, k2);
  commit(store, k2);

  const p3 = new Proposal(
    "t-003",
    "db.drop_table",
    { table: "old_users" },
    "Drop an unused table (per cleanup runbook)",
    "runbook #RB-17",
    "destructive; 420k rows dropped; not reversible within 24h",
    "restore from weekly backup; data loss up to 6 days",
  );
  const k3 = propose(store, p3);
  const ok = checklistApprove(store, k3, true, true, false);
  if (!ok) {
    commit(store, k3);
  }

  console.log();
  console.log("=".repeat(80));
  console.log("HEADLINE: make structured review the path of least resistance");
  console.log("-".repeat(80));
  console.log("  Idempotency keys prevent double-execution on retry.");
  console.log("  Durability lets approvals arrive two days late and still apply.");
  console.log("  Challenge-and-response checklist is the documented mitigation");
  console.log("  for rubber-stamp approval; EU AI Act Article 14 expects it.");
  console.log("  Post-commit verify closes the 'thought it happened' class.");
}

main();
