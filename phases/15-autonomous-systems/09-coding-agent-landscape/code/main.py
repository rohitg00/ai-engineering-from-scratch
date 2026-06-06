"""CodeAct vs JSON tool-call scaffold comparison — stdlib Python.

Both scaffolds use the same stub "model" (deterministic rules) so the
comparison isolates the scaffold from model quality. Metrics:
  - tasks solved
  - turns used
  - per-action blast radius (number of files an action can touch)

The point is pedagogical: scaffolding is load-bearing. OpenHands
(arXiv:2407.16741) made the CodeAct bet explicitly; JSON tool calls
dominate managed services where the provider controls the executor.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field


# ---------- Mini-world: a tiny in-memory "repo" ----------

INITIAL_REPO = {
    "app.py": "def add(a, b):\n    return a - b\n",
    "util.py": "def lower(s):\n    return s.upper()\n",
    "cli.py": "VERSION = 'v0.0'\n",
}

TESTS = [
    ("app.py", "add(2, 3) == 5"),
    ("util.py", "lower('AB') == 'ab'"),
    ("cli.py", "VERSION == 'v1.0'"),
]

# Per-path replacement the stub "model" applies when a test fails.
# Centralizing the table avoids duplicating the if/elif chain across
# both scaffolds and avoids UnboundLocalError if TESTS later grows.
FIXES: dict[str, tuple[str, str]] = {
    "app.py": ("a - b", "a + b"),
    "util.py": ("s.upper()", "s.lower()"),
    "cli.py": ("v0.0", "v1.0"),
}


def run_tests(repo: dict[str, str]) -> list[bool]:
    """Deterministic stub: simulate the test suite against the repo string."""
    results = []
    for path, _expr in TESTS:
        src = repo.get(path, "")
        passed = False
        if path == "app.py":
            passed = "return a + b" in src
        elif path == "util.py":
            passed = "return s.lower()" in src
        elif path == "cli.py":
            passed = "VERSION = 'v1.0'" in src
        results.append(passed)
    return results


def _apply_fix(repo: dict[str, str], path: str) -> bool:
    """Apply the per-path fix in place. Returns True iff a fix was applied."""
    rule = FIXES.get(path)
    if rule is None:
        return False
    old, new = rule
    repo[path] = repo[path].replace(old, new)
    return True


# ---------- JSON tool-call scaffold: one action per turn ----------

@dataclass
class JsonScaffold:
    repo: dict[str, str] = field(default_factory=lambda: dict(INITIAL_REPO))
    turns: int = 0

    def step(self) -> str:
        """Return one JSON action at a time, based on current failing test."""
        self.turns += 1
        results = run_tests(self.repo)
        for (path, _), ok in zip(TESTS, results, strict=True):
            if ok:
                continue
            if _apply_fix(self.repo, path):
                return json.dumps({"tool": "edit", "path": path})
        return json.dumps({"tool": "done"})

    def blast_radius(self) -> int:
        return 1  # each action touches exactly one file

    def run(self, max_turns: int = 10) -> tuple[int, int]:
        for _ in range(max_turns):
            action = self.step()
            if json.loads(action).get("tool") == "done":
                break
        passed = sum(run_tests(self.repo))
        return passed, self.turns


# ---------- CodeAct scaffold: one snippet may touch many files ----------

@dataclass
class CodeActScaffold:
    repo: dict[str, str] = field(default_factory=lambda: dict(INITIAL_REPO))
    turns: int = 0
    # Track the observed max number of files touched by a single action.
    # This is more honest than a static upper bound of len(repo) because
    # it would not silently inflate if someone adds an untested helper.
    worst_touched: int = 0

    def step(self) -> str:
        """Return one Python snippet that may edit multiple files in one go."""
        self.turns += 1
        # A single "snippet" action rewrites every failing file at once.
        snippet_lines = []
        results = run_tests(self.repo)
        for (path, _), ok in zip(TESTS, results, strict=True):
            if ok:
                continue
            if _apply_fix(self.repo, path):
                snippet_lines.append(f"fs.write('{path}', ...)")
        self.worst_touched = max(self.worst_touched, len(snippet_lines))
        if not snippet_lines:
            return "done()"
        return "; ".join(snippet_lines)

    def blast_radius(self) -> int:
        # observed worst-case: files touched by a single action.
        return self.worst_touched

    def run(self, max_turns: int = 10) -> tuple[int, int]:
        for _ in range(max_turns):
            action = self.step()
            if action == "done()":
                break
        passed = sum(run_tests(self.repo))
        return passed, self.turns


# ---------- Driver ----------

def report(name: str, passed: int, turns: int, blast: int) -> None:
    total = len(TESTS)
    print(f"  {name:<18}  passed {passed}/{total}  turns {turns:>2}  "
          f"blast-radius {blast}")


def main() -> None:
    print("=" * 70)
    print("CODEACT vs JSON TOOL-CALL SCAFFOLDS (Phase 15, Lesson 9)")
    print("=" * 70)
    print()
    print("Same stub model, three-bug toy repo. Scaffold-only comparison.")
    print("-" * 70)

    js = JsonScaffold()
    passed, turns = js.run()
    report("JSON tool-call", passed, turns, js.blast_radius())

    ca = CodeActScaffold()
    passed, turns = ca.run()
    report("CodeAct (stub)", passed, turns, ca.blast_radius())

    print()
    print("=" * 70)
    print("HEADLINE: scaffolding is not scenery. It is the product.")
    print("-" * 70)
    print("  Same model, two scaffolds, different turn counts.")
    print("  CodeAct compresses multiple edits into one action.")
    print("  The cost is blast radius: CodeAct needs hardened sandbox")
    print("  isolation (OpenHands uses Docker). JSON tool-calls get safety")
    print("  by construction since every action is independently validated.")
    print("  Neither is strictly better; the trade-off is what to audit.")


if __name__ == "__main__":
    main()
