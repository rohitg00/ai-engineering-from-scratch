# 词袋、TF-IDF 与文本表示

> 先计数，再思考。在 2026 年，TF-IDF 在定义明确的任务上仍然胜过 embeddings。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 01（文本处理），阶段 2 · 02（从零实现线性回归）
**时间：** ~75 分钟

## 问题

模型需要数字，而你只有字符串。

每个 NLP pipeline 都必须回答同一个问题：我们如何将变长的 token 流转换为分类器可以消费的固定大小向量？该领域找到的第一个答案是最简单但有效的方法：统计词频，构建向量。

这个向量承载的生产 NLP 任务比任何 embedding 模型都多。垃圾邮件过滤、主题分类、日志异常检测、搜索排序（BM25 之前）、第一波情感分析、学术 NLP 基准测试的第一个十年。2026 年的从业者在窄分类任务上仍然首选它。它快速、可解释，并且在词的出现本身就很重要的任务上，往往与 4 亿参数的 embedding 模型难分伯仲。

本课将从零构建词袋，然后是 TF-IDF，然后展示 scikit-learn 用三行代码完成同样的工作，最后指出让你转向 embeddings 的失败模式。

## 概念

**词袋（Bag of Words, BoW）** 丢弃了顺序。对每个文档，统计每个词汇表中的词出现了多少次。向量长度就是词汇表大小，位置 `i` 是词 `i` 的计数。

**TF-IDF** 对 BoW 进行重新加权。一个出现在每个文档中的词是没有信息量的，所以降低它的权重。一个在整个语料库中罕见但在单个文档中频繁的词是信号，所以提高它的权重。

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

其中 `TF` 是词在文档中的词频，`df` 是文档频率（包含该词的文档数），`N` 是总文档数。`log` 确保常见词的权重有上界。

关键特性：两者都产生稀疏向量，且轴是可解释的。你可以查看训练好的分类器的权重，读出哪些词将文档推向哪个类别。对于 768 维的 BERT embedding，你做不到这一点。

```figure
bow-tfidf
```

## 开始构建

### 第 1 步：构建词汇表

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

输入：tokenized 文档列表（任何词级 tokenizer 都可以；本课 `code/main.py` 使用简化的小写变体）。输出：`{word: index}` 字典。稳定的插入顺序意味着词索引 0 是第一个文档中看到的第一个词。约定不同；scikit-learn 按字母顺序排序。

### 第 2 步：词袋

```python
def bag_of_words(docs, vocab):
    matrix = [[0] * len(vocab) for _ in docs]
    for i, doc in enumerate(docs):
        for token in doc:
            if token in vocab:
                matrix[i][vocab[token]] += 1
    return matrix
```

```python
>>> docs = [["cat", "sat", "on", "mat"], ["cat", "cat", "ran"]]
>>> vocab = build_vocab(docs)
>>> bag_of_words(docs, vocab)
[[1, 1, 1, 1, 0], [2, 0, 0, 0, 1]]
```

行是文档，列是词汇表索引。`[i][j]` 表示"词 `j` 在文档 `i` 中出现了多少次"。文档 1 中 `cat` 出现了两次，因为它确实如此。文档 0 中 `ran` 出现了零次，因为它确实没有。

### 第 3 步：词频和文档频率

```python
import math


def term_frequency(doc_bow, doc_length):
    return [c / doc_length if doc_length else 0 for c in doc_bow]


def document_frequency(bow_matrix):
    df = [0] * len(bow_matrix[0])
    for row in bow_matrix:
        for j, count in enumerate(row):
            if count > 0:
                df[j] += 1
    return df


def inverse_document_frequency(df, n_docs):
    return [math.log((n_docs + 1) / (d + 1)) + 1 for d in df]
```

两个值得命名的平滑技巧。`(n+1)/(d+1)` 避免了 `log(x/0)`。末尾的 `+1` 确保出现在每个文档中的词仍然有 IDF 值为 1（而不是 0），与 scikit-learn 的默认行为一致。其他实现使用原始的 `log(N/df)`。两者都可用；平滑版本更友好。

### 第 4 步：TF-IDF

