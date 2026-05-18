# Word Embeddings — Word2Vec from Scratch

> 一个词就是它所拥有的公司。在这个想法上训练一张浅网，然后几何就会消失。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 02（BoW + TF-IDF）、阶段3 · 03（从Scratch反向传播）
** 时间：** ~75分钟

## The Problem

TF-IDF知道“dog”和“puppy”是不同的词。它不知道它们的意思几乎相同。针对“狗”训练的分类器无法概括为有关“小狗”的评论。您可以通过列出同义词来掩盖这一点，但这对罕见术语、领域行话和您意想不到的每种语言都失败了。

您想要一个“狗”和“小狗”在太空中靠近着陆的表示。“国王-男人+女人”落在“女王”附近的地方。接受过“狗”训练的模特免费向“小狗”传输一些信号。

Word2Vec给了我们这个空间。两层神经网络，万亿代币训练运行，于2013年发布。该建筑几乎简单得令人尴尬。十年来，这些结果重塑了NLP。

## The Concept

![Skip-gram window and embedding space](./assets/word2vec.svg)

** 分布假设 **（Firth，1957）：“你会通过它所拥有的公司知道一个词。“如果两个词出现在相似的上下文中，它们的含义可能相似。

Word2Vec有两种风格，都利用了这一想法。

- ** 跳过克。**给定一个中心词，预测周围的词。' cat ->（the、sit、on）'窗户尺寸为2。
- **CBOW（连续的单词袋）。**给定周围的词语，预测中心。'（the，sit，on）-> cat '。

Skip-gram的训练速度较慢，但处理罕见单词的能力更好。它成为默认设置。

该网络有一个没有非线性的隐藏层。输入是词汇量上的一站式载体。输出是词汇量的softmax。训练结束后，您会扔掉输出层。隐藏的层权重是嵌入。

```
one-hot(center) ── W ──▶ hidden (d-dim) ── W' ──▶ softmax(vocab)
                          ^
                          this is the embedding
```

诀窍：超过10万字的softmax是非常昂贵的。Word2Vec使用 ** 负采样 ** 将其转换为二进制分类任务。预测“这个上下文词是否出现在这个中心词附近，是或否”。在每个训练对中抽取少量否定（非共现）单词，而不是在整个词汇表中计算softmax。

## Build It

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

窗口中的每个（中心、上下文）对都是积极的训练示例。

### Step 2: embedding tables

两个矩阵。“W”是中心词嵌入表（您保留的表）。“W”是上下文词表（通常被丢弃，有时用“W”取平均值）。

```python
import numpy as np


def init_embeddings(vocab_size, dim, seed=0):
    rng = np.random.default_rng(seed)
    W = rng.normal(0, 0.1, size=(vocab_size, dim))
    W_prime = rng.normal(0, 0.1, size=(vocab_size, dim))
    return W, W_prime
```

小随机初始化。Vocab大小10 k和dim 100是现实的;对于教学，50 vocab x 16 dim足以看到几何形状。

### Step 3: negative sampling objective

对于每一个正对`（center，context）`，从词汇表中随机抽取`k`个单词作为负对。训练模型，使点积“W[center] ·W”[context]“对于阳性高，对于阴性低。

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

神奇的公式：正对的逻辑损失（希望sigmoid接近1）加上负对的逻辑损失（希望sigmoid接近0）。两个表都有流量。完整的推导在原始论文中;如果你想坚持下去，就用铅笔和纸走一遍。

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

在大型语料库上经历足够多的时期后，共享上下文的单词具有相似的中心嵌入。在玩具库上，你可以隐约看到这种效果。在数十亿个代币上，你会看到它戏剧性地。

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

在预训练的300 d Google新闻载体上：

```python
>>> analogy(vocab, W, "man", "king", "woman")
[('queen', 0.71), ('monarch', 0.62), ('princess', 0.59), ...]
```

