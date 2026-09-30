"""Export validated WebVTT captions.

Lesson: projects/voice-note-transcriber-pipeline/stages/04-captions/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import html


def stamp(seconds):
    raise NotImplementedError("Stage 4: implement stamp")


def captions(rows):
    raise NotImplementedError("Stage 4: implement captions")
