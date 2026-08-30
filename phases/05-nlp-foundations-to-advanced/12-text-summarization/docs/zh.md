# 12 · 文本摘要

> 抽取式系统告诉你文档说了什么，生成式系统告诉你作者想表达什么。任务不同，陷阱也不同。

**类型：** 实践构建
**语言：** Python
**前置：** 阶段 5 · 02（词袋 + TF-IDF）、阶段 5 · 11（机器翻译）
**时长：** 约 75 分钟

## 问题所在

一篇 2000 字的新闻文章出现在你的信息流里，你需要用 120 个词把它讲清楚。你可以从文章中挑出最重要的三句话（抽取式），也可以用自己的话重写内容（生成式）。两者都叫做摘要，但它们是完全不同的两个问题。

抽取式摘要（extractive summarization）是一个排序问题：给每个句子打分，返回得分最高的 `k` 个句子。由于输出是逐字照搬的，因此总是符合语法。它的风险在于会漏掉那些分散在全文各处的信息。

生成式摘要（abstractive summarization）是一个生成问题：由一个 transformer 以输入为条件产出全新文本。输出流畅且高度压缩，但可能「幻觉（hallucination）」出原文中并不存在的事实。它的风险在于自信地凭空捏造。

本课会把两者都构建出来，并讲清各自专属的失效模式。

## 核心概念

〔图：抽取式 TextRank 与生成式 transformer 的对比〕

**抽取式。** 把文章看作一张图，节点是句子，边是句子间的相似度。在这张图上运行 PageRank（或类似算法），按某个句子与其余所有句子的连接紧密程度为其打分。得分最高的句子即为摘要。其经典实现就是 **TextRank**（Mihalcea 和 Tarau，2004）。

**生成式。** 在「文档-摘要」配对数据上微调一个 transformer 编码器-解码器（BART、T5、Pegasus）。推理时，模型读入文档，通过交叉注意力（cross-attention）逐 token 生成摘要。其中 Pegasus 尤为特别，它采用一种「间隔句（gap-sentence）」预训练目标，使其几乎无需太多微调就能出色地完成摘要任务。

评估使用 **ROUGE**（Recall-Oriented Understudy for Gisting Evaluation，面向召回的摘要评估替补指标）。ROUGE-1 和 ROUGE-2 分别衡量一元词（unigram）和二元词（bigram）的重叠，ROUGE-L 衡量最长公共子序列（longest common subsequence）。分数越高越好，但 40 的 ROUGE-L 算「不错」，50 才算「卓越」。每篇论文都会同时汇报这三项。使用 `rouge-score` 包即可。

## 动手构建

### 第 1 步：TextRank（抽取式）

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

有两点值得特别指出。相似度函数采用对数归一化的词重叠，这正是 TextRank 的原始变体。用 TF-IDF 向量的余弦相似度也可以。阻尼因子 0.85 和迭代次数都是 PageRank 的默认值。

### 第 2 步：用 BART 做生成式摘要

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN 是在 CNN/DailyMail 语料上微调得到的，开箱即可产出新闻风格的摘要。对于其他领域（科研论文、对话、法律），请使用对应的 Pegasus 检查点（checkpoint），或在你自己的目标数据上微调。

### 第 3 步：ROUGE 评估

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

务必开启词干提取（stemming）。否则，"running" 和 "run" 会被算作不同的词，导致 ROUGE 计数偏低。

### 超越 ROUGE（2026 年的摘要评估）

ROUGE 作为摘要领域的主流指标已统治了二十年，但在 2026 年单凭它已不够用。一项针对 NLG（自然语言生成）论文的大规模元分析表明：

- **BERTScore**（基于上下文嵌入的相似度）自 2023 年起逐渐普及，如今在大多数摘要论文中都与 ROUGE 一同汇报。
- **BARTScore** 把评估当作生成任务：给定原文，用预训练的 BART 评估它对该摘要赋予的生成概率有多高，以此为摘要打分。
- **MoverScore**（在上下文嵌入上计算推土机距离，Earth Mover's Distance）在 2025 年的摘要基准测试中登顶，因为它比 ROUGE 更能捕捉语义重叠。
- **FactCC** 和**基于问答（QA）的忠实度**指标在 2021-2023 年间很常见，如今常被 **G-Eval**（一条 GPT-4 提示链，借助思维链推理为连贯性、一致性、流畅度和相关性打分）取代。
- 当评分量表（rubric）设计得当时，**G-Eval** 及类似的 LLM 评判方法与人类判断的吻合率约为 80%。

