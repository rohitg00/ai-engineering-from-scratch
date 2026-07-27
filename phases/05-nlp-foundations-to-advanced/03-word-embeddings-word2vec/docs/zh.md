# 词嵌入——从零实现 Word2Vec

> 一个词由其同伴定义。在这个想法上训练一个浅层网络，几何结构就自然浮现。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 02（BoW + TF-IDF），阶段 3 · 03（从零实现反向传播）
**时间：** ~75 分钟

## 问题

TF-IDF 知道 `dog` 和 `puppy` 是不同的词，但它不知道它们的含义几乎相同。在 `dog` 上训练的分类器无法泛化到关于 `puppy` 的评论。你可以通过列举同义词来掩盖这个问题，但这在罕见词、领域术语和你没有预料到的每一种语言上都会失败。

你需要一种表示，其中 `dog` 和 `puppy` 在空间中靠得很近。其中 `king - man + woman` 接近 `queen`。其中在 `dog` 上训练的模型可以免费将一些信号迁移到 `puppy`。

Word2Vec 给了我们这个空间。两层神经网络，数万亿 token 的训练运行，发表于 2013 年。这个架构几乎简单得令人尴尬，但其结果重塑了 NLP 十年之久。

## 概念

**分布假说（Distributional hypothesis）**（Firth, 1957）："一个词由其同伴定义。"如果两个词出现在相似的上下文中，它们可能含义相似。

Word2Vec 有两种形式，都利用了这个思想。

- **Skip-gram。** 给定中心词，预测周围的词。窗口大小为 2 时，`cat -> (the, sat, on)`。
- **CBOW（continuous bag of words）。** 给定周围的词，预测中心词。`(the, sat, on) -> cat`。

Skip-gram 训练较慢，但能更好地处理罕见词，因此成为了默认选择。

网络有一个不带非线性的隐藏层。输入是词汇表上的 one-hot 向量，输出是词汇表上的 softmax。训练完成后，丢弃输出层。隐藏层的权重就是 embeddings。

```
one-hot(中心词) ── W ──▸ 隐藏层 (d 维) ── W' ──▸ softmax(词汇表)
                          ^
                          这就是 embedding
```

技巧：在 10 万个词上做 softmax 代价极其高昂。Word2Vec 使用**负采样（negative sampling）**将其转化为二分类任务。预测"这个上下文词是否出现在这个中心词附近"。对每个训练对采样少量负例（非共现）词，而不是在整个词汇表上计算 softmax。

```figure
word-vector-arithmetic
```

## 开始构建

### 第 1 步：从语料库生成训练对

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

窗口内的每个（中心词，上下文词）对都是一个正训练样本。

### 第 2 步：embedding 表

两个矩阵。`W` 是中心词 embedding 表（你要保留的那个）。`W'` 是上下文词表（通常丢弃，有时与 `W` 取平均）。

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

小的随机初始化。词汇表大小 1 万、维度 100 是实际的；教学时，50 词汇 × 16 维度就足以看到几何结构。

### 第 3 步：负采样目标

对每个正对 `(center, context)`，从词汇表中采样 `k` 个随机词作为负例。训练模型使得 `W[center] · W'[context]` 对正例高、对负例低。

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

神奇的公式：正对的 logistic 损失（希望 sigmoid 接近 1）加上负对的 logistic 损失（希望 sigmoid 接近 0）。梯度流向两个表。完整的推导在原始论文中；如果你想记住它，用纸笔走一遍。

### 第 4 步：在玩具语料库上训练

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

在大语料库上经过足够多的 epoch 后，共享上下文的词具有相似的中心 embeddings。在玩具语料库上，你微弱地看到这种效果。在数十亿 tokens 上，你显著地看到它。

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

`king - man + woman = queen`。不是因为模型知道皇室是什么，而是因为向量 `(king - man)` 捕捉了类似"皇室"的东西，加上 `woman` 后落在皇室-女性区域附近。

## 使用现成工具

从零写 Word2Vec 是教学目的。生产 NLP 使用 `gensim`。

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

在实际工作中，你几乎从不自己训练 Word2Vec。你下载预训练向量。

- **GloVe** —— 斯坦福的共现矩阵分解方法。提供 50d、100d、200d、300d 检查点。通用覆盖性好。第 04 课专门介绍 GloVe。
- **fastText** —— Facebook 对 Word2Vec 的扩展，将字符 n-gram 也嵌入。通过组合子词来处理词汇表外词。第 04 课。
- **Google News 预训练 Word2Vec** —— 300d、300 万词汇表，发布于 2013 年。至今仍被每日下载。

### 2026 年 Word2Vec 仍然胜出的场景

- 轻量级领域特定检索。在笔记本电脑上用一小时在医学摘要上训练，获得通用模型无法捕捉的专用向量。
- 类比式特征工程。`gender_vector = mean(man - woman pairs)`。从其他词中减去它，得到性别中立轴。仍用于公平性研究。
- 可解释性。100 维足够小，可以通过 PCA 或 t-SNE 绘制并看到聚类形成。
- 任何需要在无 GPU 设备上运行推理的场景。Word2Vec 查找只是一次单行读取。

### Word2Vec 的失败

多义词墙。`bank` 只有一个向量。`river bank` 和 `financial bank` 共用它。`table`（电子表格 vs 家具）共用它。下游分类器无法从向量中区分这些含义。

上下文 embeddings（ELMo、BERT 以及之后的所有 transformer）通过根据周围上下文为每个词的每次出现生成不同的向量来解决这个问题。这是从 Word2Vec 到 BERT 的飞跃：从静态到上下文。阶段 7 介绍 transformer 部分。

词汇表外问题是另一个失败。如果 `Zoomer-approved` 不在训练数据中，Word2Vec 就从未见过它。没有回退。fastText 通过子词组合修复了这个问题（第 04 课）。

## 交付

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

1. **简单。** 在一个微型语料库（20 句关于猫和狗的句子）上运行训练循环。经过 200 个 epoch 后，验证 `nearest(vocab, W, W[vocab["cat"]])` 在前 3 名中返回 `dog`。如果没有，增加 epoch 或词汇表。
2. **中等。** 添加高频词子采样。频率超过 `10^-5` 的词以与其频率成正比的概率从训练对中丢弃。衡量对罕见词相似度的影响。
3. **困难。** 在 20 Newsgroups 语料库上训练模型。计算两个偏差轴：`he - she` 和 `doctor - nurse`。将职业词投影到两个轴上。报告哪些职业有最大的偏差差距。这是公平性研究人员使用的那种探测方法。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Word embedding | 词作为向量 | 从上下文中学到的密集、低维（通常 100-300）表示。 |
| Skip-gram | Word2Vec 技巧 | 从中心词预测上下文词。比 CBOW 慢，但更擅长罕见词。 |
| Negative sampling | 训练捷径 | 用对 `k` 个随机词的二分类替换对整个词汇表的 softmax。 |
| Static embedding | 每词一个向量 | 无论上下文如何，向量相同。在多义词上失败。 |
| Contextual embedding | 上下文敏感向量 | 根据周围上下文，每次出现产生不同的向量。transformer 所生成的。 |
| OOV | 词汇表外 | 训练中未见过的词。Word2Vec 无法为这些词生成向量。 |

## 延伸阅读

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) —— 负采样论文。简短易读。
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) —— 梯度最清晰的推导，如果原始论文的数学感觉密集的话。
- [gensim Word2Vec tutorial](https://radimrehurek.com/gensim/models/word2vec.html) —— 实际可行的生产训练设置。
