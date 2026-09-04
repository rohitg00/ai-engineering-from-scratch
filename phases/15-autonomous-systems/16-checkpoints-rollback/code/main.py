"""Checkpointed workflow with idempotency, precondition, verify, rollback.

Simulates four scenarios:
  1. clean run
  2. retry after commit-crash  -> idempotency prevents double-execute
  3. precondition fail         -> workflow aborts without firing
  4. verify fail               -> rollback fires
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from dataclasses import dataclass


# ---------- Mini database ----------

DB = {"balance_A": 1500, "balance_B": 200, "last_transfer_id": None}


def persist_transfer(txid: str, from_acct: str, to_acct: str, amount: int) -> None:
    DB[f"balance_{from_acct}"] -= amount
    DB[f"balance_{to_acct}"] += amount
    DB["last_transfer_id"] = txid


def rollback_transfer(txid: str, from_acct: str, to_acct: str, amount: int,
                      prior_last_transfer_id: str | None) -> None:
    # Compensating transaction: restore balances and the prior transfer id.
    DB[f"balance_{from_acct}"] += amount
    DB[f"balance_{to_acct}"] -= amount
    DB["last_transfer_id"] = prior_last_transfer_id


# ---------- Checkpoint store ----------

@dataclass
class Checkpoint:
    path: str

    def __post_init__(self) -> None:
        if not os.path.exists(self.path):
            with open(self.path, "w") as f:
                json.dump({}, f)

    def load(self) -> dict:
        with open(self.path) as f:
            return json.load(f)

    def save(self, k: str, v: dict) -> None:
        # Atomic write: serialize to a sibling temp file, fsync, then
        # rename. If the process crashes mid-write, the original file
        # is still intact, so the next retry finds the previous
        # idempotency record rather than a truncated JSON blob.
        data = self.load()
        data[k] = v
        tmp_path = f"{self.path}.tmp"
        with open(tmp_path, "w") as f:
            json.dump(data, f)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp_path, self.path)


# ---------- Workflow ----------

def key(txid: str) -> str:
    return hashlib.sha256(txid.encode()).hexdigest()[:12]


def run_transfer(cp: Checkpoint, txid: str, from_acct: str, to_acct: str,
                 amount: int, min_balance: int,
                 inject_crash_after_execute: bool = False,
                 inject_verify_fail: bool = False) -> str:
    k = key(txid)
    record = cp.load().get(k, {"status": "new"})

    # Idempotency across all terminal states. A retry of the same txid
    # after ANY terminal verdict — committed, verified, rolled-back,
    # aborted-precondition — must short-circuit to the original result
    # instead of re-executing.
    terminal_results = {
        "committed": "idempotent-skip",
        "verified": "ok",
        "rolled-back": "verify-fail-rolled-back",
        "aborted-precondition": "aborted-precondition",
    }
    if record["status"] in terminal_results:
        return terminal_results[record["status"]]

    # Precondition check: post-transfer balance must remain >= min_balance
    if DB[f"balance_{from_acct}"] - amount < min_balance:
        cp.save(k, {"status": "aborted-precondition", "txid": txid})
        return "aborted-precondition"

    # Capture prior state so rollback can restore exactly (not just invert).
    prior_last_transfer_id = DB["last_transfer_id"]

    # Record intent BEFORE the side effect, so a crash between the
    # save and persist_transfer leaves a "committed" marker the retry
    # can detect and short-circuit. We only promote to "verified" once
    # the post-action read (below) confirms the side effect landed.
    #
    # Subtle durability gap (lesson trade-off): if the process crashes
    # AFTER cp.save and BEFORE persist_transfer, a retry will see
    # status == "committed" and return "idempotent-skip" even though
    # the transfer never actually ran. Production systems close this
    # gap by either (a) carrying the idempotency key into the side
    # effect itself so the destination DB enforces exactly-once, or
    # (b) gating "committed" on a post-action read of the destination,
    # which is exactly what the verify step below does for the
    # non-crash path.
    cp.save(k, {"status": "committed", "txid": txid,
                "from_acct": from_acct, "to_acct": to_acct,
                "amount": amount,
                "prior_last_transfer_id": prior_last_transfer_id})
    persist_transfer(txid, from_acct, to_acct, amount)
    if inject_crash_after_execute:
        raise RuntimeError("simulated crash after execute")

    # Post-action verify
    if inject_verify_fail or DB["last_transfer_id"] != txid:
        rollback_transfer(txid, from_acct, to_acct, amount, prior_last_transfer_id)
        cp.save(k, {"status": "rolled-back", "txid": txid})
        return "verify-fail-rolled-back"

    cp.save(k, {"status": "verified", "txid": txid})
    return "ok"


# ---------- Driver ----------

def main() -> None:
    print("=" * 80)
    print("CHECKPOINTS AND ROLLBACK (Phase 15, Lesson 16)")
    print("=" * 80)

    tmp = tempfile.mkdtemp()
    print()
    print("Scenario 1: clean run")
    print("-" * 80)
    cp = Checkpoint(os.path.join(tmp, "cp1.json"))
    out = run_transfer(cp, "tx-001", "A", "B", 100, min_balance=200)
    print(f"  result={out}  DB={DB}")

    print("\nScenario 2: crash mid-commit, retry (idempotency catches)")
    print("-" * 80)
    cp = Checkpoint(os.path.join(tmp, "cp2.json"))
    try:
        run_transfer(cp, "tx-002", "A", "B", 100, min_balance=200,
                     inject_crash_after_execute=True)
    except RuntimeError as e:
        print(f"  crash: {e}")
    # Retry after the crash
    out = run_transfer(cp, "tx-002", "A", "B", 100, min_balance=200)
    print(f"  retry result={out}  DB={DB}")

    print("\nScenario 3: precondition fails (balance would go below min)")
    print("-" * 80)
    cp = Checkpoint(os.path.join(tmp, "cp3.json"))
    out = run_transfer(cp, "tx-003", "A", "B", 10_000, min_balance=200)
    print(f"  result={out}  DB={DB}")

    print("\nScenario 4: verify fails -> rollback")
    print("-" * 80)
    cp = Checkpoint(os.path.join(tmp, "cp4.json"))
    balances_before = dict(DB)
    out = run_transfer(cp, "tx-004", "A", "B", 100, min_balance=200,
                       inject_verify_fail=True)
    balances_after = dict(DB)
    print(f"  result={out}  balances_before_after_equal="
          f"{balances_before == balances_after}")

    print()
    print("=" * 80)
    print("HEADLINE: idempotency + precondition + verify + rollback")
    print("-" * 80)
    print("  Four pieces, not one. Each covers a distinct failure class:")
    print("  idempotency -> retry-safe on crash")
    print("  precondition -> state drift between approval and commit")
    print("  verify       -> the side effect did not happen when we thought it did")
    print("  rollback     -> known-bad state restored or alerted")
    print("  Article 14 operational reading: checkpoints queryable, rollbacks")
    print("  rehearsed, audit trail survives deploys.")


if __name__ == "__main__":
    main()
