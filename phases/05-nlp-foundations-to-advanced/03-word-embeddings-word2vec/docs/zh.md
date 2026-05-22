# 词嵌入（Word Embeddings）——从零实现 Word2Vec

> 词以其相伴词汇为伍。在这个想法上训练一个浅层网络，几何关系便自然浮现。

**类型：** 动手构建  
**语言：** Python  
**前置知识：** 第五阶段 · 02（词袋模型 + TF-IDF），第三阶段 · 03（从零实现反向传播）  
**预计耗时：** ~75 分钟

## 问题所在

TF-IDF 知道 `dog` 和 `puppy` 是不同的词，却不知道它们含义几乎相同。一个用 `dog` 训练的分类器无法泛化到关于 `puppy` 的评论。你可以通过列出同义词来掩盖这个问题，但在罕见术语、领域术语以及你未预料到的每一种语言上，这种方法都会失效。

你需要一种表示，使得 `dog` 和 `puppy` 在空间中距离很近；使得 `king - man + woman` 的结果接近 `queen`；使得一个在 `dog` 上训练的模型能自动将部分信号迁移到 `puppy` 上。

Word2Vec 提供了这样的空间。一个两层神经网络，在万亿级 token 上训练，于 2013 年发表。其架构简单得几乎令人难为情，但结果重塑了 NLP 领域十年之久。

## 核心概念

**分布假说（Distributional hypothesis）**（Firth, 1957）：“观其伴而知其意。”如果两个词出现在相似的上下文中，它们很可能含义相似。

Word2Vec 有两种变体，都利用了这一思想。

- **跳元模型（Skip-gram）**。给定中心词，预测其周围词汇。例如，窗口大小为 2 时，`cat -> (the, sat, on)`。
- **连续词袋模型（CBOW，continuous bag of words）**。给定周围词汇，预测中心词。例如，`(the, sat, on) -> cat`。

跳元模型训练较慢，但对罕见词处理得更好，因此成为默认选择。

该网络只有一个隐藏层，且不使用非线性激活函数。输入是词表大小的一维独热（one-hot）向量。输出是词表上的 softmax。训练完成后，丢弃输出层，隐藏层的权重就是词嵌入。

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          这就是嵌入向量
```

技巧：对 10 万个词的 softmax 计算成本高得令人望而却步。Word2Vec 使用**负采样（negative sampling）**将其转化为二分类任务。预测“该上下文词是否出现在中心词附近”，对每个训练对采样几个负样本（未共现的词），而不是在整个词表上计算 softmax。

## 动手实现

### 第1步：从语料中生成训练对

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

窗口内每一对 `(中心词, 上下文词)` 都是一个正训练样本。

### 第2步：嵌入表

两个矩阵。`W` 是中心词嵌入表（你要保留的那个）。`W'` 是上下文词表（通常被丢弃，有时会与 `W` 平均）。

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

采用小随机初始化。词表大小 10k、维度 100 是实际场景；教学中，50 词、16 维就足以看到几何效果。

### 第3步：负采样目标函数

对于每个正样本对 `(中心词, 上下文词)`，从词表中随机采样 `k` 个词作为负样本。训练模型，使得正样本对 `W[中心词] · W'[上下文词]` 的点积较大，负样本对较小。

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

神奇公式：正样本对上的对数损失（希望 sigmoid 接近 1）加上负样本对上的对数损失（希望 sigmoid 接近 0）。梯度流向两个表。完整推导见原始论文；如果想深刻理解，最好自己用纸笔推导一遍。

### 第4步：在玩具语料上训练

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

在大型语料上经过足够多的轮次后，共享上下文的词将具有相似的中心嵌入。在玩具语料上，你能隐约看到效果。在数十亿个 token 上，效果则非常显著。

### 第5步：类比技巧

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

`king - man + woman = queen`。不是因为模型了解什么是王室，而是因为向量 `(king - man)` 捕捉到了类似“王室”的含义，将其加到 `woman` 上便落在了王室-女性区域附近。

## 使用它

从零实现 Word2Vec 是为了教学。生产环境中的 NLP 使用 `gensim`。

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

在实际工作中，你几乎从不自己训练 Word2Vec，而是下载预训练向量。

- **GloVe** — 斯坦福大学的共现矩阵分解方法。提供 50、100、200、300 维的检查点。通用覆盖良好。第04课专门介绍 GloVe。
- **fastText** — Facebook 对 Word2Vec 的扩展，嵌入了字符 n-gram，通过子词组合处理词表外词汇。第04课。
- **预训练的 Google News Word2Vec** — 300 维，300 万词表，2013 年发表。至今仍被每日下载。

### 2026 年 Word2Vec 仍占优势的场景

