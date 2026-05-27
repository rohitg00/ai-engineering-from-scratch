"""Kill switch + circuit breaker + canary simulator — stdlib Python.

Three detectors:
  1. kill switch: boolean outside the agent; checked every turn
  2. circuit breaker: opens on N identical tool calls in a row
  3. canary token: fake credential whose read triggers an alert

Trajectory exercises each detector. Classifier + budget layers from
Lessons 10 and 13 are orthogonal; this lesson is about the tripwires.
"""

from __future__ import annotations

from dataclasses import dataclass, field


# ---------- External state (agent cannot write) ----------

EXTERNAL_KILL_SWITCH = {"enabled": False}


# Canary tokens seeded into the workspace.
CANARY_FILES = {
    "~/.env.canary": "AWS_SECRET_ACCESS_KEY=canary-xxxxxxxxxxxxxxxx",
    "~/notes/fake-credentials.txt": "token = 'canary-sk-ABC-NEVER-USE'",
}


# ---------- Circuit breaker ----------

@dataclass
class CircuitBreaker:
    threshold: int = 5
    state: str = "closed"   # closed | open | half_open
    recent: list[str] = field(default_factory=list)

    def record(self, action_key: str) -> bool:
        """Return True if the action may proceed, False if breaker is open."""
        if self.state == "open":
            return False
        self.recent.append(action_key)
        if len(self.recent) >= self.threshold:
            tail = self.recent[-self.threshold:]
            if all(a == tail[0] for a in tail):
                self.state = "open"
                return False
        return True


# ---------- Canary detector ----------

@dataclass
class Canary:
    triggered: list[tuple[int, str]] = field(default_factory=list)

    def check_read(self, turn: int, path: str) -> bool:
        if path in CANARY_FILES:
            self.triggered.append((turn, path))
            return True
        return False


# ---------- Run the trajectory ----------

@dataclass
class Action:
    kind: str    # "tool" | "read"
    payload: str


def run_trajectory(traj: list[Action], kill_switch: dict) -> None:
    breaker = CircuitBreaker(threshold=5)
    canary = Canary()
    kill_fired = False
    breaker_fired = False

    for i, a in enumerate(traj, 1):
        # Detector 1: kill switch
        if kill_switch["enabled"]:
            print(f"  {i:>2}. [KILL SWITCH engaged] refusing action {a.kind}:{a.payload}")
            kill_fired = True
            break

        # Detector 2: circuit breaker
        allowed = breaker.record(f"{a.kind}:{a.payload}")
        if not allowed:
            print(f"  {i:>2}. [CIRCUIT BREAKER open] {a.kind}:{a.payload}  "
                  f"reason=5x identical calls")
            breaker_fired = True
            break

        # Detector 3: canary
        if a.kind == "read":
            hit = canary.check_read(i, a.payload)
            if hit:
                print(f"  {i:>2}. [CANARY TRIPPED] read of {a.payload!r}  "
                      f"-> alert fired")
                continue

        print(f"  {i:>2}. ok  {a.kind}:{a.payload}")

    print(f"  summary: kill_fired={kill_fired}  breaker_fired={breaker_fired}  "
          f"canary_hits={len(canary.triggered)}")


def main() -> None:
    print("=" * 80)
    print("TRIPWIRES: KILL SWITCH, CIRCUIT BREAKER, CANARY (Phase 15, Lesson 14)")
    print("=" * 80)

    traj = [
        Action("tool", "read:src/app.py"),
        Action("tool", "edit:src/app.py"),
        Action("tool", "read:logs/app.log"),   # start identical-read burst
        Action("tool", "read:logs/app.log"),
        Action("tool", "read:logs/app.log"),
        Action("tool", "read:logs/app.log"),
        Action("tool", "read:logs/app.log"),   # 5th identical -> breaker
        Action("read", "~/notes/checklist.md"),
        Action("read", "~/.env.canary"),       # canary hit
    ]

    print("\nKill switch OFF")
    print("-" * 80)
    run_trajectory(traj, EXTERNAL_KILL_SWITCH)

    print("\nKill switch ON (operator flipped it externally)")
    print("-" * 80)
    EXTERNAL_KILL_SWITCH["enabled"] = True
    run_trajectory(traj, EXTERNAL_KILL_SWITCH)
    EXTERNAL_KILL_SWITCH["enabled"] = False

    print()
    print("=" * 80)
    print("HEADLINE: three detectors, three different failure classes")
    print("-" * 80)
    print("  Kill switch stops the whole agent on operator action.")
    print("  Circuit breaker pauses a specific pattern, not the whole agent.")
    print("  Canary tokens detect intent without requiring detection of content.")
    print("  None of these catches a semantic composite attack (see Lesson 10).")
    print("  Hard constitutional limits complete the defense (Lesson 17).")


if __name__ == "__main__":
    main()
