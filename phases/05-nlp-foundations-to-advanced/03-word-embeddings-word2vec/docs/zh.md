# 词嵌入 —— 从零实现 Word2Vec（Word Embeddings — Word2Vec from Scratch）

> 译注：本文译自同目录 [`en.md`](./en.md)。术语遵循仓根 [TRANSLATION_GUIDE.md](../../../../TRANSLATION_GUIDE.md)。

> 一个词的意义，由它身边的词决定。把这个想法塞进一个浅层神经网络去训练，几何结构自然就浮现出来。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 3 · 03 (Backpropagation from Scratch)
**Time:** ~75 minutes

## 问题（The Problem）

TF-IDF 知道 `dog` 和 `puppy` 是不同的词，却不知道它们其实意思几乎一样。一个在 `dog` 上训练出来的分类器，碰到一篇讲 `puppy` 的评论就抓瞎。你可以靠手写同义词表硬撑过去，但碰到生僻词、行业黑话，以及任何你没预料到的语种，这招立刻失灵。

你想要的是一种表示：`dog` 和 `puppy` 在空间里靠得很近；`king - man + woman` 落点在 `queen` 附近；一个在 `dog` 上训练的模型，能免费把一部分信号迁移到 `puppy` 上。

Word2Vec 就给了我们这样的空间。两层神经网络，万亿 token 级别的训练规模，2013 年发表。架构简单得近乎尴尬，但结果重塑了 NLP 整整十年。

## 概念（The Concept）

**分布式假设（distributional hypothesis）**（Firth, 1957）：「You shall know a word by the company it keeps.」（看一个词跟谁混在一起，就知道它是什么意思。）如果两个词出现在相似的上下文里，它们大概率意思也相近。

Word2Vec 有两种变体，都在利用这个想法。

- **Skip-gram。** 给定中心词，预测它周围的词。窗口为 2 时，`cat -> (the, sat, on)`。
- **CBOW（continuous bag of words，连续词袋）。** 给定周围的词，预测中心词。`(the, sat, on) -> cat`。

Skip-gram 训练慢一些，但对生僻词处理得更好，于是成了默认选项。

这个网络只有一个隐藏层，且没有非线性激活。输入是词表上的 one-hot 向量，输出是词表上的 softmax。训练完成后把输出层丢掉，隐藏层的权重就是 embedding（嵌入）。

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

诀窍在于：在 10 万个词上算 softmax 代价太高。Word2Vec 用 **negative sampling（负采样）** 把它转成一个二分类任务——「这个上下文词是否出现在该中心词附近，是或否」。每对训练样本只采样几个负样本（不共现的词），而不是在整个词表上算 softmax。

## 动手实现（Build It）

### Step 1: training pairs from a corpus

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

窗口里的每一对 (center, context) 都是一个正样本。

### Step 2: embedding tables

两个矩阵。`W` 是中心词的 embedding 表（最后保留下来用的就是它）；`W'` 是上下文词的表（通常会丢掉，有时也会和 `W` 平均一下）。

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

用很小的随机值初始化。词表 1 万、维度 100 是比较实际的设置；做教学的话，词表 50、维度 16 已经足够看到几何结构。

### Step 3: negative sampling objective

对每个正样本对 `(center, context)`，从词表里随机采样 `k` 个词作为负样本。训练目标是让点积 `W[center] · W'[context]` 在正样本上变高、在负样本上变低。

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

魔法配方：正样本对上的 logistic 损失（希望 sigmoid 接近 1），加上负样本对上的 logistic 损失（希望 sigmoid 接近 0）。梯度同时回传到两张表上。完整推导见原论文；想真正吃透的话，拿纸笔从头推一遍。

### Step 4: train on a toy corpus

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

在足够大的语料上跑足够多 epoch 后，共享上下文的词在中心 embedding 上会变得相似。在玩具语料上你只能看到一点苗头；在数十亿 token 上你会看到非常戏剧化的效果。

### Step 5: the analogy trick

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

用预训练的 300 维 Google News 向量：

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

`king - man + woman = queen`。这并不是因为模型懂什么是王室，而是因为向量 `(king - man)` 捕捉到了类似「royal（皇室属性）」的东西，把它加到 `woman` 上，就落到了「皇室女性」这片区域。

