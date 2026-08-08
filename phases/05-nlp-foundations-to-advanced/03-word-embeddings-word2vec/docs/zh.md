# 03 · 词嵌入——从零实现 Word2Vec

> 观其伴而知其义。把这个理念交给一个浅层网络去训练，几何结构便自然涌现。

**类型：** 动手构建
**语言：** Python
**前置：** 第 5 阶段 · 02（词袋 + TF-IDF），第 3 阶段 · 03（从零实现反向传播）
**时长：** 约 75 分钟

## 问题所在

TF-IDF 知道 `dog` 和 `puppy` 是两个不同的词，但它不知道二者的含义几乎相同。一个基于 `dog` 训练出来的分类器，无法泛化到一条讲 `puppy` 的评论上。你可以靠手工罗列同义词来打补丁，但这对生僻词、领域术语，以及任何你没有预料到的语言都会失效。

你想要的是这样一种表示：`dog` 和 `puppy` 在空间中彼此靠近；`king - man + woman` 落在 `queen` 附近；一个基于 `dog` 训练的模型，能免费地把一部分信号迁移到 `puppy` 上。

Word2Vec 给了我们这样一个空间。一个两层神经网络，万亿级 token 的训练规模，于 2013 年发表。它的架构简单到近乎令人尴尬，结果却重塑了此后十年的自然语言处理（NLP）。

## 核心概念

**分布假说（distributional hypothesis）**（Firth，1957）：「观其伴而知其义。」如果两个词出现在相似的上下文中，它们的含义大概率也相似。

Word2Vec 有两种形式，都在利用这一理念。

- **Skip-gram。** 给定中心词，预测周围的词。窗口大小为 2 时，`cat -> (the, sat, on)`。
- **CBOW（continuous bag of words，连续词袋）。** 给定周围的词，预测中心词。`(the, sat, on) -> cat`。

Skip-gram 训练更慢，但对生僻词处理得更好，因此成了默认选择。

这个网络只有一个隐藏层，且不带非线性激活。输入是词表上的独热（one-hot）向量，输出是词表上的 softmax。训练完成后，你把输出层丢弃，隐藏层的权重就是嵌入（embedding）。

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          这就是嵌入
```

诀窍在于：在 10 万个词上做 softmax 代价高得离谱。Word2Vec 用**负采样（negative sampling）**把它变成一个二分类任务——预测「这个上下文词是否出现在该中心词附近，是或否」。每个训练对只采样少量负样本（不共现的词），而不是在整个词表上计算 softmax。

## 动手构建

### 第 1 步：从语料生成训练对

```python
def skipgram_pairs(docs, window=2):
    pairs = []
    for doc in docs:
        for i, center in enumerate(doc):
            for j in range(max(0, i - window), min(len(doc), i + window + 1)):
                if i == j:
                    continue
                pairs.append((center, doc[j]))
    return pairs
```

```python
>>> skipgram_pairs([["the", "cat", "sat", "on", "mat"]], window=2)
[('the', 'cat'), ('the', 'sat'),
 ('cat', 'the'), ('cat', 'sat'), ('cat', 'on'),
 ('sat', 'the'), ('sat', 'cat'), ('sat', 'on'), ('sat', 'mat'),
 ...]
```

窗口内每一个 (center, context) 对都是一个正训练样本。

### 第 2 步：嵌入表

需要两个矩阵。`W` 是中心词嵌入表（你要保留的那个），`W'` 是上下文词嵌入表（通常被丢弃，有时会与 `W` 取平均）。

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

用较小的随机值初始化。词表大小 1 万、维度 100 是现实中常见的配置；用于教学时，50 词 × 16 维就足以看出几何结构了。

### 第 3 步：负采样目标函数

对每个正样本对 `(center, context)`，从词表中随机采样 `k` 个词作为负样本。训练模型使点积 `W[center] · W'[context]` 在正样本上偏高、在负样本上偏低。