生产环境建议：汇报 ROUGE-L 以便与历史结果对比，用 BERTScore 衡量语义重叠，用 G-Eval 评估连贯性与事实性。并基于 50-100 条人工标注的摘要进行校准。

### 第 4 步：事实性问题

生成式摘要容易产生幻觉。抽取式摘要的幻觉风险则低得多，因为输出是从原文逐字照搬的——尽管如果原文句子被脱离上下文、内容已过时或被打乱引用顺序，它仍可能造成误导。这正是生产系统在合规相关内容上至今仍偏好抽取式方法的最大原因。

值得命名的幻觉类型：

- **实体替换（Entity swap）。** 原文说 "John Smith"，摘要却写成 "John Brown"。
- **数字漂移（Number drift）。** 原文说 "25,000"，摘要却写成 "25 million"。
- **极性翻转（Polarity flip）。** 原文说 "rejected the offer"（拒绝了报价），摘要却写成 "accepted the offer"（接受了报价）。
- **凭空捏造事实（Fact invention）。** 原文从未提及 CEO，摘要却说 CEO 批准了。

行之有效的评估方法：

- **FactCC。** 一个二分类器，训练目标是判断原文句子与摘要句子之间的蕴含关系，预测「符合事实/不符合事实」。
- **基于问答的事实性。** 用一个问答模型提出一些答案可在原文中找到的问题。若摘要支持的答案不同，则标记出来。
- **实体级 F1（Entity-level F1）。** 比较原文与摘要中的命名实体（named entity）。只出现在摘要中的实体值得怀疑。

对于任何事实性至关重要的面向用户场景（新闻、医疗、法律、金融），抽取式都是更安全的默认选择。生成式则需要在流程中加入事实性检查。

## 实际运用

2026 年的技术栈：

| 使用场景 | 推荐方案 |
|---------|-------------|
| 新闻，3-5 句摘要，英文 | `facebook/bart-large-cnn` |
| 科研论文 | `google/pegasus-pubmed` 或微调后的 T5 |
| 多文档、长篇 | 任意支持 32k+ 上下文的 LLM，配合提示词 |
| 对话摘要 | `philschmid/bart-large-cnn-samsum` |
| 抽取式，结构上天然的低幻觉风险 | TextRank 或 `sumy` 的 LSA / LexRank |

在 2026 年，当算力不是瓶颈时，长上下文 LLM 往往能击败专用模型。其代价是成本与可复现性；专用模型给出的输出更稳定一致。

## 交付产物

保存为 `outputs/skill-summary-picker.md`：

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

## 练习

1. **简单。** 在 5 篇新闻文章上运行 TextRank。将得分最高的 3 个句子与参考摘要进行对比，测量 ROUGE-L。在 CNN/DailyMail 风格的文章上，你应能看到 30-45 的 ROUGE-L。
2. **中等。** 实现实体级事实性检查：从原文和摘要中提取命名实体（用 spaCy），计算原文实体在摘要中的召回率，以及摘要实体相对于原文的精确率。高精确率、低召回率意味着摘要安全但过于简略；低精确率则意味着出现了幻觉实体。
3. **困难。** 在 50 篇 CNN/DailyMail 文章上，对比 BART-large-CNN 与某个 LLM（Claude 或 GPT-4）。汇报 ROUGE-L、事实性（用实体 F1 衡量）以及每条摘要的成本。记录各自的优势所在。

## 关键术语

| 术语 | 人们怎么说 | 它实际指什么 |
|------|-----------------|-----------------------|
| 抽取式（Extractive） | 挑句子 | 从原文逐字返回句子，永不产生幻觉。 |
| 生成式（Abstractive） | 重写 | 以原文为条件生成新文本，可能产生幻觉。 |
| ROUGE | 摘要指标 | 系统输出与参考摘要之间的 N-gram / 最长公共子序列重叠度。 |
| TextRank | 基于图的抽取式方法 | 在句子相似度图上运行 PageRank。 |
| 事实性（Factuality） | 摘要对不对 | 摘要中的论断是否得到原文支持。 |
| 幻觉（Hallucination） | 编造的内容 | 摘要中原文无法支持的内容。 |

## 延伸阅读

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) —— 抽取式方法的经典论文。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) —— BART 论文。
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) —— Pegasus 及其间隔句目标。
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) —— ROUGE 论文。
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) —— 关于事实性全貌的论文。
