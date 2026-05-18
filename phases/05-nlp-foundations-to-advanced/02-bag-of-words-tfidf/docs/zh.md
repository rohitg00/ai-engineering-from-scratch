# Bag of Words, TF-IDF, and Text Representation

> 先数数，后思考。到2026年，TF-IDF仍然优于对明确任务的嵌入。

** 类型：** 构建
** 语言：** Python
** 先决条件：** 阶段5 · 01（文本处理）、阶段2 · 02（从头开始线性回归）
** 时间：** ~75分钟

## The Problem

模型需要数字。你有绳子。

每个NLP管道都必须回答同样的问题。我们如何将可变长度的令牌流转化为分类器可以消费的固定大小的载体。该领域遇到的第一个答案是最愚蠢的答案。数数单词。制作一个载体。

该载体比任何嵌入模型承载了更多的生产NLP。垃圾邮件过滤器、主题分类器、日志异常检测、搜索排名（BM 25之前）、第一波情绪分析、学术NLP基准的第一个十年。2026年，从业者仍然首先完成狭窄的分类任务。它速度快、可解释，并且通常与400 M参数嵌入模型无法区分，用于关键词存在的任务。

本课从头开始构建单词袋，然后是TF-IDF。然后显示scikit-learn在三行中做同样的事情。然后命名使您接触嵌入的失败模式。

## The Concept

![BoW vs TF-IDF representation flow](./assets/bow-tfidf.svg)

** 词袋（BoW）** 抛弃秩序。对于每个文档，计算每个词汇出现的次数。Vector长度是词汇量大小。位置“i”是单词“i”的计数。

**TF-IDF** 重新加权BoW。每个文档中出现的单词都是没有信息的，因此缩小规模。一个在整个文集中很少见但在单个文档中很常见的词就是信号，因此可以扩大规模。

```
TF-IDF(w, d) = TF(w, d) * IDF(w)
             = count(w in d) / |d| * log(N / df(w))
```

其中“TF”是文档中的术语频率，“DF”是文档频率（有多少个文档包含该单词），“N”是文档总数。“log”保持无处不在的单词的权重有界限。

关键属性：两者都产生具有可解释轴的稀疏向量。您可以查看经过训练的分类器的权重，并阅读哪些单词将文档推向每个类。你不能用768维BERT嵌入来实现这一点。

## Build It

### Step 1: build the vocabulary

```python
def build_vocab(docs):
    vocab = {}
    for doc in docs:
        for token in doc:
            if token not in vocab:
                vocab[token] = len(vocab)
    return vocab
```

输入：标记化文档列表（任何单词级标记器都可以;本课中的“code/main.py”使用简化的收件箱变体）。输出：'{word：index}' dict。稳定的插入顺序意味着单词index 0是第一个文档中出现的第一个单词。惯例各不相同; scikit-learning分类。

### Step 2: bag of words

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

收集文件。列是词汇索引。条目`[i][j]`是“单词`j`在文档`i`中出现的次数。“Doc 1有两次'猫'，因为它确实如此。Doc 0已“运行”零次，因为它没有运行。

### Step 3: term frequency and document frequency

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

两个值得列举的平滑技巧。“（n+1）/（d+1）”避免了“log（x/0）”。尾部的“+1”确保每个文档中的单词仍然具有IDF 1（不是0），与scikit-learn的默认值相匹配。其他实现使用原始“log（N/DF）”。两者都有效;平滑版本更友好。

### Step 4: TF-IDF

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

三个文件，五个词汇（“the”、“cat”、“sat”、“dog”、“ran”）。' the '出现在这三者中，因此其IDF较低。“狗”出现在其中，所以它的IDF很高。载体很稀疏（大多数条目很小），并且区分词很流行。

### Step 5: L2-normalize rows

```python
def l2_normalize(matrix):
    out = []
    for row in matrix:
        norm = math.sqrt(sum(x * x for x in row))
        out.append([x / norm if norm else 0 for x in row])
    return out
```

如果没有规范化，更长的文档会获得更大的载体并主导相似性分数。L2规范化将每个文档置于单位超球体上。行之间的Cosine相似度现在只是点积。

## Use It

scikit-learn推出了生产版本。

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

“CountVectorizer”在一次调用中完成标记化、词汇和BoW。“TfidfVectorizer”添加了IDF加权和L2正规化。两者都返回稀疏矩阵。对于100 k个文档，密集版本不适合内存;保持稀疏，直到分类器要求密集。

