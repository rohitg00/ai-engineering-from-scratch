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

O1 = main.read_object(main.FIXTURES / "ledger-x86_64-O1.o")
PERCENT = main.lift_function(O1, "percent_change")
TOTAL = main.lift_function(O1, "total")

TASKS = [
    ("t1", "parameters that the calling convention gives percent_change at -O1", lambda: len(PERCENT.function.params)),
    ("t2", "phi functions in the SSA form of total at -O1", lambda: sum(1 for line in TOTAL.ssa_text.splitlines() if "= phi(" in line)),
    ("t3", "the divisor that magic_divisor finds for 0x66666667 with shift 34", lambda: main.magic_divisor(0x66666667, 34)),
    ("t4", "the last statement of the percent_change pseudocode at -O1, as one line of text", lambda: [line.strip() for line in PERCENT.pseudocode.splitlines() if line.strip().startswith("return")][-1]),
    ("t5", "the recovered C type of param_1 of total at -O1", lambda: TOTAL.function.web_types["param_1"])
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
