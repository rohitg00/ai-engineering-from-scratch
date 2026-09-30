from pathlib import Path
import json, subprocess, tempfile, sys, shutil

root = Path(__file__).resolve().parent
examples = root.parent / "examples"
from metrics import score_report
from compare import compare

case = json.loads((examples / "claims.json").read_text())
print(
    json.dumps(
        {
            "empty": score_report("", {}),
            "audit": score_report(
                case["text"],
                case["evidence"],
                case.get("expected_sources", []),
                case.get("facts", []),
            ),
            "paired_change": compare(
                {"q1": 80, "q2": 70, "q3": 90}, {"q1": 85, "q2": 75, "q3": 60}
            ),
        },
        indent=2,
    )
)
