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

O0 = main.ElfFile.from_path(main.FIXTURES / "ledger-x86_64-O0.o")
O1 = main.ElfFile.from_path(main.FIXTURES / "ledger-x86_64-O1.o")
RODATA = O1.section_bytes(O1.section(".rodata"))

TASKS = [
    ("t1", "e_shoff of ledger-x86_64-O1.o, as a number", lambda: O1.header.e_shoff),
    ("t2", "st_size of percent_change in ledger-x86_64-O1.o", lambda: O1.symbol("percent_change").st_size),
    ("t3", "file offset of .text in ledger-x86_64-O1.o, as hex", lambda: hex(O1.section(".text").sh_offset)),
    ("t4", "relocation type names in ledger-x86_64-O0.o, sorted, as a list", lambda: sorted({r.type_name for r in O0.relocations})),
    ("t5", "the five int values at .rodata+0x14 in ledger-x86_64-O1.o, as a list", lambda: [int.from_bytes(RODATA[i : i + 4], "little") for i in range(0x14, 0x28, 4)])
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
