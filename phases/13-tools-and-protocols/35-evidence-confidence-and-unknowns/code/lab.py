"""Graded lab for docs/en.md: five questions about the fixtures of this lesson.
The expected values come from main.py run on the committed files in fixtures/.
Write answers into lab_answers.json, then run `python3 lab.py` from this folder
or `python3 code/lab.py` from the lesson folder. It exits 0 when all five pass.
"""
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import main

ANSWERS = HERE / "lab_answers.json"

GRADE = json.loads((main.FIXTURES / "rea-evidence-grade.json").read_text(encoding="utf-8"))

TASKS = [
    ("t1", "the evidence id that compute_evidence_id gives for rea-evidence-grade.json", lambda: main.compute_evidence_id(GRADE)),
    ("t2", "the number of limitations in the grade record", lambda: len(GRADE["limitations"])),
    ("t3", "the relationship_coverage status of the grade record", lambda: GRADE["relationship_coverage"]["status"]),
    ("t4", "the confidence and the authority of the grade record, as a list of two strings", lambda: [GRADE["confidence"], GRADE["authority"]]),
    ("t5", "the SHA-256 of the subject of the grade record", lambda: GRADE["subject"]["digest"]["sha256"])
]


def normal(value):
    if isinstance(value, bool):
        return ("bool", value)
    if isinstance(value, str):
        text = value.strip()
        if re.fullmatch(r"0x[0-9a-fA-F]+", text):
            return int(text, 16)
        return text
    if isinstance(value, (list, tuple)):
        return [normal(item) for item in value]
    return value


def expected():
    return {key: compute() for key, _, compute in TASKS}


def grade(answers):
    want = expected()
    rows = []
    for key, question, _ in TASKS:
        given = answers.get(key)
        if given is None:
            rows.append((key, question, "TODO"))
        else:
            rows.append((key, question, "PASS" if normal(given) == normal(want[key]) else "FAIL"))
    return rows


def run(argv):
    path = Path(argv[0]) if argv else ANSWERS
    answers = json.loads(path.read_text(encoding="utf-8"))
    rows = grade(answers)
    for key, question, status in rows:
        print(f"{status:4}  {key}  {question}")
    passed = sum(1 for row in rows if row[2] == "PASS")
    print(f"score: {passed}/{len(rows)}")
    return 0 if passed == len(rows) else 1


if __name__ == "__main__":
    raise SystemExit(run(sys.argv[1:]))
