"""Segment speech candidates with RMS energy.

Lesson: projects/voice-note-transcriber-pipeline/stages/02-activity/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import math


def activity(samples, rate, frame_ms=20, threshold=0.02, min_ms=40, gap_ms=40):
    if any(
        not isinstance(value, (int, float)) or not math.isfinite(value)
        for value in (rate, frame_ms, threshold, min_ms, gap_ms)
    ) or any(
        not isinstance(value, (int, float)) or not math.isfinite(value)
        for value in samples
    ):
        raise ValueError("finite audio and parameters required")
    if rate <= 0 or frame_ms <= 0 or threshold < 0 or min_ms < 0 or gap_ms < 0:
        raise ValueError("invalid activity parameters")
    width = max(1, round(rate * frame_ms / 1000))
    active = []
    for start in range(0, len(samples), width):
        frame = samples[start : start + width]
        if math.sqrt(sum(x * x for x in frame) / len(frame)) >= threshold:
            active.append((start, start + len(frame)))
    spans = []
    for start, end in active:
        if spans and start - spans[-1][1] <= rate * gap_ms / 1000:
            spans[-1] = (spans[-1][0], end)
        else:
            spans.append((start, end))
    return [(a, b) for a, b in spans if (b - a) * 1000 / rate >= min_ms]
