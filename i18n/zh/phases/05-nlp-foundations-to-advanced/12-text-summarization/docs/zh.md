# 文本摘要

> 抽取式系统告诉你文档说了什么。生成式系统告诉你作者想表达什么。任务不同，陷阱也不同。

**Type:** Build
**Languages:** Python
**Prerequisites:** Phase 5 · 02（BoW + TF-IDF），Phase 5 · 11（机器翻译）
**Time:** 约 75 分钟

## 问题

一篇 2000 字的新闻文章出现在你的信息流中。你需要 120 个词来概括它。你可以从文章中挑选最重要的三句话（抽取式），也可以用自己的话重写内容（生成式）。两者都被称为摘要，但它们是完全不同的问题。

抽取式摘要是一个排序问题。给每个句子打分，返回得分最高的前 `k` 个句子。输出在语法上始终正确，因为是逐字提取的。风险是可能遗漏分散在文章各处的内容。

生成式摘要是一个生成问题。Transformer 以输入为条件生成新文本。输出流畅且压缩性强，但可能幻觉出源文本中不存在的事实。风险是自信的捏造。

本课将构建两者，并分析各自特有的失败模式。

## 概念

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**抽取式。** 将文章视为一个图，节点是句子，边是相似度。在图上运行 PageRank（或类似算法），根据句子与其他内容的关联程度对句子打分。得分最高的句子构成摘要。经典实现是 **TextRank**（Mihalcea 和 Tarau，2004）。

**生成式。** 在文档-摘要对上微调 Transformer 编码器-解码器模型（BART、T5、Pegasus）。推理时，模型读取文档，通过交叉注意力逐 token 生成摘要。Pegasus 尤其使用了一种间隙句子预训练目标，使其无需大量微调就能在摘要任务上表现出色。

使用 **ROUGE**（Recall-Oriented Understudy for Gisting Evaluation）进行评估。ROUGE-1 和 ROUGE-2 分别衡量一元和二元语法重叠。ROUGE-L 衡量最长公共子序列。分数越高越好，但 40 的 ROUGE-L 算“不错”，50 算“出色”。每篇论文都会报告这三个指标。使用 `rouge-score` 包。

```figure
summarize-collapse
```

## 动手实现

### 步骤 1：TextRank（抽取式）

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

两个值得注意的点。相似度函数使用对数归一化的词重叠，这是原始的 TextRank 变体。使用 TF-IDF 向量的余弦相似度也可以。阻尼系数 0.85 和迭代次数是 PageRank 的默认值。

### 步骤 2：使用 BART 的生成式摘要

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN 在 CNN/DailyMail 语料库上进行了微调。它开箱即用即可生成新闻风格的摘要。对于其他领域（科学论文、对话、法律），使用对应的 Pegasus 检查点，或在你的目标数据上进行微调。

### 步骤 3：ROUGE 评估

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

务必启用词干提取。否则，"running" 和 "run" 会被视为不同的词，导致 ROUGE 低估分数。

### 超越 ROUGE（2026 年摘要评估）

ROUGE 作为主导的摘要指标已有二十年，但在 2026 年，它本身已不够充分。一项对 NLG 论文的大规模元分析显示：

- **BERTScore**（上下文嵌入相似度）在 2023 年之前持续流行，如今在大多数摘要论文中与 ROUGE 一起被报告。
- **BARTScore** 将评估视为生成任务：根据预训练 BART 在给定源文本时为摘要分配的似然度来评分。
- **MoverScore**（基于上下文嵌入的 Earth Mover's Distance）在 2025 年的摘要基准中登顶，因为它比 ROUGE 更能捕捉语义重叠。
- **FactCC** 和 **基于 QA 的忠实度评估**在 2021-2023 年很常见，如今常被 **G-Eval** 取代（一种 GPT-4 提示链，通过思维链推理评估连贯性、一致性、流畅性和相关性）。
- **G-Eval** 及类似 LLM 评审方法在评分标准设计良好时，与人类判断的契合率约为 80%。

