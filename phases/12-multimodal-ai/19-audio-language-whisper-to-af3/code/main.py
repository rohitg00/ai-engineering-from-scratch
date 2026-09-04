"""Audio-LLM toys: log-Mel spectrogram + audio Q-former + cascaded vs end-to-end.

Stdlib. Computes a naive DFT-based log-Mel spec from a synthetic waveform,
runs a toy Q-former over the resulting frames, and compares task coverage
between cascaded and end-to-end pipelines.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass

random.seed(6)


def synth_waveform(duration_s: float = 1.0, sr: int = 16000) -> list[float]:
    n = int(duration_s * sr)
    freq = 440
    return [0.5 * math.sin(2 * math.pi * freq * i / sr) +
            0.2 * math.sin(2 * math.pi * 880 * i / sr)
            for i in range(n)]


def window_frames(x: list[float], sr: int, win_ms: int = 25, hop_ms: int = 10) -> list[list[float]]:
    win = int(sr * win_ms / 1000)
    hop = int(sr * hop_ms / 1000)
    frames = []
    i = 0
    while i + win <= len(x):
        frames.append(x[i:i + win])
        i += hop
    return frames


def naive_dft_mag(frame: list[float], n_bins: int = 64) -> list[float]:
    """Compute magnitude spectrum at n_bins frequencies using naive DFT."""
    n = len(frame)
    out = []
    for k in range(n_bins):
        re = 0.0
        im = 0.0
        for i, x in enumerate(frame):
            angle = -2 * math.pi * k * i / n
            re += x * math.cos(angle)
            im += x * math.sin(angle)
        out.append(math.sqrt(re * re + im * im))
    return out


def mel_filterbank(n_bins: int = 64, n_mels: int = 20) -> list[list[float]]:
    """Triangular Mel filter bank (simplified, linear warp as proxy)."""
    fbank = []
    band = n_bins // n_mels
    for m in range(n_mels):
        row = [0.0] * n_bins
        start = m * band
        end = min(start + band, n_bins)
        for k in range(start, end):
            row[k] = 1.0 / (end - start)
        fbank.append(row)
    return fbank


def apply_mel(spec_mag: list[float], fbank: list[list[float]]) -> list[float]:
    return [sum(w * s for w, s in zip(row, spec_mag)) for row in fbank]


def log_compress(xs: list[float]) -> list[float]:
    return [math.log(1 + x) for x in xs]


def demo_melspec() -> None:
    print("\nLOG-MEL SPECTROGRAM (1s @ 16kHz, 25ms win, 10ms hop, 20 mel bins)")
    print("-" * 60)
    wave = synth_waveform(1.0, 16000)
    frames = window_frames(wave, 16000, 25, 10)
    print(f"  frames : {len(frames)} (should be ~99 at 1s)")

    spec = naive_dft_mag(frames[0], n_bins=64)
    fbank = mel_filterbank(n_bins=64, n_mels=20)
    mel = apply_mel(spec, fbank)
    log_mel = log_compress(mel)
    print(f"  per-frame mel dim: {len(mel)}")
    print(f"  first frame log-mel (rounded): "
          f"{[round(v, 2) for v in log_mel[:10]]}...")


@dataclass
class QFormer:
    n_queries: int
    hidden: int

    def __post_init__(self):
        self.queries = [[random.gauss(0, 0.1) for _ in range(self.hidden)]
                        for _ in range(self.n_queries)]

    def forward(self, frames: list[list[float]]) -> list[list[float]]:
        """Naive cross-attention: each query attends over all frames."""
        out = []
        for q in self.queries:
            scores = [sum(qi * fi for qi, fi in zip(q, f)) for f in frames]
            m = max(scores)
            exps = [math.exp(s - m) for s in scores]
            z = sum(exps)
            weights = [e / z for e in exps]
            agg = [sum(w * f[k] for w, f in zip(weights, frames))
                   for k in range(self.hidden)]
            out.append(agg)
        return out


def demo_qformer() -> None:
    print("\nAUDIO Q-FORMER (N=8 queries over 20-dim frames)")
    print("-" * 60)
    frames = [[random.gauss(0, 1) for _ in range(20)] for _ in range(99)]
    qf = QFormer(n_queries=8, hidden=20)
    tokens = qf.forward(frames)
    print(f"  input frames: {len(frames)}")
    print(f"  output tokens: {len(tokens)} of dim {len(tokens[0])}")
    print("  each token attends over the full audio by soft attention weights")


def task_coverage_table() -> None:
    print("\nCASCADED (Whisper -> LLM) vs END-TO-END AUDIO-LLM")
    print("-" * 60)
    tasks = [
        ("transcription",            "yes", "yes"),
        ("keyword extraction",       "yes", "yes"),
        ("summarization",            "yes", "yes"),
        ("speaker diarization",      "partial", "yes"),
        ("emotion inference",        "no",  "yes"),
        ("music genre classification","no", "yes"),
        ("instrument recognition",   "no",  "yes"),
        ("environmental sound ID",   "no",  "yes"),
        ("temporal event grounding", "partial", "yes"),
        ("deepfake detection",       "no",  "yes"),
    ]
    print(f"  {'task':<30}{'cascaded':<14}{'end-to-end'}")
    for name, cas, e2e in tasks:
        print(f"  {name:<30}{cas:<14}{e2e}")
    print("\n  cascaded: fast + reliable for text-extractable signals")
    print("  end-to-end: required for acoustic-only signals (~40% of MMAU)")


def main() -> None:
    print("=" * 60)
    print("AUDIO-LANGUAGE: WHISPER TO AF3 (Phase 12, Lesson 19)")
    print("=" * 60)

    demo_melspec()
    demo_qformer()
    task_coverage_table()

    print("\n2026 RECIPE")
    print("-" * 60)
    print("  encoder : AF-Whisper + BEATs concat")
    print("  bridge  : 64-query Q-former")
    print("  LLM     : Qwen2.5-7B with audio tokens")
    print("  training: AudioCaps + Clotho + MMAU-style instructions")
    print("  option  : on-demand thinking for complex reasoning")


if __name__ == "__main__":
    main()
