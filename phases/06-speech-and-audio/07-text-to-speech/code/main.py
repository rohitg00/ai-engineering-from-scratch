"""TTS internals demo: phoneme lookup + duration estimation + mel frame schedule.

Stdlib only. Builds a toy English grapheme-to-phoneme table, estimates
durations, and prints the frame schedule a FastSpeech-style model would
use. For real synthesis, install kokoro or f5-tts (see docs).

Run: python3 code/main.py
"""

import math
import random


# Minimal grapheme-to-phoneme table: one mapping per common grapheme cluster.
# Real systems use espeak-ng or g2p-en (CMU dictionary) — this is toy scope.
G2P = {
    " ":    ["_"],
    "a":    ["AH"],  "b":    ["B"],  "c":    ["K"],  "d":    ["D"],  "e":    ["EH"],
    "f":    ["F"],   "g":    ["G"],  "h":    ["HH"], "i":    ["IH"], "j":    ["JH"],
    "k":    ["K"],   "l":    ["L"],  "m":    ["M"],  "n":    ["N"],  "o":    ["AO"],
    "p":    ["P"],   "q":    ["K"],  "r":    ["R"],  "s":    ["S"],  "t":    ["T"],
    "u":    ["UH"],  "v":    ["V"],  "w":    ["W"],  "x":    ["K", "S"],
    "y":    ["Y"],   "z":    ["Z"],
    "the":  ["DH", "AH"],
    "ing":  ["IH", "NG"],
    "er":   ["ER"],
    "sh":   ["SH"],
    "ch":   ["CH"],
    "th":   ["TH"],
    "ee":   ["IY"],
    "oo":   ["UW"],
    "ow":   ["AW"],
    "ay":   ["EY"],
    ".":    ["_PAUSE_"],
    ",":    ["_SHORT_"],
    "?":    ["_PAUSE_"],
    "!":    ["_PAUSE_"],
}

# Typical durations (frames @ 12.5 ms hop); roughly matches FastSpeech stats
DURATION_FRAMES = {
    "AA": 9, "AE": 7, "AH": 6, "AO": 8, "AW": 9, "AY": 8, "B": 4, "CH": 6,
    "D": 4, "DH": 5, "EH": 6, "ER": 7, "EY": 8, "F": 6, "G": 5, "HH": 4,
    "IH": 5, "IY": 7, "JH": 6, "K": 5, "L": 5, "M": 5, "N": 5, "NG": 6,
    "OW": 8, "OY": 9, "P": 5, "R": 5, "S": 6, "SH": 7, "T": 4, "TH": 5,
    "UH": 6, "UW": 8, "V": 5, "W": 5, "Y": 5, "Z": 6, "ZH": 7,
    "_": 3,           # word boundary
    "_SHORT_": 6,     # comma pause
    "_PAUSE_": 12,    # sentence pause
}


def phonemize(text):
    text = text.lower()
    phones = []
    i = 0
    while i < len(text):
        matched = False
        for length in (3, 2, 1):
            if i + length <= len(text):
                chunk = text[i : i + length]
                if chunk in G2P:
                    phones.extend(G2P[chunk])
                    i += length
                    matched = True
                    break
        if not matched:
            i += 1
    return phones


def duration(phones, jitter=0.1, seed=0):
    random.seed(seed)
    out = []
    for p in phones:
        base = DURATION_FRAMES.get(p, 5)
        noise = int(round(base * random.uniform(-jitter, jitter)))
        out.append(max(1, base + noise))
    return out


def mel_schedule(phones, durs, hop_ms=12.5):
    schedule = []
    t = 0.0
    for p, d in zip(phones, durs):
        schedule.append((p, t, t + d * hop_ms))
        t += d * hop_ms
    return schedule, t


def main():
    text = "Please remind me to water the plants at 6 pm."
    print("=== Step 1: grapheme to phoneme ===")
    print(f"  text: {text!r}")
    phones = phonemize(text)
    print(f"  phones ({len(phones)}): {' '.join(phones[:20])}{'...' if len(phones) > 20 else ''}")

    print()
    print("=== Step 2: estimate per-phoneme duration ===")
    durs = duration(phones, jitter=0.1, seed=42)
    print(f"  durations (frames): {durs[:20]}{'...' if len(durs) > 20 else ''}")

    print()
    print("=== Step 3: mel frame schedule (12.5 ms hop) ===")
    sched, total_ms = mel_schedule(phones, durs)
    print(f"  total duration: {total_ms:.1f} ms  ({total_ms / 1000:.2f} s)")
    print(f"  first 10 frames:")
    for p, s, e in sched[:10]:
        print(f"    {p:<10} {s:6.1f} – {e:6.1f} ms")

    print()
    print("=== Step 4: total mel frames sent to vocoder ===")
    total_frames = sum(durs)
    audio_samples = total_frames * 300  # 12.5 ms @ 24 kHz = 300 samples
    print(f"  mel frames: {total_frames}  audio samples @ 24 kHz: {audio_samples}")
    print(f"  pipeline memory budget: {total_frames * 80 * 4 / 1024:.1f} KB (mel, float32)")

    print()
    print("=== Step 5: 2026 TTS quality board (UTMOS / CER / size) ===")
    table = [
        ("ground truth",   4.08, 1.2,   "—"),
        ("F5-TTS",         3.95, 2.1,   "335M"),
        ("Kokoro v0.19",   3.87, 1.8,   "82M"),
        ("XTTS v2",        3.81, 3.5,   "470M"),
        ("Parler-TTS L",   3.76, 2.8,   "2.3B"),
        ("VITS",           3.62, 3.1,   "25M"),
    ]
    print("  | Model             | UTMOS | CER%  | Size |")
    for name, u, c, s in table:
        print(f"  | {name:<17} | {u:.2f}  | {c:.1f}   | {s:<4} |")


if __name__ == "__main__":
    main()