生产建议：报告 ROUGE-L 以便与旧结果对比，用 BERTScore 衡量语义重叠，用 G-Eval 评估连贯性和事实性。用 50-100 条人工标注的摘要进行校准。

### 步骤 4：事实性问题

生成式摘要容易产生幻觉。抽取式摘要的幻觉风险要低得多，因为输出是逐字从源文本提取的，但如果源句子脱离上下文、过时或引用顺序错乱，仍可能产生误导。这是生产系统在合规相关内容上仍偏好抽取式方法的最大原因。

需要识别的幻觉类型：

- **实体替换。** 源文本说 "John Smith"，摘要说 "John Brown"。
- **数字漂移。** 源文本说 "25,000"，摘要说 "2500 万"。
- **极性反转。** 源文本说“拒绝了报价”，摘要说“接受了报价”。
- **事实捏造。** 源文本没有提到 CEO，摘要却说 CEO 批准了。

有效的评估方法：

- **FactCC。** 一个在源句子与摘要句子之间的蕴含关系上训练的二分类器。预测事实/非事实。
- **基于 QA 的事实性评估。** 向 QA 模型提出答案在源文本中的问题。如果摘要支持的答案不同，则标记。
- **实体级 F1。** 比较源文本与摘要中的命名实体。仅出现在摘要中的实体是可疑的。

对于任何面向用户且事实性重要的场景（新闻、医疗、法律、金融），抽取式是更安全的默认选择。生成式需要在流程中加入事实性检查。

## 使用

2026 年的技术栈：

| 使用场景 | 推荐 |
|---------|-------------|
| 新闻、3-5 句摘要、英语 | `facebook/bart-large-cnn` |
| 科学论文 | `google/pegasus-pubmed` 或微调过的 T5 |
| 多文档、长文本 | 任何支持 32k+ 上下文的 LLM，通过提示实现 |
| 对话摘要 | `philschmid/bart-large-cnn-samsum` |
| 抽取式、构造上低幻觉风险 | TextRank 或 `sumy` 的 LSA / LexRank |

在 2026 年，当算力不是限制因素时，长上下文 LLM 常常胜过专用模型。代价是成本和可复现性；专用模型的输出更稳定。

## 上线

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

1. **简单。** 在 5 篇新闻文章上运行 TextRank。将前 3 个句子与参考摘要进行比较，计算 ROUGE-L。在 CNN/DailyMail 风格的文章上，你应该会看到 30-45 的 ROUGE-L。
2. **中等。** 实现实体级事实性评估：从源文本和摘要中提取命名实体（spaCy），计算源实体在摘要中的召回率以及摘要实体相对源实体的精确率。高精确率和低召回率意味着安全但简略；低精确率意味着存在幻觉实体。
3. **困难。** 在 50 篇 CNN/DailyMail 文章上比较 BART-large-CNN 与 LLM（Claude 或 GPT-4）。报告 ROUGE-L、事实性（通过实体 F1）和每条摘要的成本。记录各自的优势所在。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 抽取式 | 挑选句子 | 逐字返回源文本中的句子。从不产生幻觉。 |
| 生成式 | 重写 | 以源文本为条件生成新文本。可能产生幻觉。 |
| ROUGE | 摘要指标 | 系统输出与参考摘要之间的 N-gram / LCS 重叠。 |
| TextRank | 基于图的抽取式 | 在句子相似度图上运行 PageRank。 |
| 事实性 | 是否正确 | 摘要中的论断是否得到源文本的支持。 |
| 幻觉 | 编造的内容 | 摘要中源文本不支持的内容。 |

## 延伸阅读

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) — 抽取式的经典论文。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) — BART 论文。
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) — Pegasus 及间隙句子目标。
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) — ROUGE 论文。
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) — 事实性领域的综述论文。