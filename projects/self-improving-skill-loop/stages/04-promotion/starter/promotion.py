"""Require a separate gate before promotion.

Lesson: projects/self-improving-skill-loop/stages/04-promotion/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import hashlib

import json

from skill import evaluate


def gate(holdout, baseline, candidate, min_gain=0.05):
    raise NotImplementedError("Stage 4: implement gate")
