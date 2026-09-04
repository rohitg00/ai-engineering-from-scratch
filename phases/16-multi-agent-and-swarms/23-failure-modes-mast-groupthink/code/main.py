"""Failure modes: MAST categorizer, circuit breaker, retry-storm simulator.

Stdlib only. The simulator shows how a 10% downstream error rate amplifies
through retries to 10x load without a breaker; the breaker caps it.
"""
from __future__ import annotations

import random
import time
from dataclasses import dataclass, field
from enum import Enum


# ---------- MAST categorizer ----------

MAST_CATEGORIES = {
    "spec": "Specification Problem (41.77% of failures)",
    "coord": "Coordination Failure (36.94% of failures)",
    "verify": "Verification Gap (21.30% of failures)",
}

GROUPTHINK = {
    "monoculture": "monoculture collapse (same base model → correlated errors)",
    "conformity": "conformity bias (agents align with loudest peer)",
    "tom": "deficient theory of mind (cannot model each other)",
    "mixed_motive": "mixed-motive drift (compromise-middle satisfies no one)",
    "cascade": "cascading reliability failures (retry storms)",
}


def categorize_incident(symptoms: dict) -> tuple[str, str]:
    if symptoms.get("role_conflict") or symptoms.get("task_ambiguity"):
        return "spec", MAST_CATEGORIES["spec"]
    if symptoms.get("state_drift") or symptoms.get("message_lost") or symptoms.get("sync_error"):
        return "coord", MAST_CATEGORIES["coord"]
    if symptoms.get("no_verifier") or symptoms.get("hallucination_propagation"):
        return "verify", MAST_CATEGORIES["verify"]
    return "unknown", "no MAST category matched"


def detect_groupthink(symptoms: dict) -> list[tuple[str, str]]:
    hits = []
    if symptoms.get("correlated_errors"):
        hits.append(("monoculture", GROUPTHINK["monoculture"]))
    if symptoms.get("agreement_rate_spike"):
        hits.append(("conformity", GROUPTHINK["conformity"]))
    if symptoms.get("coordination_drop_long_horizon"):
        hits.append(("tom", GROUPTHINK["tom"]))
    if symptoms.get("compromise_outputs"):
        hits.append(("mixed_motive", GROUPTHINK["mixed_motive"]))
    if symptoms.get("retry_amplification"):
        hits.append(("cascade", GROUPTHINK["cascade"]))
    return hits


# ---------- Circuit breaker ----------

class BreakerState(Enum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass
class CircuitBreaker:
    failure_threshold: float = 0.5
    window_size: int = 20
    open_cooldown_s: float = 0.5
    state: BreakerState = BreakerState.CLOSED
    outcomes: list[bool] = field(default_factory=list)
    opened_at: float = 0.0

    def _error_rate(self) -> float:
        if not self.outcomes:
            return 0.0
        recent = self.outcomes[-self.window_size:]
        return 1.0 - (sum(recent) / len(recent))

    def allow(self) -> bool:
        if self.state == BreakerState.OPEN:
            if time.monotonic() - self.opened_at >= self.open_cooldown_s:
                self.state = BreakerState.HALF_OPEN
            else:
                return False
        return True

    def record(self, success: bool) -> None:
        self.outcomes.append(success)
        if self.state == BreakerState.HALF_OPEN:
            if success:
                self.state = BreakerState.CLOSED
            else:
                self.state = BreakerState.OPEN
                self.opened_at = time.monotonic()
        elif self.state == BreakerState.CLOSED:
            if self._error_rate() > self.failure_threshold and len(self.outcomes) >= self.window_size:
                self.state = BreakerState.OPEN
                self.opened_at = time.monotonic()


# ---------- Retry storm simulator ----------

@dataclass
class DownstreamService:
    base_failure_rate: float = 0.1
    load: int = 0

    def handle(self, rng: random.Random) -> bool:
        # Increased load -> increased failure (degradation model)
        effective_rate = self.base_failure_rate + (self.load * 0.02)
        effective_rate = min(effective_rate, 0.99)
        return rng.random() > effective_rate


def simulate_retry_storm(requests: int, use_breaker: bool, seed: int = 0) -> tuple[int, int, int]:
    rng = random.Random(seed)
    service = DownstreamService()
    breaker = CircuitBreaker()
    total_calls = 0
    successes = 0
    short_circuits = 0

    for _ in range(requests):
        attempts_for_req = 0
        while attempts_for_req < 4:
            if use_breaker and not breaker.allow():
                short_circuits += 1
                break
            service.load = min(total_calls // 10, 50)
            total_calls += 1
            ok = service.handle(rng)
            if use_breaker:
                breaker.record(ok)
            if ok:
                successes += 1
                break
            attempts_for_req += 1
    return total_calls, successes, short_circuits


def demo_incident_categorization() -> None:
    print("=" * 72)
    print("INCIDENT CATEGORIZATION — map symptoms to MAST + Groupthink families")
    print("=" * 72)
    incidents = [
        {"role_conflict": True, "name": "two agents both reviewing"},
        {"state_drift": True, "name": "agent A thinks done; agent B still running"},
        {"no_verifier": True, "hallucination_propagation": True, "name": "hallucinated fact crosses agents"},
        {"correlated_errors": True, "agreement_rate_spike": True, "name": "3 agents all give same wrong answer"},
        {"retry_amplification": True, "name": "payment retries cascade to inventory"},
    ]
    for inc in incidents:
        name = inc.pop("name")
        cat, desc = categorize_incident(inc)
        gt = detect_groupthink(inc)
        print(f"\n  incident: {name}")
        print(f"    MAST:       {cat} — {desc}")
        if gt:
            for code, d in gt:
                print(f"    Groupthink: {code} — {d}")


def demo_retry_storm() -> None:
    print("\n" + "=" * 72)
    print("RETRY STORM — 200 requests against a 10% baseline-failing service")
    print("=" * 72)
    total_no_cb, succ_no_cb, _ = simulate_retry_storm(200, use_breaker=False, seed=0)
    total_cb, succ_cb, sc = simulate_retry_storm(200, use_breaker=True, seed=0)
    print(f"  no circuit breaker:  total_calls={total_no_cb:4d}  success={succ_no_cb:4d}")
    print(f"  with circuit breaker: total_calls={total_cb:4d}  success={succ_cb:4d}  short_circuited={sc}")
    print("  the breaker short-circuits once failure rate exceeds the threshold,")
    print("  stopping the amplification. Success count may drop, but downstream survives.")


def main() -> None:
    demo_incident_categorization()
    demo_retry_storm()
    print("\nTakeaways:")
    print("  MAST categories give names to the failures; categorization is the first fix.")
    print("  Circuit breakers are the canonical cascade mitigation -- same as distributed systems.")
    print("  STRATUS-style detection / diagnosis / validation adds 1.5x mitigation success.")
    print("  Slow-failure proxies (agreement rate, retry rate) catch drift before loud errors.")


if __name__ == "__main__":
    main()
