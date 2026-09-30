"""Check evidence before averaging scores.

Lesson: projects/report-judge/stages/02-support/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import re


def support(claim, source):
    raise NotImplementedError("Stage 2: implement support")


def judge_claim(claim, evidence, threshold=0.8):
    raise NotImplementedError("Stage 2: implement judge_claim")
