"""Call an injected transcriber with bounded retries.

Lesson: projects/voice-note-transcriber-pipeline/stages/03-transcribe/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import hashlib

from pcm import encode_wav


def transcribe(samples, rate, spans, provider, retries=1):
    raise NotImplementedError("Stage 3: implement transcribe")
