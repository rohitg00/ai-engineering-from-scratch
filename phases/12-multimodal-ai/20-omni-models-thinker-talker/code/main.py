"""Thinker-Talker streaming pipeline — TTFAB calculator + VAD turn-taking.

Stdlib. No audio processing; focus on the latency budget and concurrency of
parallel streaming between Thinker (text) and Talker (speech).
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class StreamConfig:
    thinker_b: int
    talker_m: int
    mic_sr: int = 16000
    include_vision: bool = False


@dataclass
class LatencyComponent:
    name: str
    ms: float


def ttfab(cfg: StreamConfig) -> list[LatencyComponent]:
    components = []
    mic_ms = 40 + (cfg.mic_sr // 8000) * 5
    components.append(LatencyComponent("mic -> speech tokens", mic_ms))

    prefill = 100 * (cfg.thinker_b / 7.0)
    if cfg.include_vision:
        prefill += 80
    components.append(LatencyComponent("Thinker prefill (prompt + history)", prefill))

    first_text = 40 * (cfg.thinker_b / 7.0)
    components.append(LatencyComponent("Thinker first text token", first_text))

    talker_first = max(15, 20 * (cfg.talker_m / 300.0))
    components.append(LatencyComponent("Talker first speech tokens", talker_first))

    rvq_decode = 30
    components.append(LatencyComponent("residual-VQ decode (8 layers parallel)", rvq_decode))

    wave_decode = 70
    components.append(LatencyComponent("waveform decoder (SNAC-class)", wave_decode))
    return components


def print_ttfab(cfg: StreamConfig) -> float:
    print(f"\nCONFIG: Thinker={cfg.thinker_b}B  Talker={cfg.talker_m}M  "
          f"mic={cfg.mic_sr}Hz  vision={cfg.include_vision}")
    print("-" * 60)
    total = 0.0
    for c in ttfab(cfg):
        total += c.ms
        print(f"  {c.name:<40}  +{c.ms:>5.0f} ms  ({total:>6.0f})")
    print(f"  TTFAB = {total:.0f} ms", end=" ")
    if total < 250:
        print("  -> GPT-4o class")
    elif total < 400:
        print("  -> conversational")
    elif total < 700:
        print("  -> noticeable but usable")
    else:
        print("  -> sluggish, user drift")
    return total


@dataclass
class VADEvent:
    time_ms: float
    kind: str


def simulate_turn_taking(silence_threshold_ms: int = 200) -> list[VADEvent]:
    """Simulate a user turn ending detected by silence."""
    events = []
    events.append(VADEvent(0, "user starts speaking"))
    events.append(VADEvent(450, "user audio tokens streaming"))
    events.append(VADEvent(3800, "user stops speaking"))
    events.append(VADEvent(3800 + silence_threshold_ms, "VAD triggers end-of-turn"))
    events.append(VADEvent(3800 + silence_threshold_ms + 200, "Thinker begins prefill"))
    events.append(VADEvent(3800 + silence_threshold_ms + 400, "Talker first audio out"))
    return events


def demo_vad() -> None:
    print("\nHALF-DUPLEX TURN-TAKING (VAD silence 200ms)")
    print("-" * 60)
    for e in simulate_turn_taking(200):
        print(f"  t={e.time_ms:>6.0f} ms  {e.kind}")
    print("  net response lag after user stops: ~400ms")


def duplex_modes() -> None:
    print("\nDUPLEX MODES")
    print("-" * 60)
    modes = [
        ("half-duplex",  "user speaks, model listens; swap; clear turns"),
        ("turn-taking",  "VAD silence detects end-of-turn (200-400ms)"),
        ("full-duplex",  "both can speak; requires training + backchannel data"),
    ]
    for mode, note in modes:
        print(f"  {mode:<14}: {note}")


def main() -> None:
    print("=" * 60)
    print("OMNI THINKER-TALKER STREAMING (Phase 12, Lesson 20)")
    print("=" * 60)

    configs = [
        StreamConfig(thinker_b=7,  talker_m=200,  include_vision=False),
        StreamConfig(thinker_b=7,  talker_m=300,  include_vision=True),
        StreamConfig(thinker_b=72, talker_m=300,  include_vision=True),
        StreamConfig(thinker_b=70, talker_m=1000, include_vision=True),
    ]
    for c in configs:
        print_ttfab(c)

    demo_vad()
    duplex_modes()

    print("\nOPEN STREAMING DESIGNS")
    print("-" * 60)
    designs = [
        ("Mini-Omni (2024)",  "first open streaming, text+speech interleaved"),
        ("Moshi (2024)",      "single transformer inner-monologue, 160ms TTFAB"),
        ("Qwen2.5-Omni (3/25)", "Thinker-Talker split + TMRoPE, ~350ms TTFAB"),
        ("Qwen3-Omni (11/25)", "scaled Qwen3 base, approaches GPT-4o latency"),
    ]
    for name, note in designs:
        print(f"  {name:<22}: {note}")


if __name__ == "__main__":
    main()
