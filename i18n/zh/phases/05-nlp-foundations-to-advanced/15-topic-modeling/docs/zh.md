# 主题建模 — LDA 与 BERTopic

> LDA：文档是主题的混合，主题是词上的分布。BERTopic：文档在嵌入空间中聚类，簇即主题。目标相同，分解方式不同。

**Type:** Learn
**Languages:** Python
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF)、Phase 5 · 03 (Word2Vec)
**Time:** 约 45 分钟

## 问题所在

你手上有 10,000 条客户支持工单、50,000 篇新闻文章，或 200,000 条推文。你需要在不通读的情况下了解这个集合的内容。你没有标注好的类别，甚至不知道存在多少个类别。

主题建模可以在无监督的情况下回答这个问题。给它一个语料库，它会返回一小组连贯的主题，以及每篇文档在这些主题上的分布。

两大算法家族占主导地位。LDA（2003）把每篇文档视为潜在主题的混合，把每个主题视为词上的分布。推断是贝叶斯式的。当你需要混合归属的主题分配以及可解释的词级概率分布时，它仍然在生产环境中使用。

BERTopic（2020）用 BERT 对文档编码，用 UMAP 降维，用 HDBSCAN 聚类，并通过基于类别的 TF-IDF 提取主题词。它在短文本、社交媒体以及语义相似性比词重叠更重要的场景中占优。每篇文档只分配到一个主题，这对长文本是一个限制。

本课为两者建立直观理解，并说明针对给定语料库应选哪一个。

## 核心概念

![LDA mixture model vs BERTopic clustering](../assets/topic-modeling.svg)

**LDA 生成故事。** 每个主题是词上的分布。每篇文档是主题的混合。要生成文档中的一个词，先从文档的主题混合中采样一个主题，再从该主题的分布中采样一个词。推断是反向过程：给定观测到的词，推断每篇文档的主题分布和每个主题的词分布。塌缩 Gibbs 采样或变分贝叶斯负责其中的数学计算。

LDA 的关键输出：

- `doc_topic`：矩阵 `(n_docs, n_topics)`，每行和为 1（文档的主题混合）。
- `topic_word`：矩阵 `(n_topics, vocab_size)`，每行和为 1（主题的词分布）。

**BERTopic 流水线。**

1. 用句子 transformer（例如 `all-MiniLM-L6-v2`）对每篇文档编码。得到 384 维向量。
2. 用 UMAP 降到约 5 维。BERT 嵌入的维度太高，不适合直接聚类。
3. 用 HDBSCAN 聚类。基于密度，产生大小可变的簇以及一个“离群点”标签。
4. 对每个簇，在该簇的文档上计算基于类别的 TF-IDF，提取top词。

输出是每篇文档一个主题（外加 -1 离群标签）。可选地，通过 HDBSCAN 的概率向量得到软归属。

```figure
topic-drift
```

## 动手构建

### 第 1 步：用 scikit-learn 实现 LDA

```python
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.decomposition import LatentDirichletAllocation
import numpy as np


def fit_lda(documents, n_topics=5, max_features=1000):
    cv = CountVectorizer(
        max_features=max_features,
        stop_words="english",
        min_df=2,
        max_df=0.9,
    )
    X = cv.fit_transform(documents)
    lda = LatentDirichletAllocation(
        n_components=n_topics,
        random_state=42,
        max_iter=50,
        learning_method="online",
    )
    doc_topic = lda.fit_transform(X)
    feature_names = cv.get_feature_names_out()
    return lda, cv, doc_topic, feature_names


def print_top_words(lda, feature_names, n_top=10):
    for idx, topic in enumerate(lda.components_):
        top_idx = np.argsort(-topic)[:n_top]
        words = [feature_names[i] for i in top_idx]
        print(f"topic {idx}: {' '.join(words)}")
```

注意：已去除停用词，min_df 和 max_df 过滤罕见词和无处不在的词，使用 CountVectorizer（而非 TfidfVectorizer），因为 LDA 期望原始计数。

### 第 2 步：BERTopic（生产级）

```python
from bertopic import BERTopic

topic_model = BERTopic(
    embedding_model="sentence-transformers/all-MiniLM-L6-v2",
    min_topic_size=15,
    verbose=True,
)

topics, probs = topic_model.fit_transform(documents)
info = topic_model.get_topic_info()
print(info.head(20))
valid_topics = info[info["Topic"] != -1]["Topic"].tolist()
for topic_id in valid_topics[:5]:
    print(f"topic {topic_id}: {topic_model.get_topic(topic_id)[:10]}")
```

对 `Topic != -1` 的过滤会丢弃 BERTopic 的离群桶（HDBSCAN 无法聚类的文档）。`min_topic_size` 控制 HDBSCAN 的最小簇大小；BERTopic 库的默认值是 10。本例针对本课的规模将其显式设为 15。对于超过 10,000 篇文档的语料库，建议提高到 50 或 100。

