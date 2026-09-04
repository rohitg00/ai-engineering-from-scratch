"""Toy anti-spoofing + toy watermark, to illustrate the shape.

Real production uses AASIST / RawNet2 for detection and AudioSeal for
watermarking — both are neural nets. Here we simulate the interface
with simple numeric tricks so the pipeline is visible.

Run: python3 code/main.py
"""

import math
import random


def synth_real_speech(n_samples=16000, seed=0):
    rng = random.Random(seed)
    out = []
    for i in range(n_samples):
        base = 0.2 * math.sin(2 * math.pi * 220 * i / 16000)
        harmonic = 0.08 * math.sin(2 * math.pi * 440 * i / 16000)
        noise = 0.02 * rng.gauss(0, 1.0)
        out.append(base + harmonic + noise)
    return out


def synth_fake_speech(n_samples=16000, seed=0):
    rng = random.Random(seed)
    out = []
    for i in range(n_samples):
        base = 0.2 * math.sin(2 * math.pi * 220 * i / 16000)
        ultra_flat = 0.05 * math.sin(2 * math.pi * 6000 * i / 16000)
        out.append(base + ultra_flat + 0.002 * rng.gauss(0, 1.0))
    return out


def magnitude_spectrum(audio, n_fft=256):
    result = [0.0] * (n_fft // 2 + 1)
    window = [0.5 - 0.5 * math.cos(2 * math.pi * i / (n_fft - 1)) for i in range(n_fft)]
    chunks = [audio[i : i + n_fft] for i in range(0, len(audio) - n_fft, n_fft)]
    for chunk in chunks:
        for k in range(n_fft // 2 + 1):
            re, im = 0.0, 0.0
            for j in range(n_fft):
                angle = -2 * math.pi * k * j / n_fft
                re += window[j] * chunk[j] * math.cos(angle)
                im += window[j] * chunk[j] * math.sin(angle)
            result[k] += math.sqrt(re * re + im * im)
    return result


def toy_detector_score(audio):
    spec = magnitude_spectrum(audio)
    total = sum(spec) or 1e-9
    high_band = sum(spec[len(spec) // 2 :]) / total
    return high_band


def toy_watermark_embed(audio, payload_bits):
    out = list(audio)
    step = max(1, len(audio) // len(payload_bits))
    for i, bit in enumerate(payload_bits):
        idx = i * step
        if idx < len(out):
            out[idx] = out[idx] + (0.0005 if bit else -0.0005)
    return out


def toy_watermark_detect(audio, n_bits=16):
    step = max(1, len(audio) // n_bits)
    out = []
    for i in range(n_bits):
        idx = i * step
        if idx < len(audio):
            out.append(1 if audio[idx] > 0 else 0)
    return out


def main():
    random.seed(0)

    print("=== Step 1: synthesize real vs fake speech ===")
    real_clips = [synth_real_speech(seed=i) for i in range(20)]
    fake_clips = [synth_fake_speech(seed=100 + i) for i in range(20)]
    print(f"  20 real, 20 fake, {len(real_clips[0])} samples each")

    print()
    print("=== Step 2: score with toy spectral detector ===")
    real_scores = [toy_detector_score(a) for a in real_clips]
    fake_scores = [toy_detector_score(a) for a in fake_clips]
    print(f"  real  mean: {sum(real_scores)/len(real_scores):.3f}")
    print(f"  fake  mean: {sum(fake_scores)/len(fake_scores):.3f}")

    print()
    print("=== Step 3: sweep threshold → EER ===")
    candidates = sorted(set(real_scores + fake_scores))
    best = (1.0, 0.0, 0.0, 0.0)
    for t in candidates:
        far = sum(1 for s in fake_scores if s >= t) / len(fake_scores)
        frr = sum(1 for s in real_scores if s < t) / len(real_scores)
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), t, far, frr)
    gap, t, far, frr = best
    print(f"  EER ≈ {(far + frr) * 50:.2f}%  at threshold {t:.4f}")
    print(f"    (on toy data — real AASIST on ASVspoof 2019 LA: 0.42% EER)")

    print()
    print("=== Step 4: watermark embed + detect (toy) ===")
    payload = [1, 0, 1, 1, 0, 1, 0, 0, 1, 1, 0, 1, 0, 1, 1, 0]
    clean = synth_real_speech(n_samples=16000, seed=42)
    watermarked = toy_watermark_embed(clean, payload)
    recovered = toy_watermark_detect(watermarked)
    bit_acc = sum(1 for a, b in zip(payload, recovered) if a == b) / len(payload)
    print(f"  payload:   {payload}")
    print(f"  recovered: {recovered}")
    print(f"  bit accuracy: {bit_acc * 100:.1f}%   (toy; real AudioSeal: &gt; 99% pre-attack)")

    print()
    print("=== Step 5: 2026 benchmarks ===")
    rows = [
        ("AASIST (ASVspoof 2019 LA)",    "0.42% EER",  "detection SOTA"),
        ("NeXt-TDNN + WavLM (2025)",     "0.42% EER",  "detection SOTA"),
        ("Robust method on ASVspoof 5",  "7.23% EER",  "real-world"),
        ("AudioSeal (pre-attack)",       "&gt; 99% bit acc","localized watermark"),
        ("WavMark (pre-attack)",         "99.52% bit acc","legacy watermark"),
        ("All (under pitch shift)",       "&lt; 60% bit acc","universal attack"),
    ]
    print("  | method                         | metric           | note              |")
    for name, m, note in rows:
        print(f"  | {name:<30} | {m:<16} | {note:<17} |")

    print()
    print("takeaways:")
    print("  - detection: AASIST on log-mel / spec features; ensemble with RawNet2")
    print("  - watermark: AudioSeal (localized, fast, Meta, 485× faster than WavMark)")
    print("  - pitch-shift attack breaks every watermark → need both detection AND watermarking")
    print("  - always ship C2PA manifest + audit log on top")


if __name__ == "__main__":
    main()
