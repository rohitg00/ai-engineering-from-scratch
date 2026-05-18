# 文本摘要

> 提取系统会告诉您文件中所说的内容。抽象系统告诉你作者的意思。不同的任务，不同的陷阱。

** 类型：** 构建
** 语言：** Python
** 预处理：** 阶段5 · 02（BoW + TF-IDF），阶段5 · 11（机器翻译）
** 时间：** ~75分钟

## 问题

一篇2，000字的新闻文章出现在您的源中。您需要120个单词来捕捉它。您可以从文章中挑选三个最重要的句子（摘录），也可以用自己的话重写内容（抽象）。两者都称为总结。它们是完全不同的问题。

提取性摘要是一个排名问题。给每句话打分，返回顶部-' k '。输出始终符合语法，因为它是逐字提取的。风险是丢失跨文章分布的内容。

摘要是一个生成问题。Transformer根据输入产生新文本。输出是流畅和压缩，但可能幻觉的事实，而不是在源。风险是自信的捏造。

这一课构建了两者，以及各自拥有的失败模式。

## 概念

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

** 榨取。**将文章视为一个图表，其中节点是句子，边是相似之处。在图表上运行PageRank（或类似的东西），根据句子与其他内容的联系程度对句子进行评分。得分最高的句子是摘要。规范实现是 **TextRank**（Mihalcea和Tarau，2004）。

** 抽象的。**在文档摘要对上微调Transformer编码器-解码器（BART、T5、Pegasus）。在推理时，模型读取文档并通过交叉注意逐令牌生成摘要。Pegasus特别使用间隔句预训练目标，使其在总结方面表现出色，无需进行太多微调。

使用 **ROUGE**（Gisting评估的以回忆为导向的替补）进行评估。ROUGE-1和ROUGE-2评分一元语法和二元语法重叠。ROUGE-L评分最长的公共子序列。越高越好，但40 ROUGE-L是“好”，50是“例外”。“每份报纸都报道了这三个因素。使用“Rouge-score”包。

## 建设党

### 第1步：文本Rank（提取）

```python
import math
import re
from collections import Counter


def sentence_split(text):
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    scores = [1.0] * n
    for _ in range(iterations):
        new_scores = [1 - damping] * n
        for i in range(n):
            total_out = sum(sim[i]) or 1e-9
            for j in range(n):
                if sim[i][j] > 0:
                    new_scores[j] += damping * sim[i][j] / total_out * scores[i]
        if max(abs(s - ns) for s, ns in zip(scores, new_scores)) < epsilon:
            scores = new_scores
            break
        scores = new_scores

    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

有两件事值得点名。相似度函数使用日志规格化单词重叠，这是原始的TextRank变体。TF-IDF载体的Cosine也有效。衰减因子0.85和迭代计数是PageRank的默认值。

### 第2步：使用BART进行抽象

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN在CNN/DailyMail文集上进行了微调。它可以立即生成新闻风格的摘要。对于其他领域（科学论文、对话、法律），请使用相应的Pegasus检查点或微调目标数据。

### 第3步：ROUGE评估

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

始终使用词干。如果没有它，“running”和“run”就算作不同的词，而ROUGE低估了。

### 超越ROUGE（2026年总结评估）

二十年来，ROUGE一直是主要的摘要指标，但到2026年，它本身还不够。对NLG论文的大规模荟萃分析显示：

- **BERTScore**（上下文嵌入相似性）在2023年取得了进展，现在在大多数摘要论文中与ROUGE一起报道。
- **BARTScore** 将评估视为生成：根据预先训练的BART在给定源的情况下分配摘要的可能性对摘要进行评分。
- **MoverScore**（Earth Move ' s Distance on context嵌入）在2025年摘要基准中达到榜首，因为它比ROUGE更好地捕捉语义重叠。
- **FactCC** 和 ** 基于QA的忠诚度 ** 在2021-2023年很常见，现在通常被 **G-Eval**（GPT-4提示链，对连贯性、一致性、流畅性、与思想链推理的相关性进行评分）取代。
- **G-Eval** 和类似的LLM判断方法在设计良好时，约80%的情况下与人类判断相匹配。

制作建议：报告ROUGE-L用于传统比较，BERTScore用于语义重叠，G-Eval用于连贯性和真实性。根据50-100个人类标记的摘要进行校准。

### 第4步：真实性问题

抽象的摘要容易产生幻觉。提取性摘要的幻觉风险要低得多，因为输出是从源中逐字提取的，尽管如果源句子去语境化、过时或引用无序，它们仍然可能会误导。这是生产系统仍然更喜欢提取方法来提取符合合规性的内容的最大原因。

幻觉类型：

- ** 实体交换。**消息人士称“约翰·史密斯。“总结说”约翰·布朗。"
- ** 数字漂移。**消息人士称“25，000。“总结上说”2500万。"
- ** 两极翻转。**消息人士称“拒绝了这一提议。“总结说”接受了提议。"
- ** 事实发明。**消息人士没有提及首席执行官。摘要称首席执行官批准了。

有效的评估方法：

- ** 事实CC。**一个二元分类器，根据源句和摘要句之间的蕴含进行训练。预测事实/非事实。
- ** 基于QA的事实。**向QA模型提出答案在源代码中的问题。如果摘要支持不同的答案，请标记。
- ** 超级F1。**比较源与摘要中的命名实体。仅出现在摘要中的实体是可疑的。

对于任何面向用户且真实重要的事物（新闻、医疗、法律、金融）来说，提取是更安全的默认选项。Abstract需要在循环中进行真实性检查。

## 使用它

2026年堆栈：

| 用例 | 建议 |
|---------|-------------|
| 新闻，3-5句话摘要，英语 | “Facebook/bart-large-cnn” |
| 科学论文 | “google/pegasus-pubmed”或已调好的T5 |
| 多文档、长格式 | 任何具有32 k以上上下文的LLM，都会提示 |
| 对话摘要 | “philschmid/bart-large-cnn-samsum” |
| 提取性、建筑产生低幻觉风险 | TextRank或' sumy '的LSA / LexRank |

在2026年，当计算不是一个约束时，具有长上下文的LLM通常会击败专门的模型。代价是成本和可重复性;专门的模型提供更一致的输出。

## 把它运

另存为“输出/skill-summary-picker.md”：

```markdown
---
name: summary-picker
description: Pick extractive or abstractive, named library, factuality check.
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

