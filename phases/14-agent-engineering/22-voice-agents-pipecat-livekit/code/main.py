"""Toy Pipecat-style voice pipeline: VAD  STT  LLM  TTS  transport.

Frames travel DOWNSTREAM (source to sink) and UPSTREAM (cancel/control).
A scripted input shows normal flow plus a barge-in cancel that stops TTS.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable


@dataclass
class Frame:
    kind: str
    payload: Any
    direction: str = "downstream"


class Processor:
    def __init__(self, name: str) -> None:
        self.name = name
        self.next: Processor | None = None
        self.prev: Processor | None = None
        self.trace: list[str] = []

    def process(self, frame: Frame) -> None:
        self.trace.append(f"{self.name} saw {frame.kind}")
        if self.next is not None and frame.direction == "downstream":
            self.next.process(frame)
        elif self.prev is not None and frame.direction == "upstream":
            self.prev.process(frame)


class VAD(Processor):
    def process(self, frame: Frame) -> None:
        if frame.kind == "audio_chunk":
            is_speech = bool(frame.payload)
            self.trace.append(f"VAD: speech={is_speech}")
            if is_speech:
                super().process(Frame("vad_speech", frame.payload))
        else:
            super().process(frame)


class STT(Processor):
    def process(self, frame: Frame) -> None:
        if frame.kind == "vad_speech":
            transcript = str(frame.payload)
            self.trace.append(f"STT: -> {transcript!r}")
            super().process(Frame("transcript", transcript))
        else:
            super().process(frame)


class LLM(Processor):
    def __init__(self, name: str, replies: dict[str, str]) -> None:
        super().__init__(name)
        self.replies = replies

    def process(self, frame: Frame) -> None:
        if frame.kind == "cancel":
            self.trace.append("LLM: cancelled")
            super().process(frame)
            return
        if frame.kind == "transcript":
            text = str(frame.payload)
            reply = self.replies.get(text, "[no canned reply]")
            self.trace.append(f"LLM: {text!r}  -> {reply!r}")
            super().process(Frame("text", reply))
        else:
            super().process(frame)


class TTS(Processor):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.cancelled = False

    def process(self, frame: Frame) -> None:
        if frame.kind == "cancel":
            self.cancelled = True
            self.trace.append("TTS: cancel received; drop pending audio")
            super().process(frame)
            return
        if frame.kind == "text":
            self.cancelled = False
            words = str(frame.payload).split()
            emitted: list[str] = []
            for w in words:
                if self.cancelled:
                    self.trace.append(f"TTS: cut mid-word after {emitted}")
                    break
                emitted.append(w)
            self.trace.append(f"TTS: emitted {emitted}")
            super().process(Frame("tts_audio", emitted))
        else:
            super().process(frame)


class Transport(Processor):
    def __init__(self, name: str) -> None:
        super().__init__(name)
        self.delivered: list[list[str]] = []

    def process(self, frame: Frame) -> None:
        if frame.kind == "tts_audio":
            self.delivered.append(list(frame.payload))
            self.trace.append(f"transport: sent {len(frame.payload)} words")
        else:
            super().process(frame)


def link(*processors: Processor) -> None:
    for a, b in zip(processors, processors[1:]):
        a.next = b
        b.prev = a


def main() -> None:
    print("=" * 70)
    print("VOICE PIPELINE (PIPECAT-SHAPED) — Phase 14, Lesson 22")
    print("=" * 70)

    vad = VAD("vad")
    stt = STT("stt")
    llm = LLM("llm", replies={
        "hello": "hi there, how can I help today?",
        "refund please": (
            "sure, I can help with a refund; what order number should I look up?"
        ),
    })
    tts = TTS("tts")
    transport = Transport("transport")
    link(vad, stt, llm, tts, transport)

    print("\nscenario 1: normal flow")
    vad.process(Frame("audio_chunk", "hello"))
    print(f"  transport delivered: {transport.delivered[-1]}")

    print("\nscenario 2: barge-in mid-utterance")
    tts.cancelled = False
    vad.process(Frame("audio_chunk", "refund please"))
    transport.process(Frame("cancel", None, direction="upstream"))

    print("  trace across pipeline")
    for proc in (vad, stt, llm, tts, transport):
        for line in proc.trace:
            print(f"    {proc.name}: {line}")

    print()
    print("barge-in needs UPSTREAM cancel frames that propagate back to TTS+LLM.")
    print("sum latency per stage; premium stack lands at 450-600ms end-to-end.")


if __name__ == "__main__":
    main()
