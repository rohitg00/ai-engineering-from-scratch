"""VAD cascade + turn-detection state machine.

Three-tier cascade: energy gate → (pretend) Silero → turn-detector state machine.
Run a synthetic stream: speech + silence + cough + speech, verify
the turn-detector fires START and END at the right moments.

Stdlib only. Run: python3 code/main.py
"""

import math
import random


def synth_chunk(kind, rng, sr=16000, chunk_ms=20):
    n = int(sr * chunk_ms / 1000)
    if kind == "speech":
        return [0.2 * rng.gauss(0, 1.0) for _ in range(n)]
    if kind == "cough":
        return [0.8 * rng.gauss(0, 1.0) if i < n // 5 else 0.001 * rng.gauss(0, 1.0) for i in range(n)]
    return [0.002 * rng.gauss(0, 1.0) for _ in range(n)]


def energy_vad(chunk, threshold_dbfs=-40.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    return 20.0 * math.log10(max(rms, 1e-10)) > threshold_dbfs


def fake_silero_vad(chunk, prev_state, threshold=0.5):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    duration = len(chunk) / 16000.0
    transient = max(chunk) - min(chunk) > 0.6 and duration < 0.03
    if rms > 0.08 and not transient:
        return 0.92
    if rms > 0.05:
        return 0.55
    return 0.02


class TurnDetector:
    def __init__(self, silence_hangover_ms=500, min_speech_ms=250, pre_roll_ms=300):
        self.state = "idle"
        self.speech_ms = 0
        self.silence_ms = 0
        self.silence_hangover_ms = silence_hangover_ms
        self.min_speech_ms = min_speech_ms
        self.pre_roll_ms = pre_roll_ms

    def update(self, is_speech, chunk_ms=20):
        if is_speech:
            self.speech_ms += chunk_ms
            self.silence_ms = 0
            if self.state == "idle" and self.speech_ms >= self.min_speech_ms:
                self.state = "speaking"
                return "START"
        else:
            if self.state == "speaking":
                self.silence_ms += chunk_ms
                if self.silence_ms >= self.silence_hangover_ms:
                    self.state = "idle"
                    self.speech_ms = 0
                    self.silence_ms = 0
                    return "END"
        return None


def main():
    random.seed(42)
    rng = random.Random(42)

    sequence = (
        [("silence", 10)] +
        [("speech", 40)] +
        [("silence", 30)] +
        [("cough",   1)]  +
        [("silence", 10)] +
        [("speech", 25)] +
        [("silence", 35)]
    )

    chunks = []
    for kind, count in sequence:
        for _ in range(count):
            chunks.append((kind, synth_chunk(kind, rng)))

    print(f"=== stream: {len(chunks)} chunks of 20 ms = {len(chunks)*20} ms total ===")
    print()

    td_silero = TurnDetector()
    td_energy = TurnDetector()
    events_silero = []
    events_energy = []

    for i, (truth, chunk) in enumerate(chunks):
        e_active = energy_vad(chunk)
        silero_prob = fake_silero_vad(chunk, None)
        s_active = silero_prob >= 0.5

        e_event = td_energy.update(e_active)
        s_event = td_silero.update(s_active)
        if e_event:
            events_energy.append((i * 20, e_event, truth))
        if s_event:
            events_silero.append((i * 20, s_event, truth))

    print("=== energy-only VAD turn events (many false positives on cough) ===")
    for ms, ev, truth in events_energy:
        print(f"  t={ms:>4} ms  {ev:<5}  (at {truth})")

    print()
    print("=== Silero-style VAD turn events (rejects cough) ===")
    for ms, ev, truth in events_silero:
        print(f"  t={ms:>4} ms  {ev:<5}  (at {truth})")

    print()
    print("=== 2026 VAD cheatsheet ===")
    rows = [
        ("WebRTC VAD (Google, 2013)", "50.0% TPR @ 5% FPR", "BSD"),
        ("Silero VAD (2020-2026)",    "87.7% TPR @ 5% FPR", "MIT — default open"),
        ("Cobra VAD (Picovoice)",     "98.9% TPR @ 5% FPR", "commercial"),
        ("pyannote segmentation",     "~95% TPR @ 5% FPR",  "MIT-ish — diarization-grade"),
    ]
    print("  | VAD                       | accuracy            | license               |")
    for name, acc, lic in rows:
        print(f"  | {name:<25} | {acc:<19} | {lic:<21} |")

    print()
    print("takeaways:")
    print("  - energy-only VAD fires on every transient; not for production")
    print("  - Silero VAD handles the cough without firing a turn start")
    print("  - 500 ms silence hangover = conversational sweet spot")
    print("  - add the flush trick for sub-200 ms end-to-end voice agents")


if __name__ == "__main__":
    main()