```python
def tfidf(bow_matrix):
    n_docs = len(bow_matrix)
    df = document_frequency(bow_matrix)
    idf = inverse_document_frequency(df, n_docs)
    out = []
    for row in bow_matrix:
        length = sum(row)
        tf = term_frequency(row, length)
        out.append([tf_j * idf_j for tf_j, idf_j in zip(tf, idf)])
    return out
```

```python
>>> docs = [
...     ["the", "cat", "sat"],
...     ["the", "dog", "sat"],
...     ["the", "cat", "ran"],
... ]
>>> vocab = build_vocab(docs)
>>> bow = bag_of_words(docs, vocab)
>>> tfidf(bow)
```

三个文档，五个词汇表词（`the`、`cat`、`sat`、`dog`、`ran`）。`the` 出现在全部三个文档中，所以它的 IDF 很低。`dog` 只出现在一个文档中，所以它的 IDF 很高。向量是稀疏的（大部分条目都很小），区分性强的词很突出。

### 第 5 步：L2 归一化行

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

没有归一化，较长的文档会产生更大的向量，从而主导相似度分数。L2 归一化将所有文档放在单位超球面上。行之间的 cosine similarity 现在就是点积。

## 使用现成工具

scikit-learn 提供了生产版本。

```python
from sklearn.feature_extraction.text import CountVectorizer, TfidfVectorizer

docs = ["the cat sat on the mat", "the dog sat on the mat", "the cat ran"]

bow_vectorizer = CountVectorizer()
bow = bow_vectorizer.fit_transform(docs)
print(bow_vectorizer.get_feature_names_out())
print(bow.toarray())

tfidf_vectorizer = TfidfVectorizer()
tfidf = tfidf_vectorizer.fit_transform(docs)
print(tfidf.toarray().round(3))
```

`CountVectorizer` 在一次调用中完成了 tokenization、词汇表构建和 BoW。`TfidfVectorizer` 添加了 IDF 加权和 L2 归一化。两者都返回稀疏矩阵。对于 10 万文档，密集版本无法装入内存；在分类器要求密集表示之前保持稀疏。

改变一切的关键参数：

| 参数 | 效果 |
|-----|--------|
| `ngram_range=(1, 2)` | 包含 bigrams。通常能提升分类效果。 |
| `min_df=2` | 丢弃出现在少于 2 个文档中的词。在噪声数据上精简词汇表。 |
| `max_df=0.95` | 丢弃出现在超过 95% 文档中的词。近似于停用词移除，无需硬编码列表。 |
| `stop_words="english"` | scikit-learn 内置的停用词列表。任务相关——情感分析*不应*删除否定词。 |
| `sublinear_tf=True` | 使用 `1 + log(tf)` 代替原始 `tf`。当一个词在一个文档中重复多次时有用。 |

### TF-IDF 仍然胜出的场景（截至 2026 年）

- 垃圾邮件检测、主题标签、日志异常标记。词的出现本身就很重要，语义细微差别不重要。
- 低数据场景（几百个标注样本）。TF-IDF 加逻辑回归没有预训练成本。
- 任何延迟敏感的场景。TF-IDF 加线性模型微秒级响应。通过 transformer 生成文档 embedding 需要 10-100ms。
- 必须解释预测结果的系统。检查分类器的系数。权重最高的正面词汇就是原因。

### TF-IDF 失败时

语义盲区。考虑以下两个文档：

- "The movie was not good at all."
- "The movie was excellent."

一个是负面评论，一个是正面评论。它们的 TF-IDF 交集恰好是 `{the, movie, was}`。一个词袋分类器必须记住 `not` 靠近 `good` 会翻转标签。在足够多的数据上它可以学会这一点，但永远不会像理解句法的模型那样优雅。

另一个失败：推理时出现词汇表外词。一个在 IMDb 评论上训练的 BoW 模型，如果 `Zoomer-approved` 这个 token 从未出现在训练中，它完全不知道如何处理。子词 embeddings（第 04 课）可以处理这个问题。TF-IDF 不行。

### 混合方案：TF-IDF 加权 embeddings

2026 年中等数据分类的实用默认方案：使用 TF-IDF 权重作为词 embeddings 上的注意力。