```python
def sigmoid(x):
    return 1.0 / (1.0 + np.exp(-np.clip(x, -20, 20)))


def train_pair(W, W_prime, center_idx, context_idx, negative_indices, lr):
    v_c = W[center_idx]
    u_pos = W_prime[context_idx]
    u_negs = W_prime[negative_indices]

    pos_score = sigmoid(v_c @ u_pos)
    neg_scores = sigmoid(u_negs @ v_c)

    grad_center = (pos_score - 1) * u_pos
    for i, u in enumerate(u_negs):
        grad_center += neg_scores[i] * u

    W[context_idx] = W[context_idx]
    W_prime[context_idx] -= lr * (pos_score - 1) * v_c
    for i, neg_idx in enumerate(negative_indices):
        W_prime[neg_idx] -= lr * neg_scores[i] * v_c
    W[center_idx] -= lr * grad_center
```

这条神奇的公式是：正样本对上的逻辑损失（希望 sigmoid 接近 1）加上负样本对上的逻辑损失（希望 sigmoid 接近 0）。梯度同时流向两张表。完整推导见原论文；如果你想真正记牢，不妨拿纸笔亲手走一遍。

### 第 4 步：在玩具语料上训练

```python
def train(docs, dim=16, window=2, k_neg=5, epochs=100, lr=0.05, seed=0):
    vocab = build_vocab(docs)
    vocab_size = len(vocab)
    rng = np.random.default_rng(seed)
    W, W_prime = init_embeddings(vocab_size, dim, seed=seed)
    pairs = skipgram_pairs(docs, window=window)

    for epoch in range(epochs):
        rng.shuffle(pairs)
        for center, context in pairs:
            c_idx = vocab[center]
            ctx_idx = vocab[context]
            negs = rng.integers(0, vocab_size, size=k_neg)
            negs = [n for n in negs if n != ctx_idx and n != c_idx]
            train_pair(W, W_prime, c_idx, ctx_idx, negs, lr)
    return vocab, W
```

在大语料上训练足够多轮后，共享上下文的词会拥有相似的中心词嵌入。在玩具语料上，你只能隐约看到这种效果；而在数十亿 token 上，这种效果会非常显著。

### 第 5 步：类比技巧

```python
def nearest(vocab, W, target_vec, topk=5, exclude=None):
    exclude = exclude or set()
    inv_vocab = {i: w for w, i in vocab.items()}
    norms = np.linalg.norm(W, axis=1, keepdims=True) + 1e-9
    W_norm = W / norms
    target = target_vec / (np.linalg.norm(target_vec) + 1e-9)
    sims = W_norm @ target
    order = np.argsort(-sims)
    out = []
    for i in order:
        if i in exclude:
            continue
        out.append((inv_vocab[i], float(sims[i])))
        if len(out) == topk:
            break
    return out


def analogy(vocab, W, a, b, c, topk=5):
    v = W[vocab[b]] - W[vocab[a]] + W[vocab[c]]
    return nearest(vocab, W, v, topk=topk, exclude={vocab[a], vocab[b], vocab[c]})
```

在预训练的 300 维 Google News 向量上：

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

`king - man + woman = queen`。这并不是因为模型懂得王权是什么，而是因为向量 `(king - man)` 捕捉到了某种近似「王室」的东西，把它加到 `woman` 上，便落在了「王室女性」区域附近。

## 实际使用

从零手写 Word2Vec 是为了教学。生产环境的 NLP 用 `gensim`。

```python
from gensim.models import Word2Vec

sentences = [
    ["the", "cat", "sat", "on", "the", "mat"],
    ["the", "dog", "ran", "across", "the", "room"],
]

model = Word2Vec(
    sentences,
    vector_size=100,
    window=5,
    min_count=1,
    sg=1,
    negative=5,
    workers=4,
    epochs=30,
)

print(model.wv["cat"])
print(model.wv.most_similar("cat", topn=3))
```

在真实工作中，你几乎从不自己训练 Word2Vec，而是下载预训练好的向量。

- **GloVe** —— 斯坦福基于共现矩阵分解的方法。提供 50 维、100 维、200 维、300 维的检查点。通用覆盖效果不错。第 04 课会专门讲 GloVe。
- **fastText** —— Facebook 对 Word2Vec 的扩展，它嵌入字符 n-gram。通过组合子词来处理未登录词（out-of-vocabulary）。见第 04 课。
- **Google News 上预训练的 Word2Vec** —— 300 维，300 万词的词表，2013 年发布。至今仍每天被下载。

### 2026 年 Word2Vec 仍占优势的场景

