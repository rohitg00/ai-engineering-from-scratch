"""Voice cloning demo: simulate (content, speaker) decomposition and swap.

Build a tiny "content" vector from a deterministic phoneme hash and a
"speaker" vector from per-speaker tone profile. Demonstrate that the
reconstructed audio at a swapped speaker embedding preserves content
while its speaker-embedding cosine tracks the target.

Stdlib only. No real neural net — this is the lego-model of a cloning pipeline.
Run: python3 code/main.py
"""

import hashlib
import math
import random


def content_vector(text, dim=64):
    """Deterministic 'content' representation of text — toy PPG stand-in."""
    h = hashlib.sha256(text.encode()).digest()
    expanded = (h * ((dim + len(h) - 1) // len(h)))[:dim]
    return [b / 255.0 - 0.5 for b in expanded]


def speaker_vector(seed, dim=64):
    """Deterministic 'speaker embedding' — toy ECAPA-TDNN stand-in."""
    rng = random.Random(seed)
    v = [rng.gauss(0, 1) for _ in range(dim)]
    norm = math.sqrt(sum(x * x for x in v)) or 1e-12
    return [x / norm for x in v]


def fake_tts(content, speaker, mix=0.5):
    """Pretend TTS: element-wise mix content with speaker."""
    return [(1 - mix) * c + mix * s for c, s in zip(content, speaker)]


def extract_speaker(wave, reference_speakers):
    """Pretend speaker-encoder: return speaker with highest cosine."""
    sims = [(name, cosine(wave, vec)) for name, vec in reference_speakers.items()]
    sims.sort(key=lambda x: -x[1])
    return sims[0]


def extract_content(wave, reference_contents):
    sims = [(text, cosine(wave, vec)) for text, vec in reference_contents.items()]
    sims.sort(key=lambda x: -x[1])
    return sims[0]


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)


def watermark(wave, payload_bits, strength=0.003):
    """Toy inaudible watermark: per-bit DC shift on a partitioned stride.

    Real systems (SilentCipher, PerTh) embed in perceptual domain and survive
    re-encoding. This demo just proves the encode/decode contract holds.
    """
    n_bits = len(payload_bits)
    out = list(wave)
    for i in range(len(out)):
        bit_idx = i % n_bits
        sign = 1 if payload_bits[bit_idx] else -1
        out[i] += sign * strength
    return out


def detect_watermark(wave_original, wave_wm, n_bits=32):
    diff = [a - b for a, b in zip(wave_wm, wave_original)]
    bits = []
    for b in range(n_bits):
        chunk = diff[b::n_bits]
        avg = sum(chunk) / max(1, len(chunk))
        bits.append(1 if avg > 0 else 0)
    return bits


def bit_accuracy(a, b):
    return sum(1 for x, y in zip(a, b) if x == y) / len(a)


def main():
    DIM = 64

    alice = speaker_vector("alice_00001", DIM)
    bob = speaker_vector("bob_00002", DIM)
    carol = speaker_vector("carol_00003", DIM)
    speakers = {"alice": alice, "bob": bob, "carol": carol}

    text_greet = "hello this is a test"
    text_remind = "please remember to water plants"
    content_greet = content_vector(text_greet, DIM)
    content_remind = content_vector(text_remind, DIM)
    contents = {text_greet: content_greet, text_remind: content_remind}

    print("=== Step 1: synthesize alice saying 'hello' ===")
    wav_alice_greet = fake_tts(content_greet, alice, mix=0.5)
    name, score = extract_speaker(wav_alice_greet, speakers)
    txt, tscore = extract_content(wav_alice_greet, contents)
    print(f"  speaker probe: {name} (cos={score:.3f})")
    print(f"  content probe: {txt!r} (cos={tscore:.3f})")

    print()
    print("=== Step 2: zero-shot clone — alice's voice on bob's intended text ===")
    # bob's text + alice's speaker embedding
    wav_cloned = fake_tts(content_remind, alice, mix=0.5)
    name, score = extract_speaker(wav_cloned, speakers)
    txt, tscore = extract_content(wav_cloned, contents)
    print(f"  speaker probe: {name} (cos={score:.3f})  -- should stay alice")
    print(f"  content probe: {txt!r} (cos={tscore:.3f})  -- should be remind text")

    print()
    print("=== Step 3: voice conversion — rewrite bob's utterance into alice ===")
    wav_bob_orig = fake_tts(content_remind, bob, mix=0.5)
    # extract content, resynth with alice embedding
    matched_text, _ = extract_content(wav_bob_orig, contents)
    content_est = contents[matched_text]
    wav_converted = fake_tts(content_est, alice, mix=0.5)
    name, score = extract_speaker(wav_converted, speakers)
    print(f"  post-conversion speaker: {name} (cos={score:.3f})  -- should be alice")
    print(f"  content preserved:  {matched_text!r}")

    print()
    print("=== Step 4: SECS — speaker cosine similarity of clone ===")
    secs_same = cosine(alice, wav_cloned)
    secs_diff = cosine(bob, wav_cloned)
    print(f"  alice (target) vs clone  SECS = {secs_same:.3f}  (should be high)")
    print(f"  bob (not target) vs clone SECS = {secs_diff:.3f}  (should be low)")
    print(f"  production ECAPA-TDNN on real clones lands SECS in 0.65 - 0.78 range.")

    print()
    print("=== Step 5: watermark + detect ===")
    payload = [int(b) for b in bin(0xDEADBEEF)[2:].zfill(32)]
    wm = watermark(wav_cloned, payload)
    detected = detect_watermark(wav_cloned, wm, n_bits=32)
    acc = bit_accuracy(payload, detected)
    print(f"  payload:   {''.join(str(b) for b in payload)}")
    print(f"  detected:  {''.join(str(b) for b in detected)}")
    print(f"  bit accuracy: {acc * 100:.1f}%   (real SilentCipher: ~99% across MP3 re-encode)")

    print()
    print("=== Step 6: 2026 cloning leaderboard ===")
    table = [
        ("VoiceBox",       0.78, 2.1, "330M"),
        ("VALL-E 2",       0.77, 2.4, "370M"),
        ("F5-TTS",         0.72, 2.1, "335M"),
        ("OpenVoice v2",   0.70, 2.8, "220M"),
        ("XTTS v2",        0.65, 3.5, "470M"),
    ]
    print("  | Model          | SECS  | CER%  | Size |")
    for name, s, c, p in table:
        print(f"  | {name:<14} | {s:.2f}  | {c:.1f}   | {p:<4} |")


if __name__ == "__main__":
    main()
