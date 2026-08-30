# 16 · Transformer 之前的文本生成——N-gram 语言模型

> 如果一个词出乎意料，那说明模型很差。「困惑度（perplexity）」把这种意外程度量化成一个数字，而「平滑（smoothing）」让它保持有限。

**类型：** 构建
**语言：** Python
**前置：** 第 5 阶段 · 01（文本处理）、第 2 阶段 · 14（朴素贝叶斯）
**时长：** 约 45 分钟

## 问题所在

在 Transformer 之前，在「循环神经网络（RNN）」之前，在词嵌入之前，语言模型预测下一个词的方式是：统计某个词跟在前 `n-1` 个词后面出现的频率。比如统计 "the cat" → "sat" 出现了 47 次，"the cat" → "jumped" 出现了 12 次，"the cat" → "refrigerator" 出现了 0 次。再归一化，就得到一个概率分布。

这就是 N-gram 语言模型。从 1980 年到 2015 年，每一个语音识别器、每一个拼写检查器、每一个基于短语的机器翻译系统都靠它运行。当你需要廉价的端侧语言建模时，它至今仍在运转。

真正有意思的问题在于：如何处理未见过的 n-gram。一个基于原始计数的模型会给它没见过的任何序列分配零概率，这是灾难性的——因为句子很长，几乎每个长句子都至少包含一个未见过的序列。五十年的平滑研究解决了这个问题，「Kneser-Ney 平滑（Kneser-Ney smoothing）」就是其成果，现代深度学习也继承了它那种以实证为本的传统。

## 核心概念

〔图：N-gram 模型：计数、平滑、生成〕

**N-gram 概率：** `P(w_i | w_{i-n+1}, ..., w_{i-1})`。固定 `n`（三元组 trigram 通常取 3，4-gram 取 4）。从计数中计算：

```text
P(w | context) = count(context, w) / count(context)
```

**零计数问题。** 任何在训练中未出现过的 n-gram 都会得到零概率。2007 年一项基于 Brown 语料库的研究发现，即便是 4-gram 模型，留出集中也有 30% 的 4-gram 在训练中从未出现。不做平滑，你就无法在任何真实文本上做评估。

**平滑方法，按精巧程度从低到高排列：**

1. **Laplace（加一平滑）。** 给每个计数加 1。简单，但在罕见事件上表现糟糕。
2. **Good-Turing。** 根据「频次的频次（frequency-of-frequencies）」，把概率质量从高频事件重新分配给未见事件。
3. **插值（Interpolation）。** 用可调权重把 n-gram、(n-1)-gram 等多个估计组合起来。
4. **回退（Backoff）。** 如果 n-gram 计数为零，就回退到 (n-1)-gram。Katz 回退对此做了归一化处理。
5. **绝对折扣（Absolute discounting）。** 从所有计数中减去一个固定折扣 `D`，再把减下来的质量重新分配给未见事件。
6. **Kneser-Ney。** 绝对折扣，外加对低阶模型的一个巧妙选择：用「续接概率（continuation probability）」（某个词出现在多少种上下文中）来取代原始频率。

Kneser-Ney 的洞见很深刻。"San Francisco" 是一个常见的二元组。一元组 "Francisco" 主要出现在 "San" 之后。朴素的绝对折扣会给 "Francisco" 很高的一元组概率（因为它的计数很高）。Kneser-Ney 则注意到 "Francisco" 只出现在一种上下文中，于是相应地降低它的续接概率。结果是：一个以 "Francisco" 结尾的新颖二元组会得到恰当的低概率。

**评估：困惑度。** 它是在留出测试集上每个词平均负对数似然的指数。越低越好。困惑度为 100 意味着模型的困惑程度，相当于它在 100 个词之间做均匀选择时的困惑程度。

```text
perplexity = exp(- (1/N) * Σ log P(w_i | context_i))
```

## 动手构建

### 第 1 步：三元组计数

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

