# 15 · 主题建模——LDA 与 BERTopic

> LDA：文档是主题的混合，主题是词上的分布。BERTopic：文档在嵌入空间中聚类，聚类即主题。目标相同，分解方式不同。

**类型：** 学习
**语言：** Python
**前置：** 阶段 5 · 02（词袋 + TF-IDF），阶段 5 · 03（Word2Vec）
**时长：** 约 45 分钟

## 问题所在

你手里有 10,000 条客户支持工单、50,000 篇新闻文章，或者 200,000 条推文。你需要在不通读的前提下，知道这个集合都在讲什么。你没有带标签的类别，甚至连到底有多少个类别都不清楚。

主题建模（topic modeling）能在无监督的情况下回答这个问题。喂给它一个语料库，它会返回一小组连贯的主题，并为每篇文档给出一个在这些主题上的分布。

主导该领域的有两大算法家族。LDA（2003）把每篇文档看作潜在主题的混合，把每个主题看作词上的分布，其推断是贝叶斯式的。在那些需要混合归属（mixed-membership）主题分配、以及需要可解释的词级概率分布的场景里，它至今仍活跃在生产环境中。

BERTopic（2020）用 BERT 对文档编码，用 UMAP 降维，用 HDBSCAN 聚类，再通过基于类别的 TF-IDF（class-based TF-IDF）抽取主题词。它在短文本、社交媒体，以及任何语义相似性比词面重叠更重要的场景里都更胜一筹。它的局限是一篇文档只对应一个主题，这对长篇内容并不友好。

本课为这两者建立直觉，并讲清在给定语料库下该选哪一个。

## 核心概念

〔图：LDA 混合模型与 BERTopic 聚类对比〕

**LDA 的生成式故事。** 每个主题是词上的一个分布，每篇文档是若干主题的混合。要在一篇文档中生成一个词，先从文档的主题混合中采样出一个主题，再从该主题的分布中采样出一个词。推断则是逆向过程：给定观测到的词，反推每篇文档的主题分布和每个主题的词分布。具体计算由坍缩吉布斯采样（collapsed Gibbs sampling）或变分贝叶斯（variational Bayes）完成。

LDA 的关键输出：

- `doc_topic`：矩阵 `(n_docs, n_topics)`，每一行之和为 1（文档的主题混合）。
- `topic_word`：矩阵 `(n_topics, vocab_size)`，每一行之和为 1（主题的词分布）。

**BERTopic 流水线。**

1. 用句向量转换器（sentence transformer，例如 `all-MiniLM-L6-v2`）对每篇文档编码，得到 384 维向量。
2. 用 UMAP 降维到约 5 维。BERT 嵌入维度太高，不适合直接聚类。
3. 用 HDBSCAN 聚类。它基于密度，能产生大小可变的簇，并给出一个「离群（outlier）」标签。
4. 对每个簇，在该簇的文档上计算基于类别的 TF-IDF，抽取出最具代表性的词。

输出是每篇文档对应一个主题（外加一个 -1 离群标签）。可选地，还能通过 HDBSCAN 的概率向量得到一种软归属。

## 动手实现

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

注意几点：去除了停用词；min_df 和 max_df 过滤掉过于罕见和过于普遍的词项；用的是 CountVectorizer（而不是 TfidfVectorizer），因为 LDA 期望的是原始词频计数。

### 第 2 步：BERTopic（生产环境）

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

对 `Topic != -1` 的过滤丢弃了 BERTopic 的离群桶（HDBSCAN 无法聚类的文档）。`min_topic_size` 控制 HDBSCAN 的最小簇大小；BERTopic 库的默认值是 10。本例为配合本课的数据规模显式设为 15。对于超过 10,000 篇文档的语料库，应增大到 50 或 100。

### 第 3 步：评估

两种方法都会输出主题词。问题在于这些词是否真正连贯。

- **主题连贯度（topic coherence，c_v）。** 它在滑动窗口上下文中计算高频主题词两两之间的 NPMI（归一化点互信息，normalized pointwise mutual information），把这些分数聚合成主题向量，再通过余弦相似度比较这些向量。越高越好。可用 `gensim.models.CoherenceModel`，设置 `coherence="c_v"`。
- **主题多样性（topic diversity）。** 所有主题的高频词中唯一词所占的比例。越高越好（说明各主题彼此不重叠）。
- **定性检查。** 阅读每个主题的高频词。它们是否指向一个真实存在的事物？人工判断仍是最后一道防线。

## 何时选哪个

| 情形 | 选择 |
|-----------|------|
| 短文本（推文、评论、标题） | BERTopic |
| 含主题混合的长文档 | LDA |
| 无 GPU / 算力有限 | LDA 或 NMF |
| 需要文档级的多主题分布 | LDA |
| 用 LLM 做主题标注 | BERTopic（原生支持） |
| 资源受限的边缘部署 | LDA |
| 追求最高语义连贯度 | BERTopic |

最重要的现实考量是文档长度。BERT 嵌入会截断；而 LDA 的计数对任意长度都管用。对于超出嵌入模型上下文长度的文档，要么切块 + 聚合，要么改用 LDA。

## 实际应用

2026 年的技术栈：

- **BERTopic。** 短文本以及任何重视语义场景下的默认选择。
- **`gensim.models.LdaModel`。** 经典 LDA，面向生产，成熟且久经考验。
- **`sklearn.decomposition.LatentDirichletAllocation`。** 用于实验的轻量 LDA。
- **NMF。** 非负矩阵分解（non-negative matrix factorization）。LDA 的快速替代方案，在短文本上质量相当。
- **Top2Vec。** 设计上与 BERTopic 类似。社区较小，但在部分基准上表现不错。
- **FASTopic。** 更新、在超大语料库上比 BERTopic 更快。
- **基于 LLM 的标注。** 先跑任意聚类，再提示模型为每个簇命名。

## 交付物

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

1. **简单。** 在 20 Newsgroups 数据集上用 5 个主题拟合 LDA。打印每个主题的前 10 个词，手动为每个主题打标签。算法找到真实的类别了吗？
2. **中等。** 在同一份 20 Newsgroups 子集上拟合 BERTopic。把它找到的主题数量、高频词以及定性连贯度与 LDA 作比较。哪个更清晰地浮现出真实类别？
3. **困难。** 在你的语料库上同时为 LDA 和 BERTopic 计算 c_v 连贯度。分别用 5、10、20、50 个主题运行。绘制连贯度随主题数量变化的曲线。报告哪种方法在不同主题数量下更稳定。

## 关键术语

| 术语 | 人们口中的说法 | 它实际的含义 |
|------|-----------------|-----------------------|
| 主题（Topic） | 语料库所讲的某个事物 | 词上的一个概率分布（LDA），或一组相似文档的聚类（BERTopic）。 |
| 混合归属（Mixed membership） | 一篇文档属于多个主题 | LDA 为每篇文档分配一个覆盖所有主题的分布。 |
| UMAP | 降维 | 一种保留局部结构的流形学习；用于 BERTopic。 |
| HDBSCAN | 密度聚类 | 找出大小可变的簇；为离群点产生「噪声」标签（-1）。 |
| c_v 连贯度 | 主题质量度量 | 滑动窗口内高频主题词的平均点互信息。 |

## 延伸阅读

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) —— LDA 原始论文。
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) —— BERTopic 论文。
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) —— 提出 c_v 及其同类度量的论文。
- [BERTopic 文档](https://maartengr.github.io/BERTopic/) —— 生产环境参考，示例极佳。