### 第 3 步：评估

两种方法都输出主题词。问题是这些词是否连贯。

- **主题一致性（c_v）。** 在滑动窗口上下文中计算 top 词对的 NPMI（归一化逐点互信息），将分数聚合成主题向量，并通过余弦相似度比较这些向量。越高越好。使用 `gensim.models.CoherenceModel` 配合 `coherence="c_v"`。
- **主题多样性。** 所有主题的 top 词中唯一词的比例。越高越好（主题之间不重叠）。
- **定性检查。** 阅读每个主题的 top 词。它们是否指向某个真实的东西？人工判断仍是最后一道防线。

## 何时选哪一个

| 情况 | 选择 |
|-----------|------|
| 短文本（推文、评论、标题） | BERTopic |
| 具有主题混合的长文档 | LDA |
| 无 GPU / 算力有限 | LDA 或 NMF |
| 需要文档级多主题分布 | LDA |
| 用 LLM 做主题标注 | BERTopic（直接支持） |
| 资源受限的边缘部署 | LDA |
| 追求最大语义一致性 | BERTopic |

最大的实际考量是文档长度。BERT 嵌入会截断；LDA 的词计数对任意长度都有效。对于超过嵌入模型上下文长度的文档，要么分块再聚合，要么使用 LDA。

## 实践中的使用

2026 年的技术栈：

- **BERTopic。** 短文本以及任何语义重要的场景的默认选择。
- **`gensim.models.LdaModel`。** 经典 LDA 用于生产环境，成熟，久经考验。
- **`sklearn.decomposition.LatentDirichletAllocation`。** 易于用于实验的 LDA。
- **NMF。** 非负矩阵分解。LDA 的快速替代方案，在短文本上质量相当。
- **Top2Vec。** 设计与 BERTopic 类似。社区较小，但在某些基准上表现良好。
- **FASTopic。** 更新，在超大规模语料库上比 BERTopic 更快。
- **基于 LLM 的标注。** 运行任意聚类，然后提示模型为每个簇命名。

## 上线部署

保存为 `outputs/skill-topic-picker.md`：

```markdown
---
name: topic-picker
description: Pick LDA or BERTopic for a corpus. Specify library, knobs, evaluation.
version: 1.0.0
phase: 5
lesson: 15
tags: [nlp, topic-modeling]
---

Given a corpus description (document count, avg length, domain, language, compute budget), output:

1. Algorithm. LDA / NMF / BERTopic / Top2Vec / FASTopic. One-sentence reason.
2. Configuration. Number of topics: `recommended = max(5, round(sqrt(n_docs)))`, clamped to 200 for corpora under 40,000 docs; permit >200 only when the corpus is genuinely large (>40k) and note the increased compute cost. `min_df` / `max_df` filters and embedding model for neural approaches also belong here.
3. Evaluation. Topic coherence (c_v) via `gensim.models.CoherenceModel`, topic diversity, and a 20-sample human read.
4. Failure mode to probe. For LDA, "junk topics" absorbing stopwords and frequent terms. For BERTopic, the -1 outlier cluster swallowing ambiguous documents.

Refuse BERTopic on documents longer than the embedding model's context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## 练习

1. **简单。** 在 20 Newsgroups 数据集上拟合 5 个主题的 LDA。打印每个主题的 top 10 词。手动为每个主题命名。算法找到真实的类别了吗？
2. **中等。** 在相同的 20 Newsgroups 子集上拟合 BERTopic。比较两种方法找到的主题数量、top 词以及定性一致性。哪一种更清晰地呈现出真实类别？
3. **困难。** 在你的语料库上为 LDA 和 BERTopic 计算 c_v 一致性。分别用 5、10、20、50 个主题运行。绘制一致性与主题数量的关系图。报告哪种方法在不同主题数量下更稳定。

## 关键术语

| 术语 | 人们的说法 | 实际含义 |
|------|-----------------|-----------------------|
| 主题 | 语料库所涉及的一个东西 | 词上的概率分布（LDA）或相似文档的簇（BERTopic）。 |
| 混合归属 | 文档属于多个主题 | LDA 为每篇文档分配所有主题上的一个分布。 |
| UMAP | 降维 | 保持局部结构的流形学习；用于 BERTopic。 |
| HDBSCAN | 密度聚类 | 找到大小可变的簇；为离群点产生“噪声”标签（-1）。 |
| c_v 一致性 | 主题质量指标 | 滑动窗口内主题 top 词的平均逐点互信息。 |

## 延伸阅读

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) — LDA 原始论文。
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) — BERTopic 原始论文。
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) — 提出 c_v 及其他一致性度量的论文。
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) — 生产环境参考。示例非常出色。