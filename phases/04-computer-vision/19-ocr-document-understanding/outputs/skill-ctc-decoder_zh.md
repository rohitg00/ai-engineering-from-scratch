---
name: skill-ctc-decoder
description: 实现CTC解码
version: 1.0.0
phase: 4
lesson: 19
tags: [ocr, ctc, decoding]
---

# CTC解码器

## CTC原理

连接时序分类（CTC）允许输入输出长度不同，无需字符级对齐。

## 解码方法

### 贪婪解码
```python
def greedy_decode(logits, blank=0):
    """
    logits: (T, C) 时间步 x 类别
    """
    pred = logits.argmax(dim=-1)  # (T,)
    
    # 去重并移除blank
    decoded = []
    prev = -1
    for p in pred:
        if p != blank and p != prev:
            decoded.append(p.item())
        prev = p
    
    return decoded
```

### 束搜索解码
```python
from ctcdecode import CTCBeamDecoder

decoder = CTCBeamDecoder(
    labels=['a', 'b', 'c', ...],
    model_path=None,
    alpha=0,
    beta=0,
    cutoff_top_n=40,
    cutoff_prob=1.0,
    beam_width=100,
    num_processes=4,
    blank_id=0,
)

beam_results, beam_scores, timesteps, out_seq_len = decoder.decode(logits)
```

## 关键参数

| 参数 | 作用 | 推荐值 |
|------|------|--------|
| beam_width | 搜索宽度 | 10-100 |
| alpha | 语言模型权重 | 0.5-2.0 |
| beta | 词插入奖励 | 0-2.0 |