```python
def tfidf_weighted_embedding(doc, tfidf_scores, embedding_table, dim):
    vec = [0.0] * dim
    total_weight = 0.0
    for token in doc:
        if token not in embedding_table or token not in tfidf_scores:
            continue
        weight = tfidf_scores[token]
        emb = embedding_table[token]
        for i in range(dim):
            vec[i] += weight * emb[i]
        total_weight += weight
    if total_weight == 0:
        return vec
    return [v / total_weight for v in vec]
```

你从 embeddings 获得语义容量，从 TF-IDF 获得罕见词强调。分类器在池化后的向量上训练。在约 5 万个标注样本以下的场景，这比单独使用任何一种方法在情感、主题和意图分类上都表现更好。

## 交付

保存为 `outputs/prompt-vectorization-picker.md`：

```markdown
---
name: vectorization-picker
description: Given a text-classification task, recommend BoW, TF-IDF, embeddings, or a hybrid.
phase: 5
lesson: 02
---

You recommend a text-vectorization strategy. Given a task description, output:

1. Representation (BoW, TF-IDF, transformer embeddings, or a hybrid). Explain why in one sentence.
2. Specific vectorizer configuration. Name the library. Quote the arguments (`ngram_range`, `min_df`, `max_df`, `sublinear_tf`, `stop_words`).
3. One failure mode to test before shipping.

Refuse to recommend embeddings when the user has under 500 labeled examples unless they show evidence of semantic failure in a TF-IDF baseline. Refuse to remove stopwords for sentiment analysis (negations carry signal). Flag class imbalance as needing more than a vectorizer change.

Example input: "Classifying 30k customer support tickets into 12 categories. Most tickets are 2-3 sentences. English only. Need explainability for audit logs."

Example output:

- Representation: TF-IDF. 30k examples is not small; explainability requirement rules out dense embeddings.
- Config: `TfidfVectorizer(ngram_range=(1, 2), min_df=3, max_df=0.95, sublinear_tf=True, stop_words=None)`. Keep stopwords because category keywords sometimes are stopwords ("not working" vs "working").
- Failure to test: verify `min_df=3` does not drop rare category keywords. Run `get_feature_names_out` filtered by class and eyeball.
```

## 练习

1. **简单。** 在 L2 归一化后的 TF-IDF 输出上实现 `cosine_similarity(doc_vec_a, doc_vec_b)`。验证相同文档得分为 1.0，词汇表不重叠的文档得分为 0.0。
2. **中等。** 为 `bag_of_words` 添加 `n-gram` 支持。参数 `n` 产生 `n`-grams 的计数。测试 `n=2` 在 `["the", "cat", "sat"]` 上为 `["the cat", "cat sat"]` 产生 bigram 计数。
3. **困难。** 使用 GloVe 100d 向量（下载一次，缓存）构建上述 TF-IDF 加权 embedding 混合方案。在 20 Newsgroups 数据集上比较分类准确率，对比纯 TF-IDF 和纯均值池化 embeddings。报告在哪些场景下哪种方法胜出。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| BoW | 词频向量 | 一个文档中词汇表词的计数。丢弃了顺序。 |
| TF | 词频 | 一个词在文档中的计数，可选地按文档长度归一化。 |
| DF | 文档频率 | 至少包含该词一次的文档计数。 |
| IDF | 逆文档频率 | `log(N / df)` 平滑版本。降低出现在每个文档中的词的权重。 |
| 稀疏向量 | 大部分为零 | 词汇表通常有 1 万到 10 万个词；大多数词在任意给定文档中都不出现。 |
| Cosine similarity | 向量角度 | L2 归一化向量的点积。1 表示相同，0 表示正交。 |

## 延伸阅读

- [scikit-learn —— 文本特征提取](https://scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction) —— 权威 API 参考，以及每个参数的说明。
- [Salton, G., & Buckley, C. (1988). Term-weighting approaches in automatic text retrieval](https://www.sciencedirect.com/science/article/pii/0306457388900210) —— 使 TF-IDF 成为十年默认方法的论文。
- ["Why TF-IDF Still Beats Embeddings" —— Ashfaque Thonikkadavan (Medium)](https://medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2) —— 2026 年对老方法何时胜出及其原因的看法。