输入是一个由已分词句子组成的列表。输出是 n-gram 计数和上下文计数。`<s>` 和 `</s>` 是句子边界标记。

### 第 2 步：Laplace 平滑

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

给每个计数加 1。它实现了平滑，但给未见事件分配了过多质量，连带也伤害了那些罕见但已知的事件。

### 第 3 步：Kneser-Ney（二元组，插值版）

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

三个活动部件。`continuation_prob` 刻画的是「这个词出现在多少种不同的上下文中？」（这正是 Kneser-Ney 的创新点）。`lambda_prev` 是折扣释放出来的质量，用于给回退项加权。最终概率等于打了折扣的主项，加上加权后的续接项。

### 第 4 步：用采样生成文本

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

按概率成比例地采样。每个随机种子都会给出不同的输出。若想得到类似「束搜索（beam search）」的输出，就在每一步选取 argmax（贪心策略），再加一个小小的随机性旋钮（温度 temperature）。

### 第 5 步：困惑度

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

越低越好。在 Brown 语料库上，一个调优良好的 4-gram KN 模型困惑度约为 140。同一测试集上，一个 Transformer 语言模型困惑度为 15–30。差距大约是 10 倍。正是这个差距，让整个领域转向了别的方向。

## 实际应用

- **经典 NLP 教学。** 这是你能接触到的对平滑、「最大似然估计（MLE）」和困惑度最清晰的讲解。
- **KenLM。** 生产级 n-gram 库。在对低延迟敏感的语音和机器翻译系统中用作重打分器（rescorer）。
- **端侧自动补全。** 键盘里的三元组模型。至今仍在使用。
- **基线。** 在宣称你的神经语言模型很棒之前，永远先算一遍 n-gram 语言模型的困惑度。如果你的 Transformer 没能以很大优势胜过 KN，那肯定哪里出了问题。

## 交付成果

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

1. **简单。** 在一个 1000 句的莎士比亚语料库上训练一个三元组语言模型。生成 20 个句子。它们会在局部上看起来合理，但在整体上不连贯。这是个经典演示。
2. **中等。** 在一个留出的莎士比亚数据划分上，为你的 KN 模型实现困惑度计算。与 Laplace 做对比。你应该会看到 KN 把困惑度降低 30%–50%。
3. **困难。** 构建一个三元组拼写纠错器：给定一个拼错的词及其上下文，生成候选纠正，并按语言模型下的上下文概率排序。在 Birkbeck 拼写语料库（公开）上做评估。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| N-gram | 词序列 | 由 `n` 个连续 token 组成的序列。 |
| 平滑（Smoothing） | 避免出现零 | 重新分配概率质量，使未见事件获得非零概率。 |
| 困惑度（Perplexity） | 语言模型质量指标 | 留出数据上的 `exp(-average log-prob)`。越低越好。 |
| 回退（Backoff） | 退回到更短的上下文 | 如果三元组计数为零，就用二元组。Katz 回退把这一过程形式化。 |
| Kneser-Ney | n-gram 的最佳平滑方法 | 绝对折扣 + 针对低阶模型的续接概率。 |
| 续接概率（Continuation probability） | KN 专有 | 按词 `w` 出现的上下文数量、而非原始计数来加权的 `P(w)`。 |

## 延伸阅读

- [Jurafsky 与 Martin —《Speech and Language Processing》第 3 章（2026 草稿）](https://web.stanford.edu/~jurafsky/slp3/3.pdf) —— 对 n-gram 语言模型与平滑的经典论述。
- [Chen 与 Goodman（1998）。An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) —— 这篇论文确立了 Kneser-Ney 作为最佳 n-gram 平滑方法的地位。
- [Kneser 与 Ney（1995）。Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) —— 最初的 KN 论文。
- [KenLM](https://kheafield.com/code/kenlm/) —— 快速的生产级 n-gram 语言模型，2026 年仍用于对延迟敏感的应用。