改变一切的旋钮：

| Arg | 效果 |
|-----|--------|
| ' ngram_Range=（1，2）' | 包括二元组合。通常会提高分类。 |
| ' min_DF=2 ' | 删除少于2个文档的单词。修剪有噪数据的词汇。 |
| “max_DF=0.95” | 超过95%的文档中删除了单词。在没有硬编码列表的情况下大约删除停止词。 |
| ' stop_words=“english”' | scikit-learn的内置停止词列表。任务相关情绪分析不应该放弃否定。 |
| '次线性_tf=True ' | 使用“1 + log（tf）”而不是原始的“tf”。当一个术语在一个文档中重复多次时会有所帮助。 |

### When TF-IDF still wins (as of 2026)

- 垃圾邮件检测、主题标签、日志异常标记。单词的存在才是重要的;语义细微差别并不重要。
- 低数据制度（数百个标记示例）。TF-IDF加上逻辑回归没有预训练成本。
- 任何地方的延迟问题。TF-IDF加上一个线性模型在微秒内回答。通过Transformer嵌入文档需要10- 100 ms。
- 必须解释其预测的系统。检查分类器的系数。顶级积极的词就是原因。

### When TF-IDF fails

语义失明失败。考虑这两个文件：

- “这部电影一点也不好。"
- “这部电影非常棒。"

一是负面评论。一是积极的。他们的TF-IDF重叠正是“{the，movie，were}”。词袋分类器必须记住“不”接近“好”这个词会翻转标签。它可以在足够的数据上学习这一点，但永远不会像理解语法的模型那样优雅。

另一个失败：推理时词汇量不足。如果“Zoomer-approved”在培训中从未出现在培训中，根据IMDB评论训练的BoW模型不知道该如何处理该如何处理。子字嵌入（第04课）处理这个问题。TF-IDF不能。

### Hybrid: TF-IDF weighted embeddings

2026年中等数据分类的实用默认：使用TF-IDF权重作为单词嵌入的注意力。

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

您从嵌入中获得语义能力，并从TF-IDF中获得稀有词强调。分类器在池的载体上训练。对于低于约50 k个标签示例的情感、主题和意图分类，这本身的表现优于。

## Ship It

另存为“输出/prompt-vectorization-picker.md”：

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

## Exercises

1. ** 简单。**在L2规格化的TF-IDF输出上实现“cos_similarity（Doc_vec_a，Doc_vec_b）”。验证相同的文档评分为1.0，词汇不连续的文档评分为0.0。
2. ** 中等。**将“n-gram”支持添加到“bag_of_words”中。参数“n”生成“n”-gram上的计数。测试“n=2”在“[“the”，“cat”，“sat”]上生成“[“the cat”，“cat sat”]'的二元组合计数。
3. ** 很难。**使用GloVe 100d载体构建上述TF-IDF加权嵌入混合体（下载一次，缓存）。将分类准确性与20个新闻组数据集中的纯TF-IDF和纯均值池嵌入进行比较。报告哪个在哪里获胜。

## Key Terms

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 弓 | 词频向量 | 一个文档中的词汇数。扔掉命令。 |
| TF | Term频率 | 文档中单词的计数，可以选择通过文档长度进行规格化。 |
| DF | 文档频率 | 至少包含一次该单词的文档计数。 |
| IDF | 逆文档频率 | ' log（N / DF）'已平滑。淡化到处出现的单词。 |
| 稀疏向量 | 大部分是零 | 词汇量通常为10 k-100 k个单词;大多数单词在任何给定文档中都没有。 |
| 余弦相似度 | 矢量角 | L2正规化载体的点积。1是相同的，0是垂直的。 |

## Further Reading

- [scikit-learn -从文本中提取特征]（https：//scikit-learn.org/stable/modules/feature_extraction.html#text-feature-extraction）-规范的API参考，以及每个旋钮上的注释。
- [索尔顿，G.，&巴克利，C.（1988）。自动文本检索中的术语加权方法]（https：//www.sciencedirect.com/science/article/pii/0306457388900210）-这篇论文使TF-IDF成为十年的默认版本。
- [“为什么TF-IDF仍然胜过Embeddings”- Ashfaque Thonikkadavan（Medium）]（https：//medium.com/@cmtwskb/why-tf-idf-still-beats-embeddings-ad85c123e1b2）- 2026年旧方法获胜的时间以及原因。
