"""Whisper pipeline in pure stdlib — framing, per-frame energy, task prompt.

Full log-mel spectrogram requires FFT. For pedagogy we show the framing
shape (which is all the transformer ever sees) plus the task-token prefix
that controls Whisper's behavior.
"""

import math


SAMPLE_RATE = 16000
FRAME_SIZE = 400   # 25 ms at 16 kHz
HOP = 160          # 10 ms at 16 kHz
MAX_SECONDS = 30
TARGET_FRAMES = 3000  # 30 s / 10 ms


def sine_wave(freq, duration_s, sr=SAMPLE_RATE):
    n = int(duration_s * sr)
    return [math.sin(2 * math.pi * freq * i / sr) for i in range(n)]


def frame_signal(x, frame_size=FRAME_SIZE, hop=HOP):
    frames = []
    for start in range(0, len(x) - frame_size + 1, hop):
        frames.append(x[start:start + frame_size])
    return frames


def frame_energy(frame):
    """Sum-of-squares energy, log-scaled. Stand-in for mel power."""
    e = sum(v * v for v in frame)
    return math.log(e + 1e-9)


def pad_or_clip(frames, target):
    if len(frames) >= target:
        return frames[:target]
    pad_frame = [0.0] * len(frames[0]) if frames else [0.0] * FRAME_SIZE
    return frames + [pad_frame] * (target - len(frames))


def whisper_prompt(lang="en", task="transcribe", timestamps=True):
    tokens = ["<|startoftranscript|>", f"<|{lang}|>", f"<|{task}|>"]
    if not timestamps:
        tokens.append("<|notimestamps|>")
    return tokens


def main():
    print("=== Whisper preprocessing pipeline ===")
    print(f"target: {MAX_SECONDS}s audio at {SAMPLE_RATE} Hz")
    print(f"frame:  {FRAME_SIZE} samples ({FRAME_SIZE / SAMPLE_RATE * 1000:.0f} ms)")
    print(f"hop:    {HOP} samples ({HOP / SAMPLE_RATE * 1000:.0f} ms)")
    print()

    # 1 second of a 440 Hz sine wave
    x = sine_wave(440, duration_s=1.0)
    frames = frame_signal(x)
    print(f"1s signal → {len(x)} samples → {len(frames)} frames")

    # 5 seconds
    x5 = sine_wave(440, duration_s=5.0)
    frames5 = frame_signal(x5)
    print(f"5s signal → {len(x5)} samples → {len(frames5)} frames")

    # pad to 30-second Whisper window
    padded = pad_or_clip(frames5, TARGET_FRAMES)
    print(f"after pad to {MAX_SECONDS}s: {len(padded)} frames  (target {TARGET_FRAMES})")

    # per-frame "energy" (mel stand-in). Whisper uses 80 mel bins per frame.
    energies = [frame_energy(f) for f in frames5]
    print(f"first 5 frame log-energies: " + ", ".join(f"{e:+.3f}" for e in energies[:5]))
    print()

    print("=== task prompts — what flips Whisper's behavior ===")
    examples = [
        ("English transcription with timestamps",
         whisper_prompt(lang="en", task="transcribe", timestamps=True)),
        ("French translation to English, no timestamps",
         whisper_prompt(lang="fr", task="translate", timestamps=False)),
        ("Japanese transcription with timestamps",
         whisper_prompt(lang="ja", task="transcribe", timestamps=True)),
    ]
    for name, toks in examples:
        print(f"  {name}:")
        print(f"    " + "  ".join(toks))
    print()

    print("=== Whisper size table (large-v3 geometry) ===")
    configs = [
        ("tiny",      39,  4,  384,  6),
        ("base",      74,  6,  512,  8),
        ("small",    244, 12,  768, 12),
        ("medium",   769, 24, 1024, 16),
        ("large-v3",1550, 32, 1280, 20),
        ("turbo",    809, 32, 1280, 20),
    ]
    print(f"  {'name':<10}  {'params(M)':>10}  {'layers':>7}  {'d_model':>8}  {'heads':>6}")
    for name, p, L, d, h in configs:
        print(f"  {name:<10}  {p:>10}  {L:>7}  {d:>8}  {h:>6}")
    print()
    print("turbo = large-v3 encoder + 4-layer decoder. 8x faster decoding.")


if __name__ == "__main__":
    main()
