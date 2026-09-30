"""Segment speech candidates with RMS energy.

Lesson: projects/voice-note-transcriber-pipeline/stages/02-activity/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import math


def activity(samples, rate, frame_ms=20, threshold=0.02, min_ms=40, gap_ms=40):
    raise NotImplementedError("Stage 2: implement activity")
