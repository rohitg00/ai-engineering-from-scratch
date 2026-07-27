---
name: skill-ctc-decoder
description: 从头编写贪心搜索和束搜索 CTC 解码器，包括长度归一化
version: 1.0.0
phase: 4
lesson: 19
tags: [ocr, ctc, decoding, sequence-models]
---

# CTC 解码器

提供两种 CTC 输出的解码程序：贪心（快速）和束搜索（在噪声输入上表现更好）。

## 使用时机

- 在自定义 CRNN 输出上运行 OCR 推理。
- 对不同解码器基准测试预训练 OCR 模型。
- 实现简单的束搜索，无需引入 ctcdecode。

## 输入

- `log_probs`：词汇表上的 (T, N, C) log-softmax（按约定，索引 0 为空白）。
- `vocab`：C 个字符的列表。
- `beam_width`（仅束搜索）：通常为 5-10。

## 贪心解码器

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

## 束搜索解码器

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
                            # 情况 1：在相同前缀上保持（从 p_nb 坍缩）
                            upd = new_beams.get(prefix, (-math.inf, -math.inf))
                            new_beams[prefix] = (upd[0], _logsumexp(upd[1], p_nb + p))
                            # 情况 2：通过空白分隔的重复扩展前缀（"a_a" -> "aa"）
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

## 规则

- 在 PyTorch 的 `nn.CTCLoss` 中，CTC 的空白索引按约定为 0。
- 束搜索在低置信度输入上提高准确率；在干净输入上改进小于 1% CER。
- 绝不要将束宽度修剪到 5 以下；低于此值准确率-延迟的权衡趋于平坦。
- 在紧张的延迟预算下运行束搜索时，降级到贪心解码；对大多数生产 OCR 数据而言，质量损失很小。
- 对于大词汇表（3000+ 字符的 CJK），切换到 `ctcdecode`（C++）而非上述纯 Python 版本；Python 束搜索会迅速成为瓶颈。
