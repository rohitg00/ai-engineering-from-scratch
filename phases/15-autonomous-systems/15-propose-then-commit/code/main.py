"""Propose-then-commit HITL state machine — stdlib Python.

Four phases:
  1. propose:  agent persists the proposed action with idempotency key
  2. surface:  reviewer sees metadata (intent, lineage, blast, rollback)
  3. commit:   positive ack required; idempotent
  4. verify:   re-read target resource after commit

Three demos:
  - clean approval flow
  - retry after transient failure -> idempotency catches
  - rubber-stamp UI vs challenge-and-response checklist
"""

from __future__ import annotations

import hashlib
import json
import os
import tempfile
from dataclasses import dataclass, field


@dataclass
class Proposal:
    thread_id: str
    action: str
    payload: dict
    intent: str
    lineage: str
    blast_radius: str
    rollback: str

    def key(self) -> str:
        sig = json.dumps({"t": self.thread_id, "a": self.action,
                          "p": self.payload}, sort_keys=True)
        return hashlib.sha256(sig.encode()).hexdigest()[:16]


@dataclass
class Store:
    path: str

    def __post_init__(self) -> None:
        if not os.path.exists(self.path):
            with open(self.path, "w") as f:
                json.dump({}, f)

    def all(self) -> dict:
        with open(self.path) as f:
            return json.load(f)

    def save(self, key: str, record: dict) -> None:
        data = self.all()
        data[key] = record
        with open(self.path, "w") as f:
            json.dump(data, f)


# ---------- Executed side-effect tracker (pretends to be a backend) ----------

SIDE_EFFECTS: list[str] = []


def execute(proposal: Proposal) -> bool:
    SIDE_EFFECTS.append(f"{proposal.action}:{json.dumps(proposal.payload)}")
    return True


def verify(proposal: Proposal) -> bool:
    # In a real system, this re-reads the target resource.
    needle = f"{proposal.action}:{json.dumps(proposal.payload)}"
    return needle in SIDE_EFFECTS


# ---------- Flow ----------

def propose(store: Store, p: Proposal) -> str:
    k = p.key()
    existing = store.all().get(k)
    if existing:
        print(f"  [propose] idempotent: record {k} already exists "
              f"(status={existing['status']})")
        return k
    record = {"status": "waiting", **vars(p)}
    store.save(k, record)
    print(f"  [propose] record {k} stored, waiting for review")
    return k


def surface(store: Store, k: str) -> None:
    r = store.all()[k]
    print(f"  [surface] proposal {k}")
    # Use 'name' rather than 'field' to avoid shadowing dataclasses.field
    # if a reader adds a dataclass below this module later (Ruff F402).
    for name in ("intent", "lineage", "blast_radius", "rollback"):
        print(f"    {name:<14} {r[name]}")


def rubber_stamp_approve(store: Store, k: str) -> bool:
    r = store.all()
    rec = r[k]
    rec["status"] = "approved"
    rec["ack_mode"] = "rubber_stamp"
    store.save(k, rec)
    print("  [approve:rubber-stamp] clicked Approve (no checklist)")
    return True


def checklist_approve(store: Store, k: str,
                      understood: bool, verified: bool,
                      rollback_ready: bool) -> bool:
    if not (understood and verified and rollback_ready):
        print("  [approve:checklist] REJECTED (incomplete answers)")
        return False
    r = store.all()
    rec = r[k]
    rec["status"] = "approved"
    rec["ack_mode"] = "challenge_response"
    store.save(k, rec)
    print("  [approve:checklist] APPROVED (all three checks)")
    return True


def commit(store: Store, k: str) -> bool:
    data = store.all()
    rec = data[k]
    if rec["status"] == "committed":
        print(f"  [commit] idempotent: {k} already committed, no re-execute")
        return True
    if rec["status"] != "approved":
        print(f"  [commit] refusing: {k} status={rec['status']}")
        return False
    p = Proposal(
        thread_id=rec["thread_id"], action=rec["action"],
        payload=rec["payload"], intent=rec["intent"],
        lineage=rec["lineage"], blast_radius=rec["blast_radius"],
        rollback=rec["rollback"],
    )
    execute(p)
    rec["status"] = "committed"
    store.save(k, rec)
    print(f"  [commit] executed; verify={verify(p)}")
    return True


# ---------- Demos ----------

def main() -> None:
    print("=" * 80)
    print("PROPOSE-THEN-COMMIT HITL (Phase 15, Lesson 15)")
    print("=" * 80)
    tmp = tempfile.mkdtemp()
    store = Store(os.path.join(tmp, "proposals.json"))

    p = Proposal(
        thread_id="t-001",
        action="email.send",
        payload={"to": "team@example.com", "subject": "release"},
        intent="Announce the v1.2 release to the team list",
        lineage="Release notes page /releases/1.2",
        blast_radius="37 recipients; wrong send = external embarrassment",
        rollback="no in-band rollback; follow up with correction email",
    )

    print("\nDemo 1: clean approval flow (challenge-and-response)")
    print("-" * 80)
    k = propose(store, p)
    surface(store, k)
    checklist_approve(store, k, understood=True, verified=True, rollback_ready=True)
    commit(store, k)

    print("\nDemo 2: retry after approval; idempotency catches re-exec")
    print("-" * 80)
    initial = len(SIDE_EFFECTS)
    commit(store, k)  # retry
    commit(store, k)  # retry
    print(f"  total side effects after 2 retries: {len(SIDE_EFFECTS)} "
          f"(was {initial}) -> idempotent")

    print("\nDemo 3: rubber-stamp UI vs challenge-and-response")
    print("-" * 80)
    p2 = Proposal(
        thread_id="t-002", action="db.update",
        payload={"row": 42, "col": "status", "val": "closed"},
        intent="Close a stale issue",
        lineage="periodic scan of stale-issue dashboard",
        blast_radius="one DB row; reversible within 1h backup window",
        rollback="restore row from nightly backup",
    )
    k2 = propose(store, p2)
    rubber_stamp_approve(store, k2)
    commit(store, k2)

    p3 = Proposal(
        thread_id="t-003", action="db.drop_table",
        payload={"table": "old_users"},
        intent="Drop an unused table (per cleanup runbook)",
        lineage="runbook #RB-17",
        blast_radius="destructive; 420k rows dropped; not reversible within 24h",
        rollback="restore from weekly backup; data loss up to 6 days",
    )
    k3 = propose(store, p3)
    # Reviewer cannot tick rollback-ready; checklist_approve declines
    ok = checklist_approve(store, k3, understood=True, verified=True,
                           rollback_ready=False)
    # Pedagogical intent: call commit() on a rejected proposal so the
    # log demonstrates that commit() refuses when status is still
    # "waiting" rather than "approved". We WANT the refusal line to
    # print.
    if not ok:
        commit(store, k3)

    print()
    print("=" * 80)
    print("HEADLINE: make structured review the path of least resistance")
    print("-" * 80)
    print("  Idempotency keys prevent double-execution on retry.")
    print("  Durability lets approvals arrive two days late and still apply.")
    print("  Challenge-and-response checklist is the documented mitigation")
    print("  for rubber-stamp approval; EU AI Act Article 14 expects it.")
    print("  Post-commit verify closes the 'thought it happened' class.")


if __name__ == "__main__":
    main()
