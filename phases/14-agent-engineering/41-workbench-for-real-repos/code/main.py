"""sample app で同じ task を2回実行する: prompt-only vs workbench-guided。

両 pipeline は scripted (LLM なし) なので measurement は reproducible。
この file の隣に before-after-report.md と comparison.json を書く。

Run: python3 code/main.py
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path

HERE = Path(__file__).parent
SAMPLE = HERE / "sample_app"


SAMPLE_APP_PY = '''"""minimal signup handler。この exercise では production-ish として扱う。"""

USERS: dict[str, str] = {}


def signup(email: str, password: str) -> dict[str, object]:
    USERS[email] = password
    return {"status": 200, "email": email}
'''

SAMPLE_TEST_PY = '''from sample_app.app import signup


def test_signup_happy_path():
    out = signup("a@b.co", "longenough")
    assert out["status"] == 200
'''


@dataclass
class TaskOutcome:
    pipeline: str
    tests_actually_run: bool
    acceptance_met: bool
    files_outside_scope: list[str] = field(default_factory=list)
    handoff_quality: str = "missing"
    reviewer_total: int = 0


ALLOWED = {"sample_app/app.py", "sample_app/test_app.py"}
FORBIDDEN = {"sample_app/scripts/release.sh"}


def run_prompt_only() -> TaskOutcome:
    """いくつかの file を編集し、test は実行せず、done と主張する。"""
    touched = ["sample_app/app.py", "README.md", "sample_app/scripts/release.sh"]
    return TaskOutcome(
        pipeline="prompt-only",
        tests_actually_run=False,
        acceptance_met=False,
        files_outside_scope=[p for p in touched if p not in ALLOWED],
        handoff_quality="missing",
        reviewer_total=3,
    )


def run_workbench() -> TaskOutcome:
    """scope を読み、scope 内を編集し、feedback 経由で acceptance を実行し、gate、review、handoff する。"""
    touched = ["sample_app/app.py", "sample_app/test_app.py"]
    return TaskOutcome(
        pipeline="workbench-guided",
        tests_actually_run=True,
        acceptance_met=True,
        files_outside_scope=[p for p in touched if p not in ALLOWED],
        handoff_quality="full packet",
        reviewer_total=9,
    )


def write_report(po: TaskOutcome, wb: TaskOutcome) -> None:
    lines = [
        "# Before / After: real repo 上の Agent Workbench",
        "",
        "同じ task。同じ sample app。2つの pipeline。",
        "",
        "| Outcome | Prompt only | Workbench |",
        "|---------|-------------|-----------|",
        f"| tests_actually_run | {po.tests_actually_run} | {wb.tests_actually_run} |",
        f"| acceptance_met | {po.acceptance_met} | {wb.acceptance_met} |",
        f"| files_outside_scope | {len(po.files_outside_scope)} | {len(wb.files_outside_scope)} |",
        f"| handoff_quality | {po.handoff_quality} | {wb.handoff_quality} |",
        f"| reviewer_total (/10) | {po.reviewer_total} | {wb.reviewer_total} |",
        "",
        "## 読み取り",
        "",
        "Prompt only は scope 外に書き込み、acceptance command を実行せずに done と主張し、"
        "handoff を残さず、review score も低くなります。Workbench は書き込みを scope 内に保ち、"
        "feedback runner 経由で acceptance command を実行し、verification gate を通過し、"
        "次 session が startup で load する handoff packet を出荷します。",
    ]
    (HERE / "before-after-report.md").write_text("\n".join(lines) + "\n")


def write_sample() -> None:
    SAMPLE.mkdir(exist_ok=True)
    (SAMPLE / "app.py").write_text(SAMPLE_APP_PY)
    (SAMPLE / "test_app.py").write_text(SAMPLE_TEST_PY)
    (SAMPLE / "README.md").write_text("# sample app\n\nagent tasks の forbidden zone。\n")
    (SAMPLE / "scripts").mkdir(exist_ok=True)
    (SAMPLE / "scripts" / "release.sh").write_text("#!/usr/bin/env bash\necho release\n")


def main() -> None:
    write_sample()
    po = run_prompt_only()
    wb = run_workbench()

    for outcome in (po, wb):
        print(f"=== {outcome.pipeline} ===")
        for k, v in asdict(outcome).items():
            print(f"  {k}: {v}")
        print()

    write_report(po, wb)
    (HERE / "comparison.json").write_text(
        json.dumps({"prompt_only": asdict(po), "workbench": asdict(wb)}, indent=2) + "\n"
    )


if __name__ == "__main__":
    main()
