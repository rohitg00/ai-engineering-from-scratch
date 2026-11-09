// Lesson: Checkpoints and Rollback (phase 15 / lesson 16)
// TypeScript port of code/main.py. Node standard library only.
// Source: phases/15-autonomous-systems/16-checkpoints-rollback/docs/en.md
// Run: npx tsx phases/15-autonomous-systems/16-checkpoints-rollback/code/main.ts

import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

type DbValue = number | string | null;
type CheckpointRecord = { [k: string]: string | number | null };

const DB: { [k: string]: DbValue } = { balance_A: 1500, balance_B: 200, last_transfer_id: null };

function pyRepr(v: DbValue): string {
  if (v === null) {
    return "None";
  }
  return typeof v === "string" ? `'${v}'` : String(v);
}

function pyDict(d: { [k: string]: DbValue }): string {
  return `{${Object.entries(d)
    .map(([k, v]) => `'${k}': ${pyRepr(v)}`)
    .join(", ")}}`;
}

function persistTransfer(txid: string, fromAcct: string, toAcct: string, amount: number): void {
  DB[`balance_${fromAcct}`] = (DB[`balance_${fromAcct}`] as number) - amount;
  DB[`balance_${toAcct}`] = (DB[`balance_${toAcct}`] as number) + amount;
  DB.last_transfer_id = txid;
}

function rollbackTransfer(
  _txid: string,
  fromAcct: string,
  toAcct: string,
  amount: number,
  priorLastTransferId: DbValue,
): void {
  DB[`balance_${fromAcct}`] = (DB[`balance_${fromAcct}`] as number) + amount;
  DB[`balance_${toAcct}`] = (DB[`balance_${toAcct}`] as number) - amount;
  DB.last_transfer_id = priorLastTransferId;
}

class Checkpoint {
  constructor(public path: string) {
    if (!fs.existsSync(this.path)) {
      fs.writeFileSync(this.path, JSON.stringify({}));
    }
  }

  load(): { [k: string]: CheckpointRecord } {
    return JSON.parse(fs.readFileSync(this.path, "utf8")) as { [k: string]: CheckpointRecord };
  }

  save(k: string, v: CheckpointRecord): void {
    const data = this.load();
    data[k] = v;
    const tmpPath = `${this.path}.tmp`;
    const fd = fs.openSync(tmpPath, "w");
    fs.writeSync(fd, JSON.stringify(data));
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fs.renameSync(tmpPath, this.path);
  }
}

function key(txid: string): string {
  return createHash("sha256").update(txid, "utf8").digest("hex").slice(0, 12);
}

class RuntimeError extends Error {}

function runTransfer(
  cp: Checkpoint,
  txid: string,
  fromAcct: string,
  toAcct: string,
  amount: number,
  minBalance: number,
  injectCrashAfterExecute: boolean = false,
  injectVerifyFail: boolean = false,
): string {
  const k = key(txid);
  const record: CheckpointRecord = cp.load()[k] ?? { status: "new" };

  const terminalResults: { [k: string]: string } = {
    committed: "idempotent-skip",
    verified: "ok",
    "rolled-back": "verify-fail-rolled-back",
    "aborted-precondition": "aborted-precondition",
  };
  const status = record.status as string;
  if (Object.prototype.hasOwnProperty.call(terminalResults, status)) {
    return terminalResults[status];
  }

  if ((DB[`balance_${fromAcct}`] as number) - amount < minBalance) {
    cp.save(k, { status: "aborted-precondition", txid });
    return "aborted-precondition";
  }

  const priorLastTransferId = DB.last_transfer_id;

  cp.save(k, {
    status: "committed",
    txid,
    from_acct: fromAcct,
    to_acct: toAcct,
    amount,
    prior_last_transfer_id: priorLastTransferId,
  });
  persistTransfer(txid, fromAcct, toAcct, amount);
  if (injectCrashAfterExecute) {
    throw new RuntimeError("simulated crash after execute");
  }

  if (injectVerifyFail || DB.last_transfer_id !== txid) {
    rollbackTransfer(txid, fromAcct, toAcct, amount, priorLastTransferId);
    cp.save(k, { status: "rolled-back", txid });
    return "verify-fail-rolled-back";
  }

  cp.save(k, { status: "verified", txid });
  return "ok";
}

function main(): void {
  console.log("=".repeat(80));
  console.log("CHECKPOINTS AND ROLLBACK (Phase 15, Lesson 16)");
  console.log("=".repeat(80));

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "cp-"));
  console.log();
  console.log("Scenario 1: clean run");
  console.log("-".repeat(80));
  let cp = new Checkpoint(path.join(tmp, "cp1.json"));
  let out = runTransfer(cp, "tx-001", "A", "B", 100, 200);
  console.log(`  result=${out}  DB=${pyDict(DB)}`);

  console.log("\nScenario 2: crash mid-commit, retry (idempotency catches)");
  console.log("-".repeat(80));
  cp = new Checkpoint(path.join(tmp, "cp2.json"));
  try {
    runTransfer(cp, "tx-002", "A", "B", 100, 200, true);
  } catch (e) {
    if (!(e instanceof RuntimeError)) {
      throw e;
    }
    console.log(`  crash: ${e.message}`);
  }
  out = runTransfer(cp, "tx-002", "A", "B", 100, 200);
  console.log(`  retry result=${out}  DB=${pyDict(DB)}`);

  console.log("\nScenario 3: precondition fails (balance would go below min)");
  console.log("-".repeat(80));
  cp = new Checkpoint(path.join(tmp, "cp3.json"));
  out = runTransfer(cp, "tx-003", "A", "B", 10_000, 200);
  console.log(`  result=${out}  DB=${pyDict(DB)}`);

  console.log("\nScenario 4: verify fails -> rollback");
  console.log("-".repeat(80));
  cp = new Checkpoint(path.join(tmp, "cp4.json"));
  const balancesBefore = { ...DB };
  out = runTransfer(cp, "tx-004", "A", "B", 100, 200, false, true);
  const balancesAfter = { ...DB };
  const equal = pyDict(balancesBefore) === pyDict(balancesAfter);
  console.log(`  result=${out}  balances_before_after_equal=${equal ? "True" : "False"}`);

  console.log();
  console.log("=".repeat(80));
  console.log("HEADLINE: idempotency + precondition + verify + rollback");
  console.log("-".repeat(80));
  console.log("  Four pieces, not one. Each covers a distinct failure class:");
  console.log("  idempotency -> retry-safe on crash");
  console.log("  precondition -> state drift between approval and commit");
  console.log("  verify       -> the side effect did not happen when we thought it did");
  console.log("  rollback     -> known-bad state restored or alerted");
  console.log("  Article 14 operational reading: checkpoints queryable, rollbacks");
  console.log("  rehearsed, audit trail survives deploys.");
}

main();
