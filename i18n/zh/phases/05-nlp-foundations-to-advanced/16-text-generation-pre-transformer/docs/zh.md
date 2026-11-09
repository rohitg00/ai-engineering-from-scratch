# 转变器之前的文字生成  N-gram语言模型

> 如果一个字令人惊,模型是坏的. 困惑使一个数字惊. 滑滑使它有限.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 01 (Text Processing), Phase 2 · 14 (Naive Bayes)
**Time:** ~45 minutes

## 问题

在变压器之前,RNN之前,词嵌入之前,一个语言模型通过计算它跟上之前的词的频率来预测下一个词`n-1`字数"猫" → "坐" 47 次,"猫" → "跳" 12 次,"猫" → "冰箱" 0 次.正常化以获得概率分布.

这是一个n-gram语言模型. 它运行了每一个语音识别器,每一个拼音检查器,以及每一个基于短语的机器翻译系统, 从1980年到2015年.

问题是如何处理未见的n-gram.一个基于原始数值的模型将未见的任何东西的概率分配为零,这是灾难性的,因为句子长,几乎每个长句子至少包含一个未见的序列.五十年的平滑研究解决了这一问题.Kneser-Ney平滑是结果,现代深度学习继承了它的经验传统.

## 概念

![N-gram model: count, smooth, generate](../assets/ngram.svg)

### 预测游戏

在这种机器出现之前,有一次实验定义了语言模型. 覆盖一个英语句子的下一个字母. 要求别人猜测,一次猜测,直到他们做得好. 写下猜测数量. 重复几百个字母.

猜测数量不是小事.它们是文本的无损重新编码:把数量序列交给第二个相同的猜测器,他们可以重建每个字母,因为在每个位置,他们知道哪些猜测是第一.一个可以重新编码的信息,在更少的符号中,每个符号的信息都少,所以猜测数量统计对英语的位上设置了一个限.

农在1951年进行了这个测试,并得到了一个数字,它仍然统治这个领域.一个27个符号的字母 (26个字母加上空间) 可以携带`log2(27) ≈ 4.75`字母中每位位数.人类猜测100字母的文本,每字母中降落在0.6到1.3位之间.英语是约四分之三的强迫动作.模型必须学习的结构在任何模型都学会之前被测量.

每个语言模型都是这个游戏的机械玩家,

