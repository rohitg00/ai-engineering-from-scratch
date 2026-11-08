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

O0 = main.load_fixture("ledger-x86_64-O0.o")
O1 = main.load_fixture("ledger-x86_64-O1.o")
TRAP = main.load_fixture("sweep-trap.o")

TASKS = [
    ("t1", "instructions that recursive descent decodes in grade at -O1", lambda: len(main.analyze_function(O1, "grade").descent.instructions)),
    ("t2", "basic blocks in total at -O1", lambda: len(main.analyze_function(O1, "total").cfg.blocks)),
    ("t3", "address of the loop header in total at -O1, as hex", lambda: hex(main.analyze_function(O1, "total").cfg.back_edges()[0][1])),
    ("t4", "in sweep-trap.o, the address where the linear sweep instruction that covers 0x14 starts, as hex", lambda: hex(main.analyze_function(TRAP, "lookup").sweep.covering(0x14).address)),
    ("t5", "entries in the jump table of grade at -O0", lambda: len(next(iter(main.analyze_function(O0, "grade").descent.resolved_tables.values())).targets))
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