## 用起来（Use It）

从零实现 Word2Vec 是教学用途。生产里的 NLP 都用 `gensim`。

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

真要做实事，你几乎从不自己训 Word2Vec，而是直接下载预训练向量。

- **GloVe** —— 斯坦福用共现矩阵分解的方法，提供 50d / 100d / 200d / 300d 等 checkpoint，通用覆盖良好。Lesson 04 会专门讲 GloVe。
- **fastText** —— Facebook 对 Word2Vec 的扩展，对 character n-gram 也做 embedding。通过子词组合来处理词表外（OOV）词。Lesson 04 会讲。
- **在 Google News 上预训练的 Word2Vec** —— 300d、300 万词词表，2013 年发布，至今每天还有人下载。

### When Word2Vec still wins in 2026

- 轻量级、领域专属的检索。在一台笔记本上花一小时在医学摘要上训练，就能拿到通用模型抓不到的领域专用向量。
- 类比式特征工程。`gender_vector = mean(man - woman pairs)`，把它从其他词里减掉，就能得到一个「性别中立」轴，公平性研究里至今还在用。
- 可解释性。100 维已经够小，可以用 PCA 或 t-SNE 画出来，肉眼就能看到聚类成形。
- 任何必须在端侧、无 GPU 上做推理的场景。Word2Vec 查询就是取一行向量这么简单。

### Where Word2Vec fails

一堵墙叫一词多义（polysemy）。`bank` 只有一个向量，`river bank`（河岸）和 `financial bank`（银行）共用它；`table`（电子表格 vs 家具）也共用它。下游分类器从这个向量里没法分辨词义。

contextual embedding（上下文 embedding，比如 ELMo、BERT 以及之后的所有 transformer）就是为了解决这个问题——为同一个词在每次出现时，根据上下文产生不同的向量。这正是从 Word2Vec 跨到 BERT 的那一步：从静态到上下文化。Phase 7 会讲 transformer 这一半。

另一个失败点是 OOV（out-of-vocabulary，词表外）问题。Word2Vec 没在训练数据里见过 `Zoomer-approved`，就完全没办法兜底。fastText 用子词组合修掉了这个问题（lesson 04）。

## 上线部署（Ship It）

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

## 练习（Exercises）

1. **Easy。** 在一份很小的语料（20 句关于猫和狗的句子）上跑一遍训练循环。200 epoch 之后，验证 `nearest(vocab, W, W[vocab["cat"]])` 在 top 3 里返回 `dog`。如果不行，加 epoch 或扩词表。
2. **Medium。** 加上对高频词的 subsampling（下采样）：词频高于 `10^-5` 的词，按其频率成正比的概率从训练样本对里丢掉。测一下这对生僻词相似度的影响。
3. **Hard。** 在 20 Newsgroups 语料上训练一个模型。算两条偏置轴：`he - she` 和 `doctor - nurse`。把职业词分别投影到这两条轴上，报告偏置差最大的几个职业。这就是公平性研究者常用的探测手法。

## 关键术语（Key Terms）

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Word embedding | 词当成向量 | 从上下文学出来的稠密、低维（一般 100–300）表示。 |
| Skip-gram | Word2Vec 的小把戏 | 由中心词预测上下文词。比 CBOW 慢，但对生僻词更好。 |
| Negative sampling | 训练上的捷径 | 用对 `k` 个随机词的二分类，替代在整个词表上的 softmax。 |
| Static embedding | 一个词一个向量 | 不论上下文都是同一个向量，对一词多义无能为力。 |
| Contextual embedding | 上下文敏感的向量 | 同一个词在不同位置因为周围词不同而得到不同向量，transformer 输出的就是这种。 |
| OOV | 词表外（out of vocabulary） | 训练里没见过的词，Word2Vec 无法为其生成向量。 |

## 延伸阅读（Further Reading）

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) —— 负采样论文，篇幅短，可读性好。
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) —— 梯度推导最清楚的一份；如果原论文的数学嫌密，读这篇。
- [gensim Word2Vec tutorial](https://radimrehurek.com/gensim/models/word2vec.html) —— 真正能用的生产训练参数设置。
