# Transformer 出现之前的文本生成 — N-gram 语言模型

> 如果一个词令人惊讶，说明模型不好。困惑度把惊讶变成一个数字。平滑让它保持有限。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 01（文本处理）， Phase 2 · 14（朴素贝叶斯）
**Time:** 约 45 分钟

## 问题

在 Transformer、RNN、词向量出现之前，语言模型通过统计下一个词在前 `n-1` 个词之后出现的频率来预测下一个词。统计 "the cat" → "sat" 出现 47 次，"the cat" → "jumped" 出现 12 次，"the cat" → "refrigerator" 出现 0 次。归一化后得到概率分布。

这就是 n-gram 语言模型。从 1980 年到 2015 年，它驱动着每一个语音识别器、每一个拼写检查器和每一个基于短语的机器翻译系统。当你需要廉价的设备端语言建模时，它至今仍在运行。

有趣的问题是如何处理未见过的 n-gram。原始的基于计数的模型会给任何没见过的内容分配零概率，这是灾难性的，因为句子很长，而几乎每个长句都至少包含一个未见过的序列。五十年的平滑研究解决了这个问题。其成果就是 Kneser-Ney 平滑，而现代深度学习继承了它的实证传统。

## 概念

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### 预测游戏

在这些机制出现之前，一个实验定义了什么是语言模型。遮住英文句子的下一个字母，让人一次一次地猜，直到猜对为止。记下猜测次数。对几百个字母重复此过程。

猜测次数不是冷知识。它们是文本的无损重编码：把次数序列交给第二个同样的猜测者，他就能重建每一个字母，因为在每个位置他都确切知道哪些猜测排在前面。能用更少符号重编码的消息，每个符号携带的信息更少，因此猜测次数统计为英语的熵设定了上限。

Shannon 在 1951 年做了这个实验，得到了一个至今仍主导该领域的数字。一个 27 符号的字母表（26 个字母加空格）每个字母可携带 `log2(27) ≈ 4.75` 比特。拥有 100 个字母上下文的人类猜测者落在每字母 0.6 到 1.3 比特之间。英语大约四分之三是被迫的移动。模型必须学习的结构在任何模型能够学习它之前就被测量出来了。

此后每一个语言模型都是这场游戏的机械玩家，本课中的每一个评估指标都是这场游戏的得分：

- **交叉熵损失**是模型每个符号所需的平均比特数。训练语言模型实际上就是在最小化它在猜测游戏中的得分。
- **困惑度**是 `2^bits`（或 `e^nats`）：模型做完猜测后仍然面临的分支因子。在 27 个符号上均匀猜测的困惑度是 27；每字母 1 比特的玩家困惑度为 2。
- **上下文长度就是玩家的记忆。** trigram 模型用两个 token 的记忆来玩。Transformer 用 100K 个 token 玩同样的游戏。规则从未改变；玩家变强了。

需要注意的单位转换：游戏按每字母比特（`log2`）计分，而下面的 n-gram 公式按每个词 token 的 nat（自然对数）计分 —— 由于困惑度用 nat 表示时等于用比特表示的 `2^H` 乘以 `e^H`，这两种视角是同一测量在不同单位下的表现。

```figure
prediction-game
```

**N-gram 概率：** `P(w_i | w_{i-n+1}, ..., w_{i-1})`。固定 `n`（trigram 通常为 3,4-gram 为 4）。从计数计算：

```text
P(w | context) = count(context, w) / count(context)
```

**零计数问题。** 训练中未见过的任何 n-gram 概率为零。2007 年一项关于 Brown 语料库的研究发现，即使是 4-gram 模型，也有 30% 的留出 4-gram 在训练中未出现过。不做平滑就无法在任何真实文本上评估。

**平滑方法，按复杂程度排序：**

1. **Laplace（加一）。** 每个计数加 1。简单，但在罕见事件上表现糟糕。
2. **Good-Turing。** 基于频率的频率，把概率质量从高频事件重新分配给未见事件。
3. **插值。** 用可调权重组合 n-gram、(n-1)-gram 等的估计。
4. **回退。** 如果 n-gram 计数为零，回退到 (n-1)-gram。Katz 回退对此做了规范化。
5. **绝对折扣。** 从所有计数中减去固定折扣 `D`，再分配给未见事件。
6. **Kneser-Ney。** 绝对折扣加上对低阶模型的巧妙选择：使用*延续概率*（一个词出现在多少个上下文中）而不是原始频率。