Given a task (document type, compliance requirement, length, compute budget), output:

1. Approach. Extractive or abstractive. Explain in one sentence why.
2. Starting model / library. Name it. `sumy.TextRankSummarizer`, `facebook/bart-large-cnn`, `google/pegasus-pubmed`, or an LLM prompt.
3. Evaluation plan. ROUGE-1, ROUGE-2, ROUGE-L (use rouge-score with stemming). Plus factuality check if abstractive.
4. One failure mode to probe. Entity swap is the most common in abstractive news summarization; flag samples where source entities do not appear in summary.

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model's context window as needing chunked map-reduce summarization (not just truncation).
```

## 演习

1. ** 简单。**对5篇新闻文章运行TextRank。将前3个句子与参考摘要进行比较。测量ROUGE-L。您应该在CNN/Daily Mail风格的文章上看到30-45 ROUGE-L。
2. ** 中等。**实现实体层面的真实性：从源和摘要中提取命名实体（spaCy），计算摘要中源实体的召回率以及摘要实体相对于源的精确度。高精确度和低召回意味着安全但简洁;低精确度意味着实体出现幻觉。
3. ** 很难。**在50篇CNN/Daily Mail文章中比较BART-large-CNN与LLM（Claude或GPT-4）。报告ROUGE-L、事实（按实体F1）和汇总的成本。记录每个人获胜的地方。

## 关键术语

| Term | 别人怎么说 | 它实际上意味着什么 |
|------|-----------------|-----------------------|
| 采掘 | 挑选句子 | 从来源逐字返回句子。从不产生幻觉。 |
| 抽象 | 重写 | 根据来源生成新文本。会产生幻觉。 |
| 胭脂 | 汇总度量 | 系统输出和参考之间的N-gram / LCS重叠。 |
| TextRank | 图形提取物 | 句子相似度图上的PageRank。 |
| 真实性 | 对吗 | 摘要主张是否得到消息来源的支持。 |
| 幻觉 | 虚构内容 | 摘要中来源不支持的内容。 |

## 进一步阅读

- [Mihalcea和Tarau（2004）。TextRank：将秩序带入文本]（https：//aclanthology.org/W04-3252/）-精选的权威论文。
- [刘易斯等人（2019）。BART：去噪序列到序列预训练]（https：//arxiv.org/ab/1910.13461）-BART论文。
- [张等人（2019）。PEGASUS：使用提取的空白句进行预训练]（https：//arxiv.org/ab/1912.08777）- Pegasus和空白句目标。
- [Lin（2004）。ROUGE：摘要自动评估包]（https：//aclanthology.org/W04-1013/）- ROUGE论文。
- [Maynez等人（2020）。论抽象摘要中的忠实和事实]（https：//arxiv.org/ab/2005.00661）-事实景观论文。
