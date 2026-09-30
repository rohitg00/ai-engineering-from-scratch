"""Call an injected transcriber with bounded retries.

Lesson: projects/voice-note-transcriber-pipeline/stages/03-transcribe/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import hashlib
from pcm import encode_wav


def transcribe(samples, rate, spans, provider, retries=1):
    if type(retries) is not int or retries < 0 or retries > 5:
        raise ValueError("nonnegative retries required")
    if type(rate) is not int or rate <= 0:
        raise ValueError("positive integer sample rate required")
    rows = []
    previous = 0
    for start, end in spans:
        if (
            type(start) is not int
            or type(end) is not int
            or not previous <= start < end <= len(samples)
        ):
            raise ValueError("invalid sample span")
        previous = end
        audio = encode_wav(samples[start:end], rate)
        for attempt in range(retries + 1):
            try:
                text = provider(audio)
                if not isinstance(text, str) or not text.strip():
                    raise ValueError("transcriber returned empty text")
                break
            except TimeoutError:
                if attempt == retries:
                    raise
        rows.append(
            {
                "start": start / rate,
                "end": end / rate,
                "text": text.strip(),
                "audio_sha256": hashlib.sha256(audio).hexdigest(),
                "attempts": attempt + 1,
            }
        )
    return rows
