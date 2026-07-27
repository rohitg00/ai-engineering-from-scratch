# Transformer 时代之前的文本生成——N-gram 语言模型

> 如果一个词让人感到意外，说明模型不够好。困惑度（Perplexity）把这种意外量化为一个数字，而平滑（Smoothing）则让它保持有限。

**类型：** 构建
**语言：** Python
**前置要求：** Phase 5 • 01（文本处理），Phase 2 • 14（朴素贝叶斯）
**时间：** ~45 分钟

## 问题

在 Transformer、RNN 和词嵌入出现之前，语言模型通过统计前 `n-1` 个词之后跟随某个词的频次来预测下一个词。统计 "the cat" → "sat" 47 次，"the cat" → "jumped" 12 次，"the cat" → "refrigerator" 0 次。归一化后得到概率分布。

这就是一个 n-gram 语言模型。从 1980 年到 2015 年，它驱动着每一套语音识别系统、每一套拼写检查器和每一套基于短语的机器翻译系统。当你需要廉价的端侧语言建模时，它仍然在运行。

有趣的问题是如何处理未见过的 n-gram。原始的基于计数的模型会给任何未见过的序列分配零概率，这是灾难性的——因为句子很长，几乎每个长句都包含至少一个未见过的序列。五十年的平滑研究解决了这个问题，Kneser-Ney 平滑就是这一研究的成果，现代深度学习继承了其实证传统。

## 概念

![N-gram 模型：计数、平滑、生成](../assets/ngram.svg)

**N-gram 概率：** `P(w_i | w_{i-n+1}, ..., w_{i-1})`。固定 `n`（trigram 通常取 3，4-gram 取 4）。从计数中计算：

```text
P(w | context) = count(context, w) / count(context)
```

**零计数问题。** 任何在训练中未出现的 n-gram 概率为零。2007 年一项关于 Brown 语料库的研究发现，即使是 4-gram 模型，也有 30% 的留出 4-gram 在训练中未见。没有平滑，你无法在真实文本上进行评估。

**平滑方法，按复杂度排序：**

1. **Laplace（加一平滑）。** 给每个计数加 1。简单，但对稀有事件效果很差。
2. **Good-Turing。** 根据"频率的频次"，将概率质量从高频事件重新分配给未见事件。
3. **插值法。** 结合 n-gram、(n-1)-gram 等的估计，使用可调权重。
4. **回退法。** 如果 n-gram 计数为零，则回退到 (n-1)-gram。Katz 回退对此进行了归一化。
5. **绝对折扣。** 从所有计数中减去一个固定的折扣 `D`，重新分配给未见事件。
6. **Kneser-Ney。** 绝对折扣加上对低阶模型的巧妙选择：使用*延续概率*（一个词出现在多少个不同的上下文中）代替原始频次。

Kneser-Ney 的洞察很深刻。"San Francisco" 是一个常见的 bigram。Unigram "Francisco" 主要出现在 "San" 之后。朴素的绝对折扣给 "Francisco" 很高的 unigram 概率（因为计数高）。Kneser-Ney 注意到 "Francisco" 只出现在一个上下文中，于是相应降低其延续概率。结果：一个以 "Francisco" 结尾的新 bigram 获得适当的低概率。

**评估：困惑度。** 在留出测试集上，每个词的平均负对数似然的指数。越低越好。困惑度为 100 意味着模型如同在 100 个词中均匀随机选择时那样困惑。

```text
perplexity = exp(- (1/N) * Σ log P(w_i | context_i))
```

```figure
ngram-backoff
```

## 动手构建

### 步骤 1：trigram 计数

```python
from collections import Counter, defaultdict


def train_ngram(corpus_tokens, n=3):
    ngrams = Counter()
    contexts = Counter()
    for sentence in corpus_tokens:
        padded = ["<s>"] * (n - 1) + sentence + ["</s>"]
        for i in range(len(padded) - n + 1):
            ctx = tuple(padded[i:i + n - 1])
            word = padded[i + n - 1]
            ngrams[ctx + (word,)] += 1
            contexts[ctx] += 1
    return ngrams, contexts


def raw_probability(ngrams, contexts, context, word):
    ctx = tuple(context)
    if contexts.get(ctx, 0) == 0:
        return 0.0
    return ngrams.get(ctx + (word,), 0) / contexts[ctx]
```

输入是一个经过 tokenize 的句子列表。输出是 n-gram 计数和上下文计数。`<s>` 和 `</s>` 是句子边界。

### 步骤 2：Laplace 平滑

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

给每个计数加 1。虽然平滑了，但过度分配给未见事件，也损害了已知的稀有事件。

### 步骤 3：Kneser-Ney（bigram，插值版本）

```python
def kneser_ney_bigram_model(corpus_tokens, discount=0.75):
    unigrams = Counter()
    bigrams = Counter()
    unigram_contexts = defaultdict(set)

    for sentence in corpus_tokens:
        padded = ["<s>"] + sentence + ["</s>"]
        for i, w in enumerate(padded):
            unigrams[w] += 1
            if i > 0:
                prev = padded[i - 1]
                bigrams[(prev, w)] += 1
                unigram_contexts[w].add(prev)

    total_unique_bigrams = sum(len(ctx_set) for ctx_set in unigram_contexts.values())
    continuation_prob = {
        w: len(ctx_set) / total_unique_bigrams for w, ctx_set in unigram_contexts.items()
    }

    context_totals = Counter()
    for (prev, w), count in bigrams.items():
        context_totals[prev] += count

    unique_follow = defaultdict(set)
    for (prev, w) in bigrams:
        unique_follow[prev].add(w)

    def prob(prev, w):
        count = bigrams.get((prev, w), 0)
        denom = context_totals.get(prev, 0)
        if denom == 0:
            return continuation_prob.get(w, 1e-9)
        first_term = max(count - discount, 0) / denom
        lambda_prev = discount * len(unique_follow[prev]) / denom
        return first_term + lambda_prev * continuation_prob.get(w, 1e-9)

    return prob
```

