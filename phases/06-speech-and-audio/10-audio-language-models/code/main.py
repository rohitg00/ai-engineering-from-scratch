"""Audio-Language Model skeleton.

Walks through the 3-component template every 2026 LALM uses:
audio encoder → projector → LLM decoder. No neural net — this is the
shape every real implementation fills in.

Run: python3 code/main.py
"""

import math
import random


def fake_audio_encoder(audio_seconds=3.0, dim=1280):
    rng = random.Random(0)
    n_frames = int(audio_seconds * 50)
    return [[rng.gauss(0, 0.5) for _ in range(dim)] for _ in range(n_frames)]


def projector(features, audio_dim=1280, llm_dim=4096):
    random.seed(1)
    W_down = [[random.gauss(0, 0.02) for _ in range(audio_dim)] for _ in range(llm_dim)]
    out = []
    for f in features:
        hidden = [sum(W_down[i][j] * f[j] for j in range(audio_dim)) for i in range(llm_dim)]
        hidden = [max(0.0, h) for h in hidden]
        out.append(hidden)
    return out


def interleave_with_text(audio_tokens, text_tokens):
    return [("AUDIO", a) for a in audio_tokens] + [("TEXT", t) for t in text_tokens]


def fake_llm_answer(interleaved):
    n_audio = sum(1 for k, _ in interleaved if k == "AUDIO")
    n_text = sum(1 for k, _ in interleaved if k == "TEXT")
    return f"(simulated) given {n_audio} audio tokens + {n_text} text tokens, I would answer..."


def main():
    print("=== Step 1: encode 3 s of audio → features (pretend Whisper-large) ===")
    feats = fake_audio_encoder(3.0)
    print(f"  audio features: ({len(feats)} frames, {len(feats[0])} dim)")

    print()
    print("=== Step 2: projector → LLM embedding space ===")
    projected = projector(feats[:8])
    print(f"  projected (first 8 frames): ({len(projected)}, {len(projected[0])})")

    print()
    print("=== Step 3: interleave with text token ids ===")
    text_tokens = [2345, 1098, 7,   9821, 65]
    interleaved = interleave_with_text(list(range(len(projected))), text_tokens)
    print(f"  interleaved sequence length: {len(interleaved)}")
    print(f"  first 12 items: {interleaved[:12]}")

    print()
    print("=== Step 4: LLM decoder generates an answer ===")
    answer = fake_llm_answer(interleaved)
    print(f"  {answer}")

    print()
    print("=== Step 5: 2026 LALM benchmark board (MMAU-Pro) ===")
    models = [
        ("Gemini 2.5 Pro",    "~60%", "73.4%", "51.9%", "64.9%", "~22%"),
        ("Gemini 2.5 Flash",  "~57%", "73.4%", "50.5%", "64.9%", "21.2%"),
        ("GPT-4o Audio",      "52.5%", "—",    "—",     "—",     "26.5%"),
        ("Qwen2.5-Omni-7B",   "52.2%", "57.4%","47.6%", "61.5%", "~20%"),
        ("Audio Flamingo 3",  "~54%",  "—",    "—",     "—",     "—"),
    ]
    print("  | model              | overall | speech | sound  | music  | multi  |")
    for name, o, s, snd, m, mu in models:
        print(f"  | {name:<18} | {o:>7} | {s:>6} | {snd:>6} | {m:>6} | {mu:>6} |")

    print()
    print("takeaways:")
    print("  - every LALM = audio encoder + projector + LLM decoder")
    print("  - Qwen2.5-Omni-7B (Apache-2.0) is within 0.3 points of GPT-4o Audio")
    print("  - multi-audio reasoning is near-random (~22-26%) across ALL models in 2026")
    print("  - Audio Flamingo Next leads LongAudioBench (beats Gemini 2.5 Pro)")


if __name__ == "__main__":
    main()
