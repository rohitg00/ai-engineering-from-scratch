# Text Generation Before Transformers — N-gram Language Models

> 如果一个词令人惊讶，那么这个模型就是糟糕的。困惑使惊喜成为数字。平滑使其保持有限。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 01（文本处理）、阶段2 · 14（天真的Bayes）
** 时间：** ~45分钟

## The Problem

在变形金刚之前、RNN之前、单词嵌入之前，语言模型通过计算下一个单词跟随在前一个“n-1”单词之后的频率来预测下一个单词。数“猫”-“坐”47次，“猫”-“跳”12次，“猫”-“冰箱”0次。标准化以获得概率分布。

这是一个n-gram语言模型。它运行了1980年至2015年期间的所有语音识别器、所有拼写检查器和所有基于短语的机器翻译系统。当您需要廉价的设备上语言建模时，它仍然运行。

有趣的问题是如何处理看不见的n元语法。基于计数的原始模型将零概率分配给它未见过的任何内容，这是灾难性的，因为句子很长，而且几乎每个长句子都至少包含一个未看到的序列。五十年的平滑研究解决了这个问题。Kneser-Ney平滑是结果，现代深度学习继承了其经验传统。

## The Concept

![N-gram model: count, smooth, generate](../assets/ngram.svg)

** N语法概率：**' P（w_i| w_{i-n+1}，.，w_{i-1}）'。修复' n '（通常3代表八卦，4代表4克）。根据计数计算：

```text
P(w | context) = count(context, w) / count(context)
```

** 零计数问题。**训练中未看到的任何n元语法的概率为零。2007年对布朗数据库的一项研究发现，即使是4克模型，也有30%的4克在训练中看不见。如果不平滑，您就无法对任何真实文本进行评估。

** 平滑方法，按复杂程度顺序：**

1. ** 拉普拉斯（加一）。**每个计数加1。简单，在罕见事件中很糟糕。
2. ** 古德-图灵。**根据频率的频率将概率质量从高频事件重新分配到不可见事件。
3. ** 内插。**结合n-gram、（n-1）-gram等，具有可调权重的估计。
4. ** 后退。**如果n-gram计数为零，则退回到（n-1）-gram。Katz backoff将此正常化。
5. ** 绝对折扣。**从所有计数中减去固定折扣“D”，重新分配到未显示的折扣。
6. ** 克内瑟-内伊。**绝对折扣加上较低阶模型的巧妙选择：使用 * 延续概率 *（一个词出现在多少个上下文中）而不是原始频率。

Kneser-Ney的洞察力很深。“旧金山”是一个常见的二元组合。Unigram“Francisco”主要出现在“San”之后。“天真的绝对折扣给了“弗朗西斯科”很高的单字概率（因为计数很高）。Kneser-Ney注意到“Francisco”仅出现在一种上下文中，并相应降低了其延续的可能性。结果：以“弗朗西斯科”结尾的新颖二元组合获得适当的低概率。

** 评价：困惑。**已发布的测试集中每个单词的平均负对log似然的指数。低越好。困惑度为100意味着模型与在100个单词中均匀选择一样混乱。

```text
perplexity = exp(- (1/N) * Σ log P(w_i | context_i))
```

## Build It

### Step 1: trigram counts

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

输入是标记化句子的列表。输出是n-gram计数和上下文计数。&#39;<s>和&#39;</s>是句子边界。

### Step 2: Laplace smoothing

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

每个计数加1。平滑但将质量过度分配给看不见的事件，也损害了罕见的事件。

### Step 3: Kneser-Ney (bigram, interpolated)

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

三个活动部分。' continuation_prob '捕捉到“这个词出现在多少种不同的上下文中？”（Kneser-Ney创新）。' lambda_prev '是折扣释放的质量，用于加权回退。最终的概率是贴现的主要期限加上加权的继续期限。

### Step 4: generating text with sampling

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

抽样与概率成比例。每个种子总是给出不同的产量。对于类似束搜索的输出，请在每一步选择argmax（贪婪）并添加一个小的随机性旋钮（温度）。

### Step 5: perplexity

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

低越好。对于Brown数据库，经过精心调整的4克KN模型的困惑度约为140。Transformer LM在同一测试集中达到15-30。差距约为10倍。这个差距就是这个领域继续前进的原因。

## Use It

- ** 经典NLP教学。**您可以获得的最清晰的平滑、MLE和困惑。
- ** 肯勒姆。**生产n-gram库。在低延迟很重要的语音和MT系统中用作重采样器。
- ** 设备上自动完成。**键盘中的三格模型。别动
- ** 基线。**在宣布您的神经LM良好之前，请务必计算n-gram LM困惑度。如果你的Transformer没有击败KN的一个很大的利润，有些事情是错误的。

## Ship It

另存为“输出/prompt-lm-baseline.md”：

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

## Exercises

1. ** 简单。**在1，000句莎士比亚文集上训练一个三格LM。生成20个句子。它们在局部上看似合理，但在全球范围内却不连贯。这是典型的演示。
2. ** 中等。**在莎士比亚分裂中为您的KN模型实现困惑。与拉普拉斯相比。您应该看到KN的困惑度降低了30- 50%。
3. ** 很难。**构建一个三格拼写纠正器：给定拼写错误的单词及其上下文，生成纠正并根据LM下的上下文概率进行排名。在伯克贝克拼写库上进行评估（公共）。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| N-gram | 单词序列 | “n”个连续代币的序列。 |
| 平滑 | 避免零 | 重新分配概率质量，以便不可见的事件获得非零概率。 |
| 困惑 | LM质量指标 | ' BEP（-平均log-prob）'关于已发布的数据。低越好。 |
| 退避 | 退回到更短的上下文 | 如果trigram count为零，则使用bigram。Katz后退正式化了这一点。 |
| 克内瑟-内伊 | n元语法的最佳平滑 | 绝对折扣+低位模型的延续概率。 |
| 连续概率 | KN特定 | ' P（w）'由'出现的上下文数量加权，而不是由原始计数加权。 |

## Further Reading

- [Jurafsky和Martin -语音和语言处理，第3章（2026年草案）]（https：//web.stanford.edu/jurafsky/slp3/3.pdf）-n-gram LM的规范处理和平滑。
- [Chen和古德曼（1998）。语言建模平滑技术的实证研究]（https：//dash.harvard.edu/guard/1/25104739）-这篇论文将Kneser-Ney确定为最好的n-gram平滑器。
- [Kneser和Ney（1995）。M-gram语言建模的改进后退]（https：//ieeeexplore.ieee.org/document/479394）-KN原始论文。
- [KenLM]（https：//khafield.com/code/kenlm/）-快速生产n-gram LM，2026年仍用于延迟敏感应用程序。
