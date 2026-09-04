"""MIO-style four-modality tokenizer allocation + streaming decode latency calc.

Stdlib. Prints the vocab layout and a step-by-step latency trace for a
spoken-dialogue request where MIO consumes speech, generates speech.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class VocabSlot:
    name: str
    start: int
    size: int

    @property
    def end(self) -> int:
        return self.start + self.size


def build_vocab() -> list[VocabSlot]:
    slots = []
    cursor = 0
    plan = [
        ("text BPE",      32000),
        ("image SEED",     4096),
        ("speech L0",      4096),
        ("speech L1..L7", 4096),
        ("music",          8192),
        ("<image>",           1),
        ("</image>",          1),
        ("<speech>",          1),
        ("</speech>",         1),
        ("<music>",           1),
        ("</music>",          1),
    ]
    for name, size in plan:
        slots.append(VocabSlot(name=name, start=cursor, size=size))
        cursor += size
    return slots


def print_vocab(slots: list[VocabSlot]) -> None:
    print("\nSHARED VOCABULARY LAYOUT")
    print("-" * 60)
    print(f"  {'slot':<18}{'start':>8}{'end':>8}{'size':>8}")
    for s in slots:
        print(f"  {s.name:<18}{s.start:>8}{s.end:>8}{s.size:>8}")
    total = slots[-1].end
    print(f"  {'TOTAL':<18}{total:>8}{'(vocab size)':>16}")


def route_inputs(inputs: list[dict]) -> list[dict]:
    """Classify each input and assign a tokenizer path."""
    routed = []
    for inp in inputs:
        kind = inp["kind"]
        if kind == "text":
            path = "BPE"
        elif kind == "image":
            path = "SEED-Tokenizer"
        elif kind in ("speech", "voice"):
            path = "SpeechTokenizer residual-VQ"
        elif kind == "music":
            path = "Encodec"
        else:
            path = "UNKNOWN"
        routed.append({**inp, "path": path})
    return routed


@dataclass
class LatencyTrace:
    label: str
    ms: float


def streaming_decode_latency(
    prompt_audio_seconds: float = 2.0,
    model_size_b: int = 8,
) -> list[LatencyTrace]:
    trace = []
    trace.append(LatencyTrace("mic audio -> speech tokens",
                              prompt_audio_seconds * 20))
    trace.append(LatencyTrace("prefill prompt tokens",
                              80 * (model_size_b / 8.0)))
    trace.append(LatencyTrace("first output token",
                              40 * (model_size_b / 8.0)))
    trace.append(LatencyTrace("residual-VQ layers 1..7",
                              30))
    trace.append(LatencyTrace("speech decoder (Encodec-like)",
                              80))
    return trace


def print_trace(trace: list[LatencyTrace]) -> None:
    print("\nSTREAMING DECODE LATENCY (time-to-first-audio-byte)")
    print("-" * 60)
    total = 0.0
    for t in trace:
        total += t.ms
        print(f"  {t.label:<38}  +{t.ms:>5.0f} ms   (cumul {total:>6.0f})")
    print("-" * 60)
    print(f"  total TTFAB: {total:.0f} ms")
    if total < 500:
        print(f"  -> conversational feel (GPT-4o-class)")
    elif total < 800:
        print(f"  -> acceptable (first-gen open any-to-any)")
    else:
        print(f"  -> sluggish, consider smaller model or parallel decode")


def demo_chain_of_visual_thought() -> None:
    print("\nCHAIN-OF-VISUAL-THOUGHT (MIO)")
    print("-" * 60)
    prompt = "Is the cat climbing the tree in this photo?"
    steps = [
        "user text -> vision tokens",
        "model sketches intermediate image <image> ... </image>",
        "model emits text analysis of sketch",
        "model concludes with yes/no + justification",
    ]
    print(f"  prompt: {prompt}")
    for i, s in enumerate(steps, 1):
        print(f"    step {i}: {s}")
    print("  wins on spatial-reasoning benchmarks; hurts latency.")


def main() -> None:
    print("=" * 60)
    print("MIO ANY-TO-ANY STREAMING (Phase 12, Lesson 16)")
    print("=" * 60)

    vocab = build_vocab()
    print_vocab(vocab)

    print("\nROUTER: four inputs -> four tokenizers")
    print("-" * 60)
    inputs = [
        {"kind": "text",   "payload": "Hello"},
        {"kind": "image",  "payload": "cat.png"},
        {"kind": "voice",  "payload": "user.wav"},
        {"kind": "music",  "payload": "loop.mp3"},
    ]
    for r in route_inputs(inputs):
        print(f"  {r['kind']:<8}  '{r['payload']}'  -> {r['path']}")

    trace = streaming_decode_latency(prompt_audio_seconds=2.0, model_size_b=8)
    print_trace(trace)

    demo_chain_of_visual_thought()


if __name__ == "__main__":
    main()
