"""Music-generation cartoon: symbolic chord/drum generation from a prompt.

This is a pedagogical stand-in. Real music-gen uses neural codec LM
(MusicGen / ACE-Step) or latent diffusion (Stable Audio). Here we walk
through the "tokens over time" idea at a symbolic level so the shape is
visible.

Stdlib only. Run: python3 code/main.py
"""

import random


MAJOR_KEYS = {
    "C": ["C", "Dm", "Em", "F", "G", "Am", "Bdim"],
    "G": ["G", "Am", "Bm", "C", "D", "Em", "F#dim"],
    "D": ["D", "Em", "F#m", "G", "A", "Bm", "C#dim"],
    "A": ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"],
}

COMMON_PROGRESSIONS = {
    "pop":     [1, 5, 6, 4],
    "ballad":  [1, 6, 4, 5],
    "jazz":    [2, 5, 1, 6],
    "rock":    [1, 4, 5, 1],
    "lofi":    [6, 4, 1, 5],
}

DRUM_PATTERNS = {
    "pop":    "X.o.X.o.X.o.X.o.",
    "rock":   "X..oX..oX..oX..o",
    "lofi":   "X...o...X...o.o.",
    "jazz":   "X.oox.oxX.oox.ox",
    "trap":   "Xooox.oxXooox.ox",
}


def chord_progression(key, genre, bars=8):
    scale = MAJOR_KEYS[key]
    pat = COMMON_PROGRESSIONS.get(genre, COMMON_PROGRESSIONS["pop"])
    repeats = bars // len(pat) + 1
    seq = (pat * repeats)[:bars]
    return [scale[i - 1] for i in seq]


def drum_pattern(genre, bars=8):
    base = DRUM_PATTERNS.get(genre, DRUM_PATTERNS["pop"])
    return (base * bars)[: bars * 16]


def fake_generate(prompt, rng=None):
    rng = rng or random.Random(0)
    prompt_lower = prompt.lower()
    key = "C"
    for k in MAJOR_KEYS:
        if f" {k.lower()}" in " " + prompt_lower:
            key = k
            break
    genre = "pop"
    for g in COMMON_PROGRESSIONS:
        if g in prompt_lower:
            genre = g
            break
    bars = 8
    bpm = 120
    for token in prompt_lower.split():
        if token.endswith("bpm"):
            try:
                bpm = int(token[:-3])
            except ValueError:
                pass
    return {
        "key": key,
        "genre": genre,
        "bpm": bpm,
        "bars": bars,
        "chords": chord_progression(key, genre, bars),
        "drums": drum_pattern(genre, bars),
    }


def visualize(piece):
    print(f"  key: {piece['key']}  genre: {piece['genre']}  tempo: {piece['bpm']} bpm  bars: {piece['bars']}")
    print(f"  chords: {' | '.join(piece['chords'])}")
    drum = piece["drums"]
    print(f"  drums (kick=X snare=o): {drum}")


def main():
    prompts = [
        "upbeat pop in G major at 128 bpm",
        "slow lofi groove in C",
        "rock anthem in D at 140 bpm",
        "jazz swing in A",
    ]

    print("=== Step 1: prompt → symbolic music piece (toy) ===")
    for p in prompts:
        print(f"prompt: {p!r}")
        piece = fake_generate(p)
        visualize(piece)
        print()

    print("=== Step 2: 2026 music-gen model cheatsheet ===")
    models = [
        ("MusicGen-large",     3300, "30 s",  "no",  "MIT"),
        ("Stable Audio Open",  1200, "47 s",  "no",  "non-commercial"),
        ("ACE-Step XL (Apr 26)", 4000, "2 min+", "yes", "Apache-2.0"),
        ("YuE",                7000, "2 min+", "yes", "Apache-2.0"),
        ("Suno v5 (closed)",      0, "4 min",  "yes", "commercial"),
        ("Udio v4 (closed)",      0, "4 min",  "yes + stems", "commercial"),
    ]
    print("  | model               | params (M) | length | vocals | license        |")
    for name, p, length, v, lic in models:
        print(f"  | {name:<20} | {p:>10} | {length:>6} | {v:<12} | {lic:<14} |")

    print()
    print("takeaways:")
    print("  - open models: MusicGen (instrumental), ACE-Step / YuE (full song)")
    print("  - commercial: Suno v5 = quality leader; Udio v4 = producer tools (stems + inpaint)")
    print("  - legal: Warner + UMG settlements (2025-2026) define safe zones")
    print("  - always tag AI-generated music with watermark + metadata disclosure")


if __name__ == "__main__":
    main()
