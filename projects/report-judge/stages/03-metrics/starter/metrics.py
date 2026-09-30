"""Report precision coverage and source recall.

Lesson: projects/report-judge/stages/03-metrics/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

from claims import parse_claims

from support import judge_claim


def score_report(text, evidence, expected_sources=(), facts=()):
    raise NotImplementedError("Stage 3: implement score_report")