三个关键部分。`continuation_prob` 捕捉"这个词出现在多少个不同的上下文中？"（Kneser-Ney 的创新）。`lambda_prev` 是折扣释放出的概率质量，用于加权回退。最终概率是折扣后的主项加上加权的延续项。

### 步骤 4：通过采样生成文本

```python
import random


def generate(prob_fn, vocab, prefix, max_len=30, seed=0):
    rng = random.Random(seed)
    tokens = list(prefix)
    for _ in range(max_len):
        candidates = [(w, prob_fn(tokens[-1], w)) for w in vocab]
        total = sum(p for _, p in candidates)
        r = rng.random() * total
        acc = 0.0
        for w, p in candidates:
            acc += p
            if r <= acc:
                tokens.append(w)
                break
        if tokens[-1] == "</s>":
            break
    return tokens
```

按概率比例采样。每个种子产生不同的输出。如需类似 beam-search 的输出，每一步选取 argmax（贪心），并添加一个小的随机性旋钮（temperature）。

### 步骤 5：困惑度

```python
import math


def perplexity(prob_fn, sentences):
    total_log_prob = 0.0
    total_tokens = 0
    for sentence in sentences:
        padded = ["<s>"] + sentence + ["</s>"]
        for i in range(1, len(padded)):
            p = prob_fn(padded[i - 1], padded[i])
            total_log_prob += math.log(max(p, 1e-12))
            total_tokens += 1
    return math.exp(-total_log_prob / total_tokens)
```

越低越好。在 Brown 语料库上，调优良好的 4-gram KN 模型困惑度约 140。Transformer LM 在相同测试集上达到 15-30。差距约 10 倍。正是这个差距推动了这个领域的前进。

## 应用场景

- **经典 NLP 教学。** 你能得到的最清晰的平滑、MLE 和困惑度讲解。
- **KenLM。** 生产级 n-gram 库。在低延迟至关重要的语音和机器翻译系统中用作 rescoring 工具。
- **端侧自动补全。** 键盘上的 trigram 模型。至今仍在用。
- **基准线。** 在宣称你的神经 LM 很好之前，务必先计算 n-gram LM 的困惑度。如果你的 transformer 没有大幅超过 KN，那一定有问题。

## 交付检查清单

保存为 `outputs/prompt-lm-baseline.md`：

```markdown
---
name: lm-baseline
description: Build a reproducible n-gram language model baseline before training a neural LM.
phase: 5
lesson: 16
---

Given a corpus and target use (next-word prediction, rescoring, perplexity baseline), output:

1. N-gram order. Trigram for general English, 4-gram if corpus is large, 5-gram for speech rescoring.
2. Smoothing. Modified Kneser-Ney is the default; Laplace only for teaching.
3. Library. `kenlm` for production, `nltk.lm` for teaching, roll your own only to learn.
4. Evaluation. Held-out perplexity with consistent tokenization between train and test sets.

Refuse to report perplexity computed with different tokenization between systems being compared — perplexity numbers are comparable only under identical tokenization. Flag OOV rate in test set; KN handles OOV poorly unless you reserve a special <UNK> token during training.
```

## 练习

1. **简单。** 在 1000 句莎士比亚语料上训练 trigram LM。生成 20 个句子。它们在局部上看似合理，但全局上不连贯。这是经典的演示。
2. **中等。** 在留出的莎士比亚测试集上为你的 KN 模型实现困惑度计算。与 Laplace 对比。你应该会看到 KN 的困惑度低 30-50%。
3. **困难。** 构建一个 trigram 拼写校正器：给定拼写错误的词及其上下文，生成候选改正词，并根据 LM 下的上下文概率排序。在 Birkbeck 拼写语料库（公开）上评估。

## 关键术语

| 术语 | 表面含义 | 实际含义 |
|------|-----------------|-----------------------|
| N-gram | 词序列 | `n` 个连续 token 组成的序列。 |
| Smoothing | 避免零概率 | 重新分配概率质量，使未见事件获得非零概率。 |
| Perplexity | 语言模型质量指标 | 留出数据上的 `exp(-average log-prob)`。越低越好。 |
| Backoff | 回退到更短的上下文 | 如果 trigram 计数为零，使用 bigram。Katz backoff 将其形式化。 |
| Kneser-Ney | 最佳的 n-gram 平滑方法 | 绝对折扣 + 低阶模型的延续概率。 |
| Continuation probability | KN 特有 | `P(w)` 按 `w` 出现的上下文数量加权，而非按原始计数。 |

## 延伸阅读

- [Jurafsky 和 Martin — 语音与语言处理，第 3 章（2026 草案）](https://web.stanford.edu/~jurafsky/slp3/3.pdf) — n-gram 语言模型和平滑的权威论述。
- [Chen 和 Goodman（1998）. 语言模型平滑技术的实证研究](https://dash.harvard.edu/handle/1/25104739) — 确立了 Kneser-Ney 为最佳 n-gram 平滑方法的论文。
- [Kneser 和 Ney（1995）. 改进的 M-gram 语言模型回退方法](https://ieeexplore.ieee.org/document/479394) — 原始的 KN 论文。
- [KenLM](https://kheafield.com/code/kenlm/) — 快速的生产级 n-gram LM，2026 年仍用于对延迟敏感的应用。
