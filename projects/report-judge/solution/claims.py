"""Parse claims and citation references.

Lesson: projects/report-judge/stages/01-claims/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import re


def parse_claims(text):
    rows = []
    for line in text.splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        for sentence in re.split(r"(?<=\.)\s+", line.strip()):
            cites = re.findall(r"\[([A-Za-z][A-Za-z0-9_-]*)\]", sentence)
            claim = (
                re.sub(r"\[[A-Za-z][A-Za-z0-9_-]*\]", "", sentence).strip().rstrip(".")
            )
            if claim:
                rows.append({"text": claim, "cites": list(dict.fromkeys(cites))})
    return rows
