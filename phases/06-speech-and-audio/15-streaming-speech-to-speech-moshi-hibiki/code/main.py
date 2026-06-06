"""Moshi-style full-duplex simulation.

Models the shape of Moshi's parallel-stream architecture:
  - user Mimi token stream (input)
  - moshi Mimi token stream (output)
  - moshi text stream (inner monologue)

Runs a cartoon "conversation" through the loop; measures latency per
80 ms frame. No real codec or transformer — just structure.

Run: python3 code/main.py
"""

import math
import random
import time


FRAME_MS = 80
CODEBOOKS = 8
SAMPLE_RATE = 24000


def fake_mimi_encode(audio_80ms):
    s = sum(abs(x) for x in audio_80ms) / max(1, len(audio_80ms))
    rng = random.Random(int(s * 1000))
    return [rng.randint(0, 1023) for _ in range(CODEBOOKS)]


def fake_mimi_decode(tokens):
    s = sum(tokens) / (1024.0 * CODEBOOKS)
    n = int(SAMPLE_RATE * FRAME_MS / 1000)
    return [0.1 * s * math.sin(2.0 * math.pi * 220.0 * i / SAMPLE_RATE) for i in range(n)]


def depth_transformer(context_text, context_user_mimi, context_moshi_mimi):
    time.sleep(0.003)
    rng = random.Random(len(context_user_mimi) + len(context_moshi_mimi))
    return [rng.randint(0, 1023) for _ in range(CODEBOOKS)]


def inner_monologue_next_token(text_so_far, user_mimi_stream):
    time.sleep(0.002)
    return f"tok_{len(text_so_far)}"


def simulate_user_speech(n_frames):
    audio = []
    for i in range(n_frames):
        chunk = [0.15 * math.sin(2 * math.pi * (220 + 20 * i) * j / SAMPLE_RATE) for j in range(int(SAMPLE_RATE * FRAME_MS / 1000))]
        audio.append(chunk)
    return audio


def main():
    print(f"=== Moshi-style full-duplex simulation — {FRAME_MS} ms frames, {CODEBOOKS} codebooks ===")
    print()

    user_audio_stream = simulate_user_speech(25)
    user_mimi = []
    moshi_mimi = []
    moshi_text = []
    per_frame_ms = []

    for t, user_chunk in enumerate(user_audio_stream):
        frame_start = time.time()

        user_tokens = fake_mimi_encode(user_chunk)
        user_mimi.append(user_tokens)

        next_text = inner_monologue_next_token(moshi_text, user_mimi)
        moshi_text.append(next_text)

        next_moshi_tokens = depth_transformer(
            context_text=moshi_text,
            context_user_mimi=user_mimi,
            context_moshi_mimi=moshi_mimi,
        )
        moshi_mimi.append(next_moshi_tokens)

        out_audio = fake_mimi_decode(next_moshi_tokens)
        frame_ms = (time.time() - frame_start) * 1000
        per_frame_ms.append(frame_ms)

    print(f"processed {len(user_audio_stream)} frames ({len(user_audio_stream)*FRAME_MS} ms wall audio)")
    print(f"  user_mimi:    {len(user_mimi)} × {CODEBOOKS} codebooks")
    print(f"  moshi_mimi:   {len(moshi_mimi)} × {CODEBOOKS} codebooks")
    print(f"  moshi_text:   {len(moshi_text)} tokens   (first 5: {moshi_text[:5]})")

    print()
    print("=== per-frame latency ===")
    avg = sum(per_frame_ms) / len(per_frame_ms)
    p95 = sorted(per_frame_ms)[int(len(per_frame_ms) * 0.95)]
    print(f"  mean: {avg:.2f} ms   p95: {p95:.2f} ms   target: &lt; 80 ms per frame (realtime)")

    print()
    print("=== 2026 streaming S2S model cheatsheet ===")
    rows = [
        ("Moshi (Kyutai)",       "200 ms L4",   "full-duplex dialogue, EN+FR",    "CC-BY 4.0"),
        ("Hibiki",                "12.5 Hz",    "EN↔FR streaming translation",   "CC-BY 4.0"),
        ("Hibiki-Zero (Feb 26)",  "12.5 Hz",    "5 langs, no aligned data",       "CC-BY 4.0"),
        ("Sesame CSM-1B",         "200 ms",      "context-TTS (not full duplex)", "Apache-2.0"),
        ("GPT-4o Realtime",        "~300 ms",     "closed, API",                   "commercial"),
        ("Gemini 2.5 Live",       "~350 ms",     "closed, API",                   "commercial"),
    ]
    print("  | model                | latency   | description                     | license      |")
    for name, lat, desc, lic in rows:
        print(f"  | {name:<20} | {lat:<9} | {desc:<30}  | {lic:<12} |")

    print()
    print("takeaways:")
    print("  - full-duplex architecture: 2 parallel Mimi streams + text inner-monologue")
    print("  - 160 ms theoretical latency floor (80 ms frame + 80 ms acoustic delay)")
    print("  - Moshi is best voice-companion; pipelines (lesson 12) still win for tool-use")
    print("  - Hibiki is streaming translation; same shape, different training data")


if __name__ == "__main__":
    main()
