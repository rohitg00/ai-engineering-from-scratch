"""Decode and validate PCM WAV samples.

Lesson: projects/voice-note-transcriber-pipeline/stages/01-pcm/docs/en.md
The implementation is original and uses explicit local data contracts.
Run its tests through scripts/project_test.py.
"""

import io

import struct

import wave


def decode_wav(data):
    raise NotImplementedError("Stage 1: implement decode_wav")


def encode_wav(samples, rate=16000):
    raise NotImplementedError("Stage 1: implement encode_wav")