- 轻量级的领域专用检索。在笔记本上花一小时基于医学摘要训练，就能得到通用模型捕捉不到的专业向量。
- 类比式的特征工程。`gender_vector = mean(man - woman pairs)`。把它从其他词中减去，就能得到一个性别中立的轴。这在公平性研究中仍被使用。
- 可解释性。100 维足够小，可以通过 PCA 或 t-SNE 绘图，真切地看到聚类的形成。
- 任何需要在没有 GPU 的设备端运行推理的场合。Word2Vec 的查询只是一次行读取。

### Word2Vec 失效的地方

一词多义（polysemy）这堵墙。`bank` 只有一个向量，`river bank`（河岸）和 `financial bank`（银行）共享它；`table`（电子表格 vs. 家具）也共享它。下游分类器无法从向量中区分这些词义。

上下文嵌入（ELMo、BERT，以及此后的每一个 transformer）解决了这个问题：它根据周围上下文，为词的每一次出现生成不同的向量。这正是从 Word2Vec 到 BERT 的飞跃——从静态到上下文相关。第 7 阶段讲解 transformer 的那一半。

另一个失败是未登录词问题。如果 `Zoomer-approved` 不在训练数据里，Word2Vec 就从未见过它，也没有任何兜底方案。fastText 用子词组合修复了这一点（第 04 课）。

## 交付落地

保存为 `outputs/skill-embedding-probe.md`：

```markdown
---
name: embedding-probe
description: Inspect a word2vec model. Run analogies, find neighbors, diagnose quality.
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

You probe trained word embeddings to verify they are working. Given a `gensim.models.KeyedVectors` object and a vocabulary, you run:

1. Three canonical analogy tests. `king : man :: queen : woman`. `paris : france :: tokyo : japan`. `walking : walked :: swimming : ?`. Report the top-1 result and its cosine.
2. Five nearest-neighbor tests on domain-specific words the user supplies. Print top-5 neighbors with cosines.
3. One symmetry check. `similarity(a, b) == similarity(b, a)` to within float precision.
4. One degenerate check. If any embedding has a norm below 0.01 or above 100, the model has a training bug. Flag it.

Refuse to declare a model good on analogy accuracy alone. Analogy benchmarks are gameable and do not transfer to downstream tasks. Recommend intrinsic + downstream evaluation together.
```

## 练习

1. **简单。** 在一个小语料上运行训练循环（20 个关于猫和狗的句子）。训练 200 轮后，验证 `nearest(vocab, W, W[vocab["cat"]])` 在前 3 名中返回 `dog`。如果没有，就增加训练轮数或扩大词表。
2. **中等。** 加入对高频词的下采样（subsampling）。频率高于 `10^-5` 的词，按与其频率成正比的概率从训练对中丢弃。衡量它对生僻词相似度的影响。
3. **困难。** 在 20 Newsgroups 语料上训练一个模型。计算两条偏见轴：`he - she` 和 `doctor - nurse`。把职业词投影到这两条轴上，报告哪些职业的偏见差距最大。这正是公平性研究者使用的那类探针。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 词嵌入（Word embedding） | 把词表示成向量 | 一种从上下文中学到的、稠密的低维（通常 100-300）表示。 |
| Skip-gram | Word2Vec 的技巧 | 从中心词预测上下文词。比 CBOW 慢，但对生僻词更好。 |
| 负采样（Negative sampling） | 训练捷径 | 用对 `k` 个随机词的二分类，替代在整个词表上的 softmax。 |
| 静态嵌入（Static embedding） | 每个词一个向量 | 无论上下文如何都是同一向量。在一词多义上失效。 |
| 上下文嵌入（Contextual embedding） | 对上下文敏感的向量 | 基于周围词，为每次出现生成不同向量。这是 transformer 产出的东西。 |
| OOV | 未登录词（out of vocabulary） | 训练中未见过的词。Word2Vec 无法为它们产出向量。 |

## 延伸阅读

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) —— 负采样论文。简短且易读。
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) —— 对梯度最清晰的推导，如果你觉得原论文的数学太密集，可以读这篇。
- [gensim Word2Vec 教程](https://radimrehurek.com/gensim/models/word2vec.html) —— 真正可用的生产训练设置。
