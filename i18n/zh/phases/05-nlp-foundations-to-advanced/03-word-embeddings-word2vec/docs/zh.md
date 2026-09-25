# 词嵌入 — 从零实现 Word2Vec

> 观其伴，知其词。基于这个想法训练一个浅层网络，几何结构自然涌现。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF)、Phase 3 · 03 (Backpropagation from Scratch)
**Time:** 约 75 分钟

## 问题所在

TF-IDF 知道 `dog` 和 `puppy` 是不同的词，但不知道它们含义几乎相同。在 `dog` 上训练的分类器无法泛化到关于 `puppy` 的评论。你可以通过罗列同义词来掩盖这个问题，但这种方式在罕见词、领域术语以及任何你没有预料到的语言上都会失效。

你需要一种表示，让 `dog` 和 `puppy` 在空间中彼此靠近，让 `king - man + woman` 落在 `queen` 附近，让在 `dog` 上训练的模型能免费地将部分信号迁移到 `puppy` 上。

Word2Vec 给了我们这样的空间。两层神经网络，万亿级 token 的训练规模，2013 年发表。其架构简单得近乎可笑，而其结果重塑了此后十年的 NLP。

## 核心概念

**分布假说**（Firth，1957）：“观其伴，知其词。”如果两个词出现在相似的上下文中，它们很可能有相似的含义。

Word2Vec 有两种形式，都利用了这个想法。

- **Skip-gram。** 给定中心词，预测周围的词。窗口大小为 2 时如 `cat -> (the, sat, on)`。
- **CBOW（连续词袋模型）。** 给定周围的词，预测中心词。如 `(the, sat, on) -> cat`。

Skip-gram 训练较慢，但对罕见词处理更好，因此成为了默认选择。

该网络有一个不带非线性激活的隐藏层。输入是词表上的 one-hot 向量，输出是词表上的 softmax。训练完成后，你把输出层扔掉，隐藏层的权重就是词嵌入。

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

关键技巧：对 10 万个词做 softmax 的代价高得离谱。Word2Vec 使用**负采样**将其转化为一个二分类任务：预测“这个上下文词是否出现在这个中心词附近，是或否”。每个训练对只需采样少量负例（非共现）词，而不必对整个词表计算 softmax。

```figure
word-vector-arithmetic
```

## 动手实现

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

### 第 2 步：嵌入表

两个矩阵。`W` 是中心词嵌入表（要保留的那个），`W'` 是上下文词表（通常丢弃，有时与 `W` 取平均）。

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

小随机初始化即可。词表 1 万、维度 100 是现实的规模；用于教学，50 词表 x 16 维就足以观察几何结构。

### 第 3 步：负采样目标

对每个正样本对 `(center, context)`，从词表中随机采样 `k` 个词作为负例。训练模型使得点积 `W[center] · W'[context]` 对正样本高、对负样本低。

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

核心公式：正样本对上的 logistic 损失（希望 sigmoid 接近 1）加上负样本对上的 logistic 损失（希望 sigmoid 接近 0）。梯度同时流向两张表。完整推导见原论文；如果想真正掌握，建议用纸笔亲手推一遍。

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

在大语料上训练足够多轮后，共享上下文的词会有相似的中心嵌入。在玩具语料上，你只能隐约看到这种效果；在数十亿 token 上，效果非常显著。

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

`king - man + woman = queen`。这并不是因为模型理解“王室”是什么，而是因为向量 `(king - man)` 捕捉到了类似“royal”的成分，把它加到 `woman` 上就会落到“王室女性”区域附近。

## 实际使用

从零编写 Word2Vec 是教学目的。生产环境的 NLP 使用 `gensim`。

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

在实际工作中，你几乎从不需要自己训练 Word2Vec，而是直接下载预训练向量。

- **GloVe** — Stanford 基于共现矩阵分解的方法。提供 50d、100d、200d、300d 检查点，通用覆盖良好。第 04 课专门讲解 GloVe。
- **fastText** — Facebook 对 Word2Vec 的扩展，嵌入字符 n-gram。通过子词组合处理未登录词。见第 04 课。
- **Google News 上的预训练 Word2Vec** — 300d，300 万词表，2013 年发布。至今每天仍被大量下载。

### 2026 年 Word2Vec 仍然占优的场景

- 轻量级领域专用检索。在笔记本上一小时内在医学摘要上完成训练，得到通用模型捕捉不到的专用向量。
- 类比式特征工程。`gender_vector = mean(man - woman pairs)`。从其他词中减去它即可得到性别中立轴，至今仍用于公平性研究。
- 可解释性。100d 足够小，可以通过 PCA 或 t-SNE 绘图并真正看到聚类形成。
- 任何必须在设备端无 GPU 运行推理的场景。Word2Vec 查询只是取一行数据。

### Word2Vec 在哪里失效

一词多义之墙。`bank` 只有一个向量，`river bank` 和 `financial bank` 共享它，`table`（电子表格 vs 家具）也共享它。下游分类器无法从这个向量中区分不同的词义。

上下文相关嵌入（ELMo、BERT 以及之后的每一个 Transformer）通过基于周围上下文为每次出现的词生成不同的向量解决了这个问题。这就是从 Word2Vec 到 BERT 的跨越：从静态到上下文相关。Phase 7 讲解 Transformer 的部分。

另一个失败点是未登录词问题。如果 `Zoomer-approved` 不在训练数据中，Word2Vec 从未见过它，也没有任何兜底方案。fastText 通过子词组合解决了这个问题（第 04 课）。

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

1. **简单。** 在一个小语料（20 句关于猫和狗的句子）上运行训练循环。200 个 epoch 后，验证 `nearest(vocab, W, W[vocab["cat"]])` 的 top 3 结果中包含 `dog`。如果不包含，增加 epoch 数或词表规模。
2. **中等。** 添加高频词下采样。频率超过 `10^-5` 的词按与其频率成比例的概率从训练对中剔除。测量其对罕见词相似度的影响。
3. **困难。** 在 20 Newsgroups 语料上训练模型。计算两个偏差轴：`he - she` 和 `doctor - nurse`。将职业类词投影到这两个轴上，报告哪些职业的偏差差距最大。这正是公平性研究者使用的探测方法。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 词嵌入 | 词表示为向量 | 从上下文中学到的稠密低维（通常 100-300）表示。 |
| Skip-gram | Word2Vec 技巧 | 从中心词预测上下文词。比 CBOW 慢，但对罕见词更好。 |
| 负采样 | 训练捷径 | 用针对 `k` 个随机词的二分类替代整个词表上的 softmax。 |
| 静态嵌入 | 每词一个向量 | 无论上下文如何都是同一个向量。无法处理一词多义。 |
| 上下文相关嵌入 | 随上下文变化的向量 | 基于周围上下文为每次出现生成不同的向量。Transformer 产生的就是这种。 |
| OOV | 未登录词 | 训练中未见过的词。Word2Vec 无法为其生成向量。 |

## 延伸阅读

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) — 负采样论文。篇幅短，可读性强。
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) — 对梯度的最清晰推导，如果觉得原论文的数学太密集，可以读这篇。
- [gensim Word2Vec 教程](https://radimrehurek.com/gensim/models/word2vec.html) — 真正可用的生产级训练设置。