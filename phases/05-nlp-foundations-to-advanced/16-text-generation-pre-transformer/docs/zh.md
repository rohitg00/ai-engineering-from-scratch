# Transformer 之前的文本生成 —— N-gram 语言模型

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 如果一个词出现得令人意外，那模型就不好。Perplexity（困惑度）把「意外」变成数字。Smoothing（平滑）让它保持有限。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## 问题（The Problem）

在 transformer 之前、RNN 之前、word embedding（词嵌入）之前，语言模型预测下一个词的方式就是：数一数它在前 `n-1` 个词之后出现的频次。比如 "the cat" → "sat" 出现 47 次，"the cat" → "jumped" 出现 12 次，"the cat" → "refrigerator" 出现 0 次。归一化一下就得到一个概率分布。

这就是 n-gram 语言模型。从 1980 年到 2015 年，每一个语音识别器、每一个拼写检查器、每一个基于短语的机器翻译系统都跑着它。直到今天，当你需要一个廉价的端上语言模型时，它依然在跑。

真正有意思的问题是：怎么处理没见过的 n-gram？纯计数模型对任何没见过的序列都赋予零概率，这非常致命——句子很长，几乎每一个长句都至少包含一个没见过的序列。五十年的 smoothing 研究就是在解决这个问题。Kneser-Ney smoothing 是最终结晶，而现代深度学习继承了它的实证传统。

## 概念（The Concept）

![N-gram model: count, smooth, generate](../assets/ngram.svg)

**N-gram 概率：** `P(w_i | w_{i-n+1}, ..., w_{i-1})`。固定 `n`（trigram 通常取 3，4-gram 取 4）。从计数算出：

```text
P(w | context) = count(context, w) / count(context)
```

**零计数问题。** 任何在训练里没见过的 n-gram 都会拿到零概率。2007 年一项基于 Brown 语料的研究发现，即便是 4-gram 模型，留出集中也有 30% 的 4-gram 是训练里没见过的。不平滑的话，你根本没法在任何真实文本上做评估。

**Smoothing 方法，按精巧程度排序：**

1. **Laplace（add-one，加一平滑）。** 对每个计数加 1。简单，但在罕见事件上表现很差。
2. **Good-Turing。** 根据「频次的频次」，把高频事件的概率质量重新分给没见过的事件。
3. **Interpolation（插值）。** 用可调权重把 n-gram、(n-1)-gram 等估计组合起来。
4. **Backoff（回退）。** 如果 n-gram 计数为零，就退到 (n-1)-gram。Katz backoff 把这件事规范化了。
5. **Absolute discounting（绝对折扣）。** 从所有计数里减去一个固定折扣 `D`，把省下的质量分给没见过的事件。
6. **Kneser-Ney。** 绝对折扣 + 一个对低阶模型的巧妙选择：用 *continuation probability（延续概率）*（一个词出现在多少种 context 里）来代替原始频次。

Kneser-Ney 的 insight 很深刻。"San Francisco" 是常见的 bigram。Unigram "Francisco" 几乎只在 "San" 后面出现。朴素的绝对折扣会给 "Francisco" 高的 unigram 概率（因为它频次高）。Kneser-Ney 注意到 "Francisco" 只在一种 context 里出现，因此相应降低它的延续概率。结果就是：一个新的、以 "Francisco" 结尾的 bigram 会得到合适的低概率。

**评估：perplexity（困惑度）。** 留出测试集上每个词平均负对数似然的指数。越低越好。Perplexity 等于 100 意味着：这个模型有多迷茫呢？就跟你在 100 个词里均匀乱猜一样。

```text
perplexity = exp(- (1/N) * Σ log P(w_i | context_i))
```

## 动手实现（Build It）

### 第 1 步：trigram 计数

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

输入是一个 tokenize 过的句子列表。输出是 n-gram 计数和 context 计数。`<s>` 和 `</s>` 是句子边界。

### 第 2 步：Laplace smoothing

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

每个计数加 1。能起到平滑作用，但分配给未见事件的质量太多，连带把已见的罕见事件也压低了。

### 第 3 步：Kneser-Ney（bigram，插值版）

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

三个要害零件。`continuation_prob` 捕捉「这个词出现在多少种不同的 context 里？」（这是 Kneser-Ney 的创新点）。`lambda_prev` 是折扣释放出来的概率质量，用来给回退项加权。最终概率 = 折扣后的主项 + 加权的延续项。

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

按概率正比采样。每个 seed 给出不同输出。如果想要类似 beam search 的输出，每步取 argmax（贪心），再加一个小小的随机性旋钮（temperature）。

### 第 5 步：perplexity

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

越低越好。在 Brown 语料上，一个调好的 4-gram KN 模型 perplexity 大约在 140。同一测试集上，transformer LM 能打到 15-30。差距大约 10 倍。这个差距正是这个领域转向的原因。

## 用起来（Use It）

- **经典 NLP 教学。** 你能找到的对 smoothing、MLE（极大似然估计）和 perplexity 最清晰的入门展示。
- **KenLM。** 生产级 n-gram 库。在对 latency（延迟）敏感的语音和 MT 系统里，常被用作 rescorer（重打分器）。
- **端上自动补全。** 键盘里的 trigram 模型。直到今天还在用。
- **Baseline（基线）。** 在宣称你的神经 LM 很好之前，永远先算一个 n-gram LM 的 perplexity。如果你的 transformer 没有以明显优势超过 KN，说明哪里出问题了。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **简单。** 在一个 1,000 句的莎士比亚语料上训练一个 trigram LM。生成 20 个句子。它们会局部看着像那么回事，整体却不知所云。这是经典 demo。
2. **中等。** 在留出的莎士比亚切分上为你的 KN 模型实现 perplexity。和 Laplace 比一比。你应该能看到 KN 把 perplexity 降低 30-50%。
3. **困难。** 构建一个 trigram 拼写纠错器：给定一个拼错的词和它的上下文，生成候选纠正项，并按 LM 下的上下文概率排序。在 Birkbeck 拼写语料（公开）上做评估。

## 关键术语（Key Terms）

| 术语 | 大家常说 | 它实际是什么 |
|------|-----------------|-----------------------|
| N-gram | 词序列 | 由 `n` 个连续 token 组成的序列。 |
| Smoothing | 避免零 | 重新分配概率质量，让没见过的事件也有非零概率。 |
| Perplexity | LM 质量指标 | 留出数据上 `exp(-平均 log-prob)`。越低越好。 |
| Backoff | 退回更短的 context | 如果 trigram 计数为零，就用 bigram。Katz backoff 把它形式化了。 |
| Kneser-Ney | n-gram 最佳 smoothing | 绝对折扣 + 给低阶模型用 continuation probability。 |
| Continuation probability | KN 专属 | `P(w)` 由「`w` 出现在多少种 context 里」加权，而不是原始频次。 |

## 延伸阅读（Further Reading）

- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf) —— n-gram LM 和 smoothing 的经典处理。
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739) —— 这篇论文奠定了 Kneser-Ney 作为最佳 n-gram smoother 的地位。
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394) —— 原始 KN 论文。
- [KenLM](https://kheafield.com/code/kenlm/) —— 快速的生产级 n-gram LM，2026 年仍在 latency 敏感的应用里使用。
