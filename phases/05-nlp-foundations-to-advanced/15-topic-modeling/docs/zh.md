# 主题建模——LDA 与 BERTopic

> LDA：文档是主题的混合，主题是词上的分布。BERTopic：文档在 embedding 空间中聚类，聚类就是主题。同样的目标，不同的分解方式。

**类型：** 学习
**语言：** Python
**前置知识：** 阶段 5 · 02（BoW + TF-IDF），阶段 5 · 03（Word2Vec）
**时间：** ~45 分钟

## 问题

你有 10,000 个客户支持工单、50,000 篇新闻文章或 200,000 条推文。你需要不阅读就能知道集合是关于什么的。你没有标注类别。你甚至不知道存在多少类别。

主题建模在无监督的情况下回答这个问题。给它一个语料库，返回一小组合连贯的主题，以及每个文档在这些主题上的分布。

两种算法家族主导。LDA（2003）将每个文档视为潜在主题的混合，每个主题视为词上的分布。推理是贝叶斯式的。当你需要混合成员主题分配和可解释的词级概率分布时，它仍在生产中交付。

BERTopic（2020）用 BERT 编码文档，用 UMAP 降维，用 HDBSCAN 聚类，并通过基于类别的 TF-IDF 提取主题词。它在短文本、社交媒体以及语义相似度比词重叠更重要的任何事物上胜出。一个文档得到一个主题，这对长文本来说是一个限制。

本课建立对两者的直觉，并指出对于给定语料库选择哪一个。

## 概念

**LDA 生成故事。** 每个主题是词上的分布。每个文档是主题的混合。为了生成文档中的一个词，从文档的混合中采样一个主题，然后从该主题的分布中采样一个词。推理反转这个过程：给定观察到的词，推断每个文档的主题分布和每个主题的词分布。Collapsed Gibbs sampling 或 variational Bayes 完成数学计算。

关键 LDA 输出：

- `doc_topic`：矩阵 `(n_docs, n_topics)`，每行总和为 1（文档的主题混合）。
- `topic_word`：矩阵 `(n_topics, vocab_size)`，每行总和为 1（主题的词分布）。

**BERTopic pipeline。**

1. 用 sentence transformer（如 `all-MiniLM-L6-v2`）编码每个文档。384 维向量。
2. 用 UMAP 降维到约 5 维。BERT embeddings 对于聚类来说维度过高。
3. 用 HDBSCAN 聚类。基于密度，产生可变大小的聚类和一个"离群"标签。
4. 对每个聚类，计算基于类别的 TF-IDF 以提取顶部词。

输出是每个文档一个主题（加上一个 -1 离群标签）。可选地，通过 HDBSCAN 的概率向量实现软成员关系。

## 开始构建

### 第 1 步：通过 scikit-learn 实现 LDA

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

注意：停用词被移除，min_df 和 max_df 过滤罕见和常见词，使用 CountVectorizer（而不是 TfidfVectorizer），因为 LDA 期望原始计数。

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

`Topic != -1` 的过滤去掉了 BERTopic 的离群桶（HDBSCAN 无法聚类的文档）。`min_topic_size` 控制 HDBSCAN 的最小聚类大小；BERTopic 的库默认值是 10。此示例为了本课程规模将其显式设置为 15。对于超过 10,000 个文档的语料库，增加到 50 或 100。

### 第 3 步：评估

两种方法都输出主题词。问题是这些词是否连贯。

- **主题连贯性（c_v）。** 结合滑动窗口上下文中顶部词对的 NPMI（归一化点互信息），将分数聚合成主题向量，并通过 cosine similarity 比较这些向量。越高越好。使用 `gensim.models.CoherenceModel` 并设置 `coherence="c_v"`。
- **主题多样性。** 所有主题顶部词中唯一词的比例。越高越好（主题不重叠）。
- **定性检查。** 阅读每个主题的顶部词。它们命名了真实事物吗？人工判断仍然是最后一道防线。

## 何时选择哪个

| 场景 | 选择 |
|-----------|------|
| 短文本（推文、评论、标题） | BERTopic |
| 具有主题混合的长文档 | LDA |
| 无 GPU / 计算受限 | LDA 或 NMF |
| 需要文档级多主题分布 | LDA |
| 用于主题标签的 LLM 集成 | BERTopic（直接支持） |
| 资源受限的边缘部署 | LDA |
| 最大语义连贯性 | BERTopic |

最大的实际考虑是文档长度。BERT embeddings 会截断；LDA 计数在任何长度上都有效。对于比 embedding 模型上下文更长的文档，要么分块 + 聚合，要么使用 LDA。

## 使用现成工具

2026 年技术栈：

- **BERTopic。** 短文本以及语义重要的任何内容的默认选择。
- **`gensim.models.LdaModel`。** 用于生产的经典 LDA，成熟、久经考验。
- **`sklearn.decomposition.LatentDirichletAllocation`。** 用于实验的简单 LDA。
- **NMF。** 非负矩阵分解。LDA 的快速替代，在短文本上质量相当。
- **Top2Vec。** 与 BERTopic 类似设计。社区较小，但在某些基准测试上表现良好。
- **FASTopic。** 较新，在非常大的语料库上比 BERTopic 更快。
- **基于 LLM 的标签。** 运行任何聚类，然后提示模型为每个聚类命名。

## 交付

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

Refuse BERTopic on documents longer than the embedding model context window without a chunking strategy. Refuse LDA on very short text (tweets, reviews under 10 tokens) as coherence collapses. Flag any n_topics choice below 5 as likely wrong; flag >200 on corpora under 40k docs as likely over-splitting.
```

## 练习

1. **简单。** 在 20 Newsgroups 数据集上用 5 个主题拟合 LDA。打印每个主题的前 10 个词。手动为每个主题打标签。算法是否找到了真正的类别？
2. **中等。** 在相同的 20 Newsgroups 子集上拟合 BERTopic。比较找到的主题数量、顶部词和定性连贯性。哪个更清晰地展现了真正的类别？
3. **困难。** 在你的语料库上计算 LDA 和 BERTopic 的 c_v 连贯性。分别用 5、10、20、50 个主题运行。绘制连贯性与主题数量的关系。报告哪种方法在不同主题数量下更稳定。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Topic | 语料库讨论的事物 | 词上的概率分布（LDA）或相似文档的聚类（BERTopic）。 |
| Mixed membership | 文档属于多个主题 | LDA 为每个文档分配在所有主题上的分布。 |
| UMAP | 降维 | 保留局部结构的流形学习；用于 BERTopic。 |
| HDBSCAN | 密度聚类 | 找到可变大小的聚类；对离群点产生"噪声"标签（-1）。 |
| c_v coherence | 主题质量指标 | 滑动窗口内顶部主题词的平均点互信息。 |

## 延伸阅读

- [Blei, Ng, Jordan (2003). Latent Dirichlet Allocation](https://www.jmlr.org/papers/volume3/blei03a/blei03a.pdf) —— LDA 论文。
- [Grootendorst (2022). BERTopic: Neural topic modeling with a class-based TF-IDF procedure](https://arxiv.org/abs/2203.05794) —— BERTopic 论文。
- [Röder, Both, Hinneburg (2015). Exploring the Space of Topic Coherence Measures](https://svn.aksw.org/papers/2015/WSDM_Topic_Evaluation/public.pdf) —— 引入 c_v 及其相关指标的论文。
- [BERTopic documentation](https://maartengr.github.io/BERTopic/) —— 生产参考。优秀示例。