Kneser-Ney 的洞察很深刻。"San Francisco" 是常见 bigram。Unigram "Francisco" 主要出现在 "San" 之后。朴素的绝对折扣会给 "Francisco" 很高的 unigram 概率（因为计数很高）。Kneser-Ney 注意到 "Francisco" 只出现在一个上下文中，并相应降低其延续概率。结果：以 "Francisco" 结尾的新 bigram 会得到合适的低概率。

**评估：困惑度。** 在留出测试集上每词平均负对数似然的指数。越低越好。困惑度 100 意味着模型的困惑程度相当于在 100 个词中均匀选择。

```text
perplexity = exp(- (1/N) * Σ log P(w_i | context_i))
```

```figure
ngram-backoff
```

## 动手实现

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

输入是分词后的句子列表。输出是 n-gram 计数和上下文计数。`<s>` 和 `</s>` 是句子边界。

### 步骤 2：Laplace 平滑

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

每个计数加 1。有平滑效果，但给未见事件分配了过多概率质量，同时也伤害了已知罕见事件。

### 步骤 3：Kneser-Ney（bigram，插值）

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

三个活动部件。`continuation_prob` 捕捉“这个词出现在多少个不同上下文中？”（Kneser-Ney 的创新点）。`lambda_prev` 是折扣释放出来的概率质量，用于加权回退项。最终概率是折扣后的主项加上加权后的延续项。

### 步骤 4：采样生成文本

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

按概率成比例地采样。每个种子总能产生不同输出。若要类似束搜索的输出，每步取 argmax（贪心）并加一个小的随机性旋钮（temperature）。

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

越低越好。在 Brown 语料库上，调优良好的 4-gram KN 模型困惑度约为 140。Transformer 语言模型在同一测试集上达到 15-30。差距约为 10 倍。这个差距就是该领域转向的原因。

## 应用场景

- **经典 NLP 教学。** 你能获得的关于平滑、MLE 和困惑度的最清晰入门。
- **KenLM。** 生产级 n-gram 库。在延迟敏感的语音和机器翻译系统中用作重排序器。
- **设备端自动补全。** 输入法中的 trigram 模型。至今仍在用。
- **基线。** 在宣称你的神经语言模型很好之前，总是先计算 n-gram 语言模型的困惑度。如果你的 Transformer 没有大幅超过 KN，那就有问题。

## 交付

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

1. **简单。** 在 1,000 句的莎士比亚语料库上训练 trigram 语言模型。生成 20 个句子。它们局部合理但全局不连贯。这是经典的演示。
2. **中等。** 在留出的莎士比亚划分上为你的 KN 模型实现困惑度。与 Laplace 比较。你应该会看到 KN 将困惑度降低 30-50%。
3. **困难。** 构建一个 trigram 拼写纠正器：给定一个拼写错误的词及其上下文，生成纠正候选并按语言模型下的上下文概率排序。在公开的 Birkbeck 拼写语料库上评估。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| N-gram | 词序列 | `n` 个连续 token 的序列。 |
| 平滑 | 避免零 | 重新分配概率质量，使未见事件获得非零概率。 |
| 困惑度 | 语言模型质量指标 | 留出数据上的 `exp(-average log-prob)`。越低越好。 |
| 回退 | 回退到更短上下文 | 如果 trigram 计数为零，使用 bigram。Katz 回退将此形式化。 |
| Kneser-Ney | 最佳 n-gram 平滑方法 | 绝对折扣 + 低阶模型的延续概率。 |
| 延续概率 | KN 特有 | 按 `w` 出现的上下文数量加权的 `P(w)`，而不是按原始计数。 |
| 文本熵 | 每个符号的信息量 | 在给定上下文的情况下编码下一个符号所需的平均比特数。Shannon 1951 年对至多 100 个字母上下文的印刷英语的估计：0.6-1.3 比特/字母，在任何模型存在之前就已测量。 |

## 延伸阅读

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf) —— 定义了每个语言模型至今仍在优化的目标的猜测游戏实验。
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) —— 关于 n-gram 语言模型和平滑的权威论述。
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) —— 确立 Kneser-Ney 为最佳 n-gram 平滑方法的论文。
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) —— KN 的原始论文。
- [KenLM](https://kheafield.com/code/kenlm/) —— 快速的生产级 n-gram 语言模型，2026 年仍用于延迟敏感的应用。