- 轻量级领域特定检索。在一台笔记本电脑上用一小时在医学摘要上训练，就能获得通用模型无法捕捉的专门向量。
- 类比式特征工程。`性别向量 = 平均(man - woman 对)`，将其从其他词中减去，得到中性性别轴。仍在公平性研究中被使用。
- 可解释性。100 维足够小，可以通过 PCA 或 t-SNE 绘制，并实际观察到聚类形成。
- 任何需要在无 GPU 的设备上进行推理的场景。Word2Vec 查找就是一次单行获取。

### Word2Vec 的局限

多义词墙（polysemy wall）。`bank` 只有一个向量。`river bank` 和 `financial bank` 共享它。`table`（电子表格 vs. 家具）共享它。下游分类器无法从向量中区分这些含义。

上下文嵌入（contexual embeddings，ELMo、BERT 及其后的所有 Transformer）通过根据周围上下文为每个词的出现生成不同向量解决了这个问题。这是从 Word2Vec 到 BERT 的飞跃：从静态到上下文。第七阶段涵盖 Transformer 部分。

词表外（OOV）问题是另一个失败点。如果训练数据中没有出现 `Zoomer-approved`，Word2Vec 就从未见过它，也没有后备方案。fastText 通过子词组合解决了这个问题（第04课）。

## 交付产物

保存为 `outputs/skill-embedding-probe.md`：

```markdown
---
name: embedding-probe
description: 检查 word2vec 模型。运行类比、查找邻居、诊断质量。
version: 1.0.0
phase: 5
lesson: 03
tags: [nlp, embeddings, debugging]
---

你探查训练好的词嵌入以验证其是否正常工作。给定一个 `gensim.models.KeyedVectors` 对象和一个词表，你运行：

1. 三个标准类比测试。`king : man :: queen : woman`。`paris : france :: tokyo : japan`。`walking : walked :: swimming : ?`。报告 top-1 结果及其余弦相似度。
2. 用户提供领域特定词的五个最近邻测试。打印 top-5 邻居及其余弦相似度。
3. 一个对称性检查。`similarity(a, b) == similarity(b, a)`，误差应在浮点精度范围内。
4. 一个退化检查。如果有任何嵌入向量的范数低于 0.01 或高于 100，说明模型存在训练 bug，标记出来。

不要仅凭类比准确率就断言模型良好。类比基准可以被操纵，且无法迁移到下游任务。建议同时采用内在评估和下游评估。
```

## 练习

1. **简单**。在一个小型语料（20 个关于猫狗的句子）上运行训练循环。经过 200 轮后，验证 `nearest(vocab, W, W[vocab["cat"]])` 的前三名中是否包含 `dog`。如果没有，增加轮数或词表大小。
2. **中等**。添加高频词子采样。频率高于 `10^-5` 的词被丢弃（丢弃概率与其频率成正比）。衡量对罕见词相似度的影响。
3. **困难**。在 20 个新闻组（20 Newsgroups）语料上训练模型。计算两个偏差轴：`he - she` 和 `doctor - nurse`。将职业词投影到这两个轴上，报告哪些职业的偏差差距最大。这是公平性研究人员使用的一种探查方法。

## 关键术语

| 术语 | 常说的意思 | 实际含义 |
|------|------------|----------|
| 词嵌入（Word embedding） | 词作为向量 | 从上下文中学习到的稠密、低维（通常 100-300）表示。 |
| 跳元模型（Skip-gram） | Word2Vec 技巧 | 从中心词预测上下文词。比 CBOW 慢，但对罕见词更好。 |
| 负采样（Negative sampling） | 训练捷径 | 将整个词表上的 softmax 替换为与 `k` 个随机词的二分类。 |
| 静态嵌入（Static embedding） | 每个词一个向量 | 无论上下文如何，同一个词的向量相同。在多义词上失效。 |
| 上下文嵌入（Contextual embedding） | 上下文敏感的向量 | 根据周围词，每个出现位置生成不同向量。Transformer 产出的结果。 |
| OOV | 词表外（Out of vocabulary） | 训练中未见过的词。Word2Vec 无法为其生成向量。 |

## 延伸阅读

- [Mikolov et al. (2013). Distributed Representations of Words and Phrases and their Compositionality](https://arxiv.org/abs/1310.4546) — 负采样论文。简短且易读。
- [Rong, X. (2014). word2vec Parameter Learning Explained](https://arxiv.org/abs/1411.2738) — 如果原始论文的数学推导感觉密集，这是对梯度最清晰的推导。
- [gensim Word2Vec 教程](https://radimrehurek.com/gensim/models/word2vec.html) — 实际可用的生产环境训练参数设置。