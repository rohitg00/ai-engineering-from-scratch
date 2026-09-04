"""Real-time voice agent pipeline simulator.

Simulates an audio chunk stream through VAD → STT → LLM → TTS with a
latency budget. No real models; tracks timing to show where budget goes.

Run: python3 code/main.py
"""

import math
import random
import time


CHUNK_MS = 20
VAD_THRESHOLD_DBFS = -40.0


def rms_dbfs(chunk):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    return 20.0 * math.log10(max(rms, 1e-10))


def simulate_chunk(is_speech, rng):
    n = int(0.001 * CHUNK_MS * 16000)
    if is_speech:
        return [0.15 * rng.gauss(0, 1.0) for _ in range(n)]
    return [0.002 * rng.gauss(0, 1.0) for _ in range(n)]


def vad(chunk, threshold_dbfs=VAD_THRESHOLD_DBFS):
    return rms_dbfs(chunk) > threshold_dbfs


def fake_stt(utterance_duration_s):
    latency_ms = 80 + utterance_duration_s * 50
    time.sleep(latency_ms / 1000.0)
    return "hello world"


def fake_llm(text):
    time.sleep(0.15)
    return "sure, one second"


def fake_tts_first_audio(text):
    time.sleep(0.10)
    return "(audio chunk)"


def main():
    random.seed(0)
    rng = random.Random(0)

    print("=== Step 1: simulate 1.5 s of user speech as 20 ms chunks ===")
    chunks = [simulate_chunk(True, rng) for _ in range(75)]
    chunks += [simulate_chunk(False, rng) for _ in range(20)]
    print(f"  generated {len(chunks)} chunks, {CHUNK_MS} ms each = {len(chunks)*CHUNK_MS} ms")

    print()
    print("=== Step 2: VAD-gate and buffer speech ===")
    buffered = []
    in_speech = False
    for c in chunks:
        active = vad(c)
        if active:
            buffered.extend(c)
            in_speech = True
        elif in_speech and len(buffered) >= 16000 * 0.3:
            break
    print(f"  buffered {len(buffered) / 16000:.3f} s of speech")

    print()
    print("=== Step 3: simulate STT / LLM / TTS with timing ===")
    budget = {}
    t = time.time()

    t0 = time.time()
    text = fake_stt(len(buffered) / 16000.0)
    budget["STT"] = (time.time() - t0) * 1000

    t0 = time.time()
    reply = fake_llm(text)
    budget["LLM"] = (time.time() - t0) * 1000

    t0 = time.time()
    first_audio = fake_tts_first_audio(reply)
    budget["TTS TTFA"] = (time.time() - t0) * 1000

    total = (time.time() - t) * 1000

    print(f"  user said: {text!r}")
    print(f"  agent replied: {reply!r}")
    print()
    print("  latency breakdown:")
    for stage, ms in budget.items():
        bar = "#" * int(ms / 10)
        print(f"    {stage:<10s}  {ms:>6.1f} ms  {bar}")
    print(f"  end-to-end: {total:.1f} ms   (target: &lt; 500 ms)")

    print()
    print("=== Step 4: where the 2026 production budget goes ===")
    rows = [
        ("network in",  "50-100"),
        ("VAD",          "20-80"),
        ("STT stream",   "100-300"),
        ("LLM stream",   "100-500"),
        ("TTS TTFA",     "100-300"),
        ("network out",  "50-100"),
        ("TOTAL",        "400-1400"),
    ]
    print("  | stage           | typical ms |")
    for name, ms in rows:
        print(f"  | {name:<15} | {ms:>10} |")

    print()
    print("  sub-500 ms: LiveKit + Silero + Deepgram + GPT-4o + Cartesia")
    print("  sub-200 ms: Moshi (full-duplex) or Sesame CSM — different architecture (see lesson 15)")


if __name__ == "__main__":
    main()