- **Cross-entropy loss**训练一个LM字面上是减少猜测游戏的分数.
- **Perplexity**是`2^bits`(或`e^nats`选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是: 选的方法是:
- **Context length is the player's memory.**两种记忆代币可以使用,一个变压器可以使用100万代币玩,规则从来没有改变,玩家变得更好.

一个单元转换到轨道:每字母的游戏分数 (`log2`),而下面的n-gram公式在 nats (自然日志) 中每字符标记分数,并且由于困难`e^H`在纳斯等级中`2^H`在位中,两个视图在不同的单位中是相同的测量.

```figure
prediction-game
```

**N-gram probability:** `P(w_i | w_{i-n+1}, ..., w_{i-1})`修复`n`根据数值计算:

```math
P(w \mid \text{context}) = \frac{\mathop{\mathrm{count}}(\text{context}, w)}{\mathop{\mathrm{count}}(\text{context})}
```

**The zero-count problem.**任何在训练中没有看到的 n-gram 得到了零的概率.2007年对布朗体的研究发现,即使是4克模型的30%的4克在训练中没有看到.你不能在没有平滑的情况下评估任何真实文本.

**Smoothing approaches, in order of sophistication:**

1. **Laplace (add-one).**增加一个每次数量.
2. **Good-Turing.**根据频率的频率,将更高频率事件的概率量重新分配到未见的事件.
3. **Interpolation.**结合 n-gram, (n-1)-gram等估计和调节可的重量.
4. **Backoff.**如果 n-gram 算是零,则回到 (n-1) - gram.
5. **Absolute discounting.**减去固定折扣`D`对于所有人来说,
6. **Kneser-Ney.**绝对折扣加上低级模型的聪明选择:使用 *延续概率* (单词出现在多少场合) 而不是原始频率.

子-子的洞察力深深. "旧金山"是一个普通的字母. 单形"弗朗西斯科"主要出现在"圣." 无常的绝对折扣给"弗朗西斯科"高单形概率 (因为数量很高). 克内塞-尼指出",弗朗西斯科"只出现在一个背景下,因此降低了其延续可能性. 结果:以"弗朗西斯科"结束的小说大图得到适当的低概率.

**Evaluation: perplexity.**平均负记载概率的指数是每一个字的平均负记载概率.较低的比较好.一个困难度为100意味着模型是像它一样混的,它会在100个字中选择均.

```math
\text{perplexity} = \exp\left(-\frac{1}{N} \sum_i \log P(w_i \mid \text{context}_i)\right)
```

```figure
ngram-backoff
```

## 建立它

### 步骤1:三重数

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

输入是标记式句子的列表. 输出是 n 克数和文本数. `<s>`其他`</s>`它们是句子的边界.

### 步骤2: 拉普拉斯平滑

```python
def laplace_probability(ngrams, contexts, vocab_size, context, word):
    ctx = tuple(context)
    numerator = ngrams.get(ctx + (word,), 0) + 1
    denominator = contexts.get(ctx, 0) + vocab_size
    return numerator / denominator
```

增加1个数量, 顺利,但过度分配质量, 给未见的事件,

### 步骤3:Kneser-Ney (大图,插入)

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

三个移动部分.`continuation_prob`现在,我们在研究中发现了"这个词在多少不同的环境中出现?" (Kneser-Ney创新).`lambda_prev`基本的概率是减产的主要术语加上加权延续术语.

### 步骤4:通过采样生成文本

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

采样与概率相对.每种种子总是产生不同的输出. 为了像光束搜索的输出,在每个步骤中选择 argmax (贪) 并添加一个小的随机性按 (温度).

### 步骤5:困惑

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

对于布朗体,一个精确调整的4克KN模型达到140左右的困难.一个变压器LM在同一测试组上达到15-30分.差距大约是10倍.这差距是为什么场移动.

## 用它

- **Classical NLP teaching.**您可以得到最明显的光滑,MLE和困惑.
- **KenLM.**作为语音和MT系统的回数器,低延迟的重要.
- **On-device autocomplete.**键盘中的三重图模型.
- **Baselines.**如果你的变压器没有超过KN,那么有些问题.

## 运送它

保存如`outputs/prompt-lm-baseline.md`其他:

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

## 运动

1. **Easy.**训练一个三重形 LM 在一个1000句的莎士比亚体. 产生20句. 他们将是本地可信的,但全球不一致.这是正宗的演示.
2. **Medium.**根据Shakespeare的分数,将KN模型的复杂性实现.
3. **Hard.**建立一个三重形字母拼写校正器:给出错误拼写的词及其背景,在LM下生成对照和根据背景概率排名.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| N-gram | Word sequence | Sequence of `n` consecutive tokens. |
| Smoothing | Avoiding zeros | Reallocating probability mass so unseen events get non-zero probability. |
| Perplexity | LM quality metric | `exp(-average log-prob)` on held-out data. Lower is better. |
| Backoff | Fallback to shorter context | If trigram count is zero, use bigram. Katz backoff formalizes this. |
| Kneser-Ney | Best smoothing for n-grams | Absolute discounting + continuation probability for the lower-order model. |
| Continuation probability | KN-specific | `P(w)` weighted by number of contexts `w` appears in, not by raw count. |
| Entropy of text | Information per symbol | Average bits needed to encode the next symbol given the context. Shannon's 1951 estimate for printed English with up to 100 letters of context: 0.6-1.3 bits/letter, measured before any model existed. |

## 进一步阅读

- [Shannon (1951). Prediction and Entropy of Printed English](https://www.princeton.edu/~wbialek/rome/refs/shannon_51.pdf)每种语言模型都能优化目标的猜测游戏实验.
- [Jurafsky and Martin — Speech and Language Processing, Chapter 3 (2026 draft)](https://web.stanford.edu/~jurafsky/slp3/3.pdf)可视化处理 n 克LM和滑滑.
- [Chen and Goodman (1998). An Empirical Study of Smoothing Techniques for Language Modeling](https://dash.harvard.edu/handle/1/25104739)是确定Kneser-Ney为最好的 n-gram平滑的论文.
- [Kneser and Ney (1995). Improved Backing-off for M-gram Language Modeling](https://ieeexplore.ieee.org/document/479394)原始 KN 纸.
- [KenLM](https://kheafield.com/code/kenlm/)快速生产n克LM,仍在2026年用于延迟敏感应用.
