"""ASR basics: greedy CTC decode, beam CTC decode, Word Error Rate.

Stdlib only. Builds a tiny hand-rolled CTC example and computes WER.
Run: python3 code/main.py
"""

import math
import random
from collections import Counter


BLANK = 0
VOCAB = "_abcdefghijklmnopqrstuvwxyz "  # index 0 is blank


def ctc_greedy(frame_probs):
    preds = [max(range(len(p)), key=lambda i: p[i]) for p in frame_probs]
    out = []
    prev = -1
    for p in preds:
        if p != prev and p != BLANK:
            out.append(p)
        prev = p
    return "".join(VOCAB[i] for i in out)


def ctc_beam(frame_probs, beam_width=8):
    beams = [((), 0.0)]
    for p in frame_probs:
        log_p = [math.log(max(pi, 1e-10)) for pi in p]
        new_beams = {}
        for seq, lp in beams:
            for t, lpt in enumerate(log_p):
                if t == BLANK:
                    new_seq = seq
                else:
                    if seq and seq[-1] == t:
                        new_seq = seq
                    else:
                        new_seq = seq + (t,)
                if new_seq in new_beams:
                    new_beams[new_seq] = math.log(math.exp(new_beams[new_seq]) + math.exp(lp + lpt))
                else:
                    new_beams[new_seq] = lp + lpt
        beams = sorted(new_beams.items(), key=lambda x: -x[1])[:beam_width]
    best = beams[0][0]
    return "".join(VOCAB[i] for i in best)


def wer(ref, hyp):
    r = ref.split()
    h = hyp.split()
    nr = len(r)
    if nr == 0:
        return 0.0 if not h else 1.0
    dp = [[0] * (len(h) + 1) for _ in range(nr + 1)]
    for i in range(nr + 1):
        dp[i][0] = i
    for j in range(len(h) + 1):
        dp[0][j] = j
    for i in range(1, nr + 1):
        for j in range(1, len(h) + 1):
            cost = 0 if r[i - 1] == h[j - 1] else 1
            dp[i][j] = min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost)
    return dp[nr][len(h)] / nr


def one_hot_like(char, noise=0.02, vocab_size=len(VOCAB)):
    base = [noise] * vocab_size
    idx = VOCAB.index(char)
    base[idx] = 1.0 - noise * (vocab_size - 1)
    return base


def build_frame_probs(target, duration_per_char=3, blank_runs=1):
    random.seed(0)
    frames = []
    for c in target:
        for _ in range(duration_per_char):
            frames.append(one_hot_like(c))
        for _ in range(blank_runs):
            frames.append(one_hot_like("_"))
    return frames


def corrupt(probs, n_swaps=3, swap_strength=0.4):
    random.seed(1)
    out = [list(p) for p in probs]
    for _ in range(n_swaps):
        i = random.randrange(len(out))
        j1 = random.randrange(len(out[i]))
        j2 = random.randrange(len(out[i]))
        swap = swap_strength
        out[i][j1] -= swap
        out[i][j2] += swap
    return out


def main():
    target = "hello world"
    print("=== Step 1: build per-frame CTC outputs for target ===")
    print(f"  target: {target!r}")
    probs = build_frame_probs(target, duration_per_char=3, blank_runs=1)
    print(f"  frames: {len(probs)}  vocab: {len(VOCAB)}  (index 0 = blank)")

    print()
    print("=== Step 2: greedy decode (collapse repeats, drop blank) ===")
    greedy = ctc_greedy(probs)
    print(f"  greedy decode: {greedy!r}")

    print()
    print("=== Step 3: beam search decode (width 8, simplified) ===")
    beam = ctc_beam(probs, beam_width=8)
    print(f"  beam decode:   {beam!r}")
    print(f"  note: this beam merges consecutive repeats without a blank-intervene state;")
    print(f"  a proper prefix-tree beam (e.g. ctcdecode) tracks P_blank / P_nonblank and")
    print(f"  preserves double letters like the two l's in 'hello'.")

    print()
    print("=== Step 4: corrupt logits; beam should beat greedy ===")
    corrupted = corrupt(probs, n_swaps=6, swap_strength=0.6)
    g2 = ctc_greedy(corrupted)
    b2 = ctc_beam(corrupted, beam_width=16)
    print(f"  greedy: {g2!r}")
    print(f"  beam:   {b2!r}")

    print()
    print("=== Step 5: WER ===")
    ref = "hello world this is a test"
    hyps = {
        "perfect":      "hello world this is a test",
        "one substit":  "hello world this is the test",
        "one deletion": "hello world this a test",
        "one insert":   "hello world this is a big test",
        "garbage":      "bye everyone nothing here",
    }
    for label, hyp in hyps.items():
        print(f"  {label:<14} WER = {wer(ref, hyp):.3f}  hyp={hyp!r}")

    print()
    print("=== Step 6: best model on LibriSpeech test-clean (2026) ===")
    table = [
        ("Parakeet-TDT-1.1B", 1.40, "1.1B"),
        ("Canary-1B Flash",   1.48, "1B"),
        ("Whisper-L-v3-turbo", 1.58, "809M"),
        ("Seamless M4T v2",    1.70, "2.3B"),
        ("wav2vec 2.0 Large",  1.92, "317M"),
    ]
    print("  | Model                 | WER  | Params |")
    for name, w, p in table:
        print(f"  | {name:<21} | {w:.2f} | {p:<6} |")


if __name__ == "__main__":
    main()