“国王-男人+女人=女王”。并不是因为模特知道什么是版税。因为载体“（国王-男人）”捕捉了类似“royal”的东西，并将其添加到王室女性地区附近的“女人”土地中。

## Use It

从头开始编写Word2Vec就是教学。生产NLP使用“gensim”。

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

对于实际工作，您几乎从不亲自训练Word2Vec。您下载预训练的载体。

- **GloVe** -斯坦福大学的同现矩阵分解方法。50天、100天、200天、300天检查站。良好的一般报道。第04课专门介绍了GloVe。
- **fastText** - Facebook的Word 2 Vec扩展，嵌入字符n-gram。通过合成子词处理词汇量外的词。课04。
- ** Google News上预训练的Word 2 Vec ** -300 d，3 M单词词汇量，2013年发布。仍然每天下载。

### When Word2Vec still wins in 2026

- 轻量级域特定检索。在笔记本电脑上一小时内训练医学摘要，获得无需通用模型捕获的专业载体。
- 类似风格的特征工程。' gender_vector =平均值（男性-女性配对）'。将其从其他词中减去，以获得中性轴。仍然用于公平研究。
- 可解释性。100d足够小，可以通过PCA或t-SNE进行绘图，并实际看到聚类形成。
- 任何地方推理都必须在没有图形处理器的设备上运行。Word2Vec查找是一个行获取。

### Where Word2Vec fails

一词制墙。“bank”有一个载体。“河岸”和“金融银行”共享它。“桌子”（电子表格与家具）共享它。下游的分类器无法区分感官和载体。

上下文嵌入（ELMo，BERT，此后的每一个Transformer）通过基于周围上下文为单词的每次出现产生不同的向量来解决这个问题。这就是从Word2Vec到BERT的跳跃：从静态到上下文。第7阶段涵盖Transformer的一半。

词汇量不足问题是另一个失败。如果不在训练数据中，Word 2 Vec从未见过“Zoomer-approved”。没有退路。fastText通过子词合成修复了这个问题（第04课）。

## Ship It

另存为“输出/skill-embedding-probe.md”：

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

## Exercises

1. ** 简单。**在一个小的文集上运行训练循环（20个关于猫和狗的句子）。200个历元后，验证“nearly（vocab，W，W[vocab[“cat”]]）'返回前3名中的“dog”。如果没有，请增加纪元或词汇量。
2. ** 中等。**添加频繁词的子采样。频率高于“10 '-5 '的单词将从训练对中删除，其概率与其频率成正比。衡量对稀有词相似性的影响。
3. ** 很难。**在20个新闻组语料库上训练模型。计算两个偏差轴：“他-她”和“医生-护士”。将职业词投影到两个坐标轴上。报告哪些职业的偏见差距最大。这就是研究人员使用的公平性探测器。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 单词嵌入 | 词作为载体 | 从上下文学习的密集、低亮度（通常为100-300）表示。 |
| Skip-gram | Word2Vec技巧 | 从中心词预测上下文词。比CBOW慢，更适合稀有单词。 |
| 负采样 | 培训捷径 | 用针对“k”随机词的二进制分类替换完整vocab的softmax。 |
| 静态嵌入 | 每个词一个载体 | 无论上下文如何，相同的载体。在多义性上失败。 |
| 上下文嵌入 | 上下文敏感载体 | 根据周围的单词，每次出现的载体都不同。变压器产生什么。 |
| OOV | 词库外 | 训练中没有看到这个词。Word2Vec无法为这些生成载体。 |

## Further Reading

- [Mikolov等人（2013）。单词和短语及其成分的分布式表示]（https：//arxiv.org/ab/1310.4546）-负面抽样论文。简短且可读。
- [Rong、X.（2014）。word 2 vec参数学习解释]（https：//arxiv.org/abs/1411.2738）-如果原始论文的数学感觉密集的话，这是梯度的最清晰推导。
- [gensim Word 2 Vec教程]（https：//radimrehurek.com/gensim/models/word2vec.html）-实际工作的生产培训设置。
