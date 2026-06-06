"""Audio evaluation metrics, from scratch.

Implements WER, CER, EER, simple SECS, FAD-shaped embedding distance,
and a MMAU-style multiple-choice accuracy. Stdlib-only.

Run: python3 code/main.py
"""

import math
import random


def _edit_distance(a_tokens, b_tokens):
    dp = [[0] * (len(b_tokens) + 1) for _ in range(len(a_tokens) + 1)]
    for i in range(len(a_tokens) + 1):
        dp[i][0] = i
    for j in range(len(b_tokens) + 1):
        dp[0][j] = j
    for i in range(1, len(a_tokens) + 1):
        for j in range(1, len(b_tokens) + 1):
            cost = 0 if a_tokens[i - 1] == b_tokens[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    return dp[len(a_tokens)][len(b_tokens)]


def normalize(text):
    import re
    text = text.lower()
    text = re.sub(r"[^a-z0-9\s]", "", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def wer(ref, hyp):
    r, h = normalize(ref).split(), normalize(hyp).split()
    return _edit_distance(r, h) / max(1, len(r))


def cer(ref, hyp):
    return _edit_distance(list(ref), list(hyp)) / max(1, len(ref))


def eer_from_scores(same, diff):
    thresholds = sorted(set(same + diff))
    best = (1.0, 0.0, 0.0, 0.0)
    for t in thresholds:
        far = sum(1 for s in diff if s >= t) / max(1, len(diff))
        frr = sum(1 for s in same if s < t) / max(1, len(same))
        if abs(far - frr) < best[0]:
            best = (abs(far - frr), t, far, frr)
    gap, t, far, frr = best
    return (far + frr) / 2, t


def cosine(a, b):
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1e-12
    nb = math.sqrt(sum(x * x for x in b)) or 1e-12
    return dot / (na * nb)


def embedding_fad_like(real_embeds, fake_embeds):
    def mean_var(embs):
        n = len(embs[0])
        mean = [sum(e[i] for e in embs) / len(embs) for i in range(n)]
        var = [sum((e[i] - mean[i]) ** 2 for e in embs) / len(embs) for i in range(n)]
        return mean, var
    mu_r, v_r = mean_var(real_embeds)
    mu_f, v_f = mean_var(fake_embeds)
    mean_dist = sum((a - b) ** 2 for a, b in zip(mu_r, mu_f))
    var_dist = sum((math.sqrt(a) - math.sqrt(b)) ** 2 for a, b in zip(v_r, v_f))
    return math.sqrt(mean_dist + var_dist)


def mmau_accuracy(predictions, golds):
    correct = sum(1 for p, g in zip(predictions, golds) if p == g)
    return correct / max(1, len(predictions))


def main():
    print("=== WER + CER ===")
    pairs = [
        ("turn on the kitchen lights",  "turn off the kitchen lights"),
        ("what's the weather today",     "what is the weather today"),
        ("play jazz",                    "play jazz"),
        ("set a 5 minute timer",         "set a five minute timer"),
    ]
    for ref, hyp in pairs:
        print(f"  ref: {ref!r}")
        print(f"  hyp: {hyp!r}")
        print(f"    WER = {wer(ref, hyp):.3f}   CER = {cer(ref, hyp):.3f}")

    print()
    print("=== EER (toy speaker verification) ===")
    random.seed(0)
    rng = random.Random(0)
    same = [rng.gauss(0.80, 0.06) for _ in range(100)]
    diff = [rng.gauss(0.20, 0.15) for _ in range(500)]
    eer, t = eer_from_scores(same, diff)
    print(f"  same mean cos: {sum(same)/len(same):.3f}")
    print(f"  diff mean cos: {sum(diff)/len(diff):.3f}")
    print(f"  EER = {eer * 100:.2f}%   at threshold {t:.3f}")

    print()
    print("=== SECS (toy voice-cloning similarity) ===")
    ref_emb = [rng.gauss(0, 0.1) for _ in range(192)]
    clone_emb = [ref_emb[i] + rng.gauss(0, 0.1) for i in range(192)]
    secs = cosine(ref_emb, clone_emb)
    print(f"  SECS = {secs:.3f}   (target: &gt; 0.75 for recognizable clone)")

    print()
    print("=== FAD-shaped embedding distance ===")
    real_embs = [[rng.gauss(0, 1.0) for _ in range(32)] for _ in range(50)]
    fake_embs = [[rng.gauss(0.1, 1.1) for _ in range(32)] for _ in range(50)]
    fad = embedding_fad_like(real_embs, fake_embs)
    print(f"  FAD-like = {fad:.3f}   (MusicGen-small on MusicCaps: 4.5)")

    print()
    print("=== MMAU-Pro-style multiple-choice accuracy ===")
    predictions = ["A", "C", "B", "A", "D", "C", "B", "A", "A", "C"]
    golds       = ["A", "B", "B", "A", "D", "A", "B", "A", "C", "C"]
    acc = mmau_accuracy(predictions, golds)
    print(f"  accuracy = {acc:.3f}  (random on 4-way: 0.250)")

    print()
    print("=== 2026 benchmarks worth knowing ===")
    rows = [
        ("Open ASR Leaderboard",  "LibriSpeech + multilingual", "Parakeet-TDT 6.05%, Whisper-LV3-turbo 1.58%"),
        ("TTS Arena",             "blind pairwise TTS",          "Kokoro ELO 1059, ElevenLabs v3 1179"),
        ("Artificial Analysis Speech", "TTS + STT arena",        "Inworld TTS-1.5-Max ELO 1236 leader"),
        ("MMAU-Pro",              "LALM reasoning",              "Gemini 2.5 Pro ~60%, GPT-4o Audio 52.5%"),
        ("LongAudioBench",        "multi-minute LALM",           "Audio Flamingo Next beats Gemini 2.5 Pro"),
        ("VoxCeleb1-O",           "speaker verification EER",    "ECAPA 0.87%, 3D-Speaker 0.50%"),
        ("AudioSet mAP",          "multi-label classification",  "BEATs-iter3 0.548 mAP"),
        ("ASVspoof 5",            "anti-spoofing EER",           "SOTA ~7.23% on in-the-wild"),
    ]
    print("  | leaderboard              | axis                      | 2026 SOTA                                   |")
    for name, axis, sota in rows:
        print(f"  | {name:<24} | {axis:<25} | {sota:<43} |")

    print()
    print("takeaways:")
    print("  - every task has 2-3 primary metrics; choose BEFORE training")
    print("  - normalize text before computing WER/CER; report the normalization")
    print("  - report P50/P95/P99 for latency, per-class for classification, per-category for MMAU")
    print("  - public benchmark + your own held-out domain set = both, always")


if __name__ == "__main__":
    main()
