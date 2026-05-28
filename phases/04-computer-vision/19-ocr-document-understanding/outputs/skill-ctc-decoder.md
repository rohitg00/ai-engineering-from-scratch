---
name: skill-ctc-decoder
description: greedy と beam-search CTC decoders を scratch から書く。length normalisation を含む
version: 1.0.0
phase: 4
lesson: 19
tags: [ocr, ctc, decoding, sequence-models]
---

# CTC Decoder

CTC outputs に対して2つの decoding routines を生成します。greedy (高速) と beam (noisy inputs で高品質) です。

## When to use

- custom CRNN outputs で OCR inference を実行する。
- pretrained OCR model を異なる decoders で benchmark する。
- `ctcdecode` を導入せずに simple beam search を実装する。

## Inputs

- `log_probs`: (T, N, C) log-softmax over vocab (慣例として index 0 = blank)。
- `vocab`: C characters の list。
- `beam_width` (beam only): 通常 5-10。

## Greedy decoder

```python
def greedy_ctc_decode(log_probs, vocab, blank=0):
    preds = log_probs.argmax(dim=-1).transpose(0, 1).cpu().tolist()
    out = []
    for seq in preds:
        decoded = []
        prev = None
        for idx in seq:
            if idx != prev and idx != blank:
                decoded.append(vocab[idx])
            prev = idx
        out.append("".join(decoded))
    return out
```

## Beam search decoder

```python
import heapq
import math

def beam_ctc_decode(log_probs, vocab, beam_width=5, blank=0):
    T, N, C = log_probs.shape
    lp = log_probs.cpu()
    results = []
    for n in range(N):
        beams = {("",): (0.0, -math.inf)}  # (prefix_tuple) -> (p_blank, p_nonblank)
        for t in range(T):
            logits_t = lp[t, n]
            new_beams = {}
            for prefix, (p_b, p_nb) in beams.items():
                for c in range(C):
                    p = logits_t[c].item()
                    if c == blank:
                        nb = p_b + p
                        nnb = p_nb + p
                        upd = new_beams.get(prefix, (-math.inf, -math.inf))
                        new_beams[prefix] = (
                            _logsumexp(upd[0], _logsumexp(nb, nnb)),
                            upd[1],
                        )
                    else:
                        last = prefix[-1] if prefix else ""
                        char = vocab[c]
                        if char == last:
                            # Case 1: stay on same prefix (collapse from p_nb)
                            upd = new_beams.get(prefix, (-math.inf, -math.inf))
                            new_beams[prefix] = (upd[0], _logsumexp(upd[1], p_nb + p))
                            # Case 2: extend prefix via blank-separated repeat ("a_a" -> "aa")
                            new_prefix = prefix + (char,)
                            upd = new_beams.get(new_prefix, (-math.inf, -math.inf))
                            new_beams[new_prefix] = (upd[0], _logsumexp(upd[1], p_b + p))
                        else:
                            new_prefix = prefix + (char,)
                            upd = new_beams.get(new_prefix, (-math.inf, -math.inf))
                            nb = _logsumexp(p_b, p_nb) + p
                            new_beams[new_prefix] = (upd[0], _logsumexp(upd[1], nb))
            beams = dict(heapq.nlargest(
                beam_width,
                new_beams.items(),
                key=lambda kv: _logsumexp(kv[1][0], kv[1][1]),
            ))
        best = max(beams.items(), key=lambda kv: _logsumexp(kv[1][0], kv[1][1]))[0]
        results.append("".join(best))
    return results


def _logsumexp(a, b):
    if a == -math.inf: return b
    if b == -math.inf: return a
    m = max(a, b)
    return m + math.log(math.exp(a - m) + math.exp(b - m))
```

## Rules

- CTC の blank index は PyTorch の `nn.CTCLoss` では慣例として 0 です。
- Beam search は low-confidence inputs で accuracy を改善します。clean inputs では改善は <1% CER です。
- beam を 5 未満に prune しないこと。accuracy-latency trade-off はその下で平坦になります。
- tight latency budget の中で beam search を実行する場合は greedy に落とすこと。ほとんどの production OCR data では品質低下は小さいです。
- 大きな vocabularies (3000+ characters の CJK) では、上の pure Python version ではなく `ctcdecode` (C++) に切り替えること。Python beam はすぐ bottleneck になります。
