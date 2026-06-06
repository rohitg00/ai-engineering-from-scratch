"""End-to-end voice assistant simulator — 7 components, stub implementations.

Simulates a full user turn: mic → VAD → STT → LLM (with tool-call) → TTS.
Prints per-stage latency + decision trace.

No real models — replace each stub with Silero VAD / Whisper / GPT-4o /
Kokoro for a production pipeline.

Run: python3 code/main.py
"""

import math
import random
import time


def mic_generator(duration_s=2.0, sr=16000, chunk_ms=20, speech_mask=None):
    rng = random.Random(0)
    n_chunks = int(duration_s * 1000 / chunk_ms)
    if speech_mask is None:
        speech_mask = [False] * 5 + [True] * 60 + [False] * 20
    for i in range(min(n_chunks, len(speech_mask))):
        is_speech = speech_mask[i]
        n = int(sr * chunk_ms / 1000)
        if is_speech:
            chunk = [0.2 * rng.gauss(0, 1.0) for _ in range(n)]
        else:
            chunk = [0.003 * rng.gauss(0, 1.0) for _ in range(n)]
        yield chunk, is_speech


def vad(chunk, threshold_dbfs=-35.0):
    rms = (sum(x * x for x in chunk) / len(chunk)) ** 0.5
    return 20.0 * math.log10(max(rms, 1e-10)) > threshold_dbfs


def streaming_stt(utterance, sr=16000):
    time.sleep(0.08 + len(utterance) / sr * 0.05)
    return "set a timer for five minutes"


def llm_with_tools(transcript):
    time.sleep(0.12)
    if "timer" in transcript:
        return {
            "tool_calls": [{"name": "set_timer", "args": {"seconds": 300}}],
            "text": "Sure, setting a 5 minute timer.",
        }
    return {"tool_calls": [], "text": "OK."}


def dispatch_tool(name, args):
    time.sleep(0.01)
    if name == "set_timer":
        return {"ok": True, "expires_at": time.time() + args["seconds"]}
    return {"ok": False}


def streaming_tts(text):
    time.sleep(0.10)
    return [f"(audio chunk: {word})" for word in text.split()]


def play(audio_chunks):
    for _ in audio_chunks:
        time.sleep(0.02)


def main():
    random.seed(0)

    print("=== Step 1: capture turn via VAD gating ===")
    buffered = []
    pre_roll = []
    triggered = False
    silent_ms = 0
    turn_start = time.time()
    for chunk, truth in mic_generator():
        pre_roll.append(chunk)
        if len(pre_roll) > 15:
            pre_roll.pop(0)
        if vad(chunk):
            if not triggered:
                for c in pre_roll:
                    buffered.extend(c)
                triggered = True
            buffered.extend(chunk)
            silent_ms = 0
        elif triggered:
            silent_ms += 20
            buffered.extend(chunk)
            if silent_ms >= 400:
                break
    t_capture = (time.time() - turn_start) * 1000
    print(f"  captured {len(buffered)} samples ({len(buffered)/16000:.3f} s) in {t_capture:.0f} ms wall time")

    print()
    print("=== Step 2: streaming STT ===")
    t0 = time.time()
    text = streaming_stt(buffered)
    t_stt = (time.time() - t0) * 1000
    print(f"  transcript: {text!r}   stt latency: {t_stt:.1f} ms")

    print()
    print("=== Step 3: LLM with tool calling ===")
    t0 = time.time()
    response = llm_with_tools(text)
    t_llm = (time.time() - t0) * 1000
    print(f"  tool_calls: {response['tool_calls']}")
    for call in response["tool_calls"]:
        result = dispatch_tool(call["name"], call["args"])
        print(f"  {call['name']}({call['args']}) → {result}")
    print(f"  reply text: {response['text']!r}   llm latency: {t_llm:.1f} ms")

    print()
    print("=== Step 4: streaming TTS + playback ===")
    t0 = time.time()
    audio = streaming_tts(response["text"])
    t_tts_ttfa = (time.time() - t0) * 1000
    print(f"  TTFA: {t_tts_ttfa:.1f} ms    audio chunks: {len(audio)}")
    t0 = time.time()
    play(audio)
    t_play = (time.time() - t0) * 1000

    print()
    print("=== Step 5: end-to-end budget ===")
    stages = [
        ("VAD + capture (after end-of-speech)", silent_ms),
        ("STT",  t_stt),
        ("LLM + tool",  t_llm),
        ("TTS TTFA",    t_tts_ttfa),
    ]
    total = sum(ms for _, ms in stages)
    for name, ms in stages:
        bar = "#" * int(ms / 10)
        print(f"  {name:<40s} {ms:>6.1f} ms  {bar}")
    print(f"  TOTAL user-perceived (to first audio): {total:.1f} ms   (target: &lt; 800 ms)")

    print()
    print("=== Step 6: 2026 reference stacks ===")
    stacks = [
        ("LiveKit + Deepgram + GPT-4o + Cartesia",       "350-500 ms", "industry default"),
        ("Pipecat + Whisper-stream + GPT-4o + Kokoro",   "500-800 ms", "DIY-friendly"),
        ("Moshi (full-duplex single model)",              "200-300 ms", "see lesson 15"),
        ("Vapi / Retell (managed)",                        "300-500 ms", "fastest to ship"),
        ("whisper.cpp + llama.cpp + Kokoro-ONNX",         "offline",    "edge / privacy"),
    ]
    for s, lat, note in stacks:
        print(f"  {s:<46s} {lat:<12s} {note}")


if __name__ == "__main__":
    main()
