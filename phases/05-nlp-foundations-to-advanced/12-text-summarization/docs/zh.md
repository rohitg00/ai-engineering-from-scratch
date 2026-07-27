# 文本摘要

> 抽取式系统告诉你文档说了什么。生成式系统告诉你作者想表达什么。不同的任务，不同的陷阱。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 02（BoW + TF-IDF），阶段 5 · 11（机器翻译）
**时间：** ~75 分钟

## 问题

一篇 2000 字的新闻文章出现在你的信息流中，你需要 120 字来概括它。你可以从文章中挑选三个最重要的句子（抽取式），或者用自己的话重写内容（生成式）。两者都叫摘要，但它们是完全不同的问题。

抽取式摘要是排序问题。对每个句子打分，返回前 `k` 个。输出总是语法正确的，因为它是逐字提取的。风险是遗漏分布在文章各处的信息。

生成式摘要是生成问题。Transformer 根据输入条件生成新文本。输出流畅且简洁，但可能幻觉出源中不存在的事实。风险是自信的捏造。

本课构建两种方法，并指出各自独有的失败模式。

## 概念

**抽取式。** 将文章视为一个图，节点是句子，边是相似度。在图上运行 PageRank（或类似算法），根据句子与其他句子的连接程度打分。得分最高的句子就是摘要。经典实现是 **TextRank**（Mihalcea and Tarau, 2004）。

**生成式。** 在文档-摘要对上微调 transformer 编码器-解码器（BART、T5、Pegasus）。推理时，模型读取文档并通过 cross-attention 逐 token 生成摘要。Pegasus 特别使用 gap-sentence 预训练目标，使其无需大量微调就能出色地完成摘要任务。

使用 **ROUGE**（面向召回率的摘要评估替代指标）进行评估。ROUGE-1 和 ROUGE-2 分别对 unigram 和 bigram 重叠打分。ROUGE-L 对最长公共子序列打分。越高越好，但 40 ROUGE-L 是"好"，50 是"优秀"。每篇论文都报告全部三者。使用 `rouge-score` 包。

## 开始构建

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

两件值得命名的事情。相似度函数使用对数归一化的词重叠，这是原始的 TextRank 变体。TF-IDF 向量的余弦也可以。阻尼因子 0.85 和迭代次数是 PageRank 的默认值。

### 第 2 步：使用 BART 的生成式摘要

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(长新闻文章文本)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN 在 CNN/DailyMail 语料库上微调过。它开箱即可生成新闻风格的摘要。对于其他领域（科学论文、对话、法律），使用相应的 Pegasus 检查点或在你的目标数据上微调。

### 第 3 步：ROUGE 评估

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

始终使用词干提取。没有它，"running" 和 "run" 算作不同的词，ROUGE 会低估。

### 超越 ROUGE（2026 年摘要评估）

ROUGE 是二十年来占主导地位的摘要指标，但在 2026 年它单独使用是不够的。一项大规模的 NLG 论文元分析显示：

- **BERTScore**（上下文 embedding 相似度）到 2023 年获得了进展，现在大多数摘要论文中与 ROUGE 一起报告。
- **BARTScore** 将评估视为生成：通过预训练 BART 在给定源的情况下为摘要分配的可能性来对其评分。
- **MoverScore**（上下文 embeddings 上的 Earth Mover's Distance）在 2025 年摘要基准测试中达到最高位置，因为它比 ROUGE 更好地捕捉了语义重叠。
- **FactCC** 和 **基于 QA 的忠实度** 在 2021-2023 年很常见，现在通常被 **G-Eval**（一个 GPT-4 提示链，通过链式思维推理对连贯性、一致性、流畅度、相关性评分）取代。
- **G-Eval** 和类似的 LLM 评委方法在评估标准设计良好时，与人类判断的一致性约为 80%。

生产建议：报告 ROUGE-L 用于遗留比较，BERTScore 用于语义重叠，G-Eval 用于连贯性和事实性。用 50-100 个人工标注摘要进行校准。

### 第 4 步：事实性问题

生成式摘要容易出现幻觉。抽取式摘要的幻觉风险要低得多，因为输出是从源中逐字提取的，但如果源句子被去语境化、过时或顺序错误引用，它们仍然可能产生误导。这是生产系统在合规相关内容上仍然偏好抽取式方法的单一最大原因。

需要命名的幻觉类型：

- **实体交换。** 源说"John Smith"，摘要说"John Brown"。
- **数字漂移。** 源说"25,000"，摘要说"25 million"。
- **极性翻转。** 源说"拒绝了这个提议"，摘要说"接受了这个提议"。
- **事实捏造。** 源没有提到 CEO，摘要说 CEO 批准了。

有效的评估方法：

- **FactCC。** 一个在源句子和摘要句子之间的蕴涵关系上训练的二分类器。预测事实/非事实。
- **基于 QA 的事实性。** 用 QA 模型询问答案在源中的问题。如果摘要支持不同的答案，标记。
- **实体级 F1。** 比较源与摘要中的命名实体。仅出现在摘要中的实体值得怀疑。

对于任何面向用户且事实性重要的内容（新闻、医学、法律、金融），抽取式是更安全的默认选择。生成式需要在流程中加入事实性检查。

## 使用现成工具

2026 年技术栈：

| 用例 | 推荐 |
|---------|-------------|
| 新闻，3-5 句摘要，英语 | `facebook/bart-large-cnn` |
| 科学论文 | `google/pegasus-pubmed` 或调整过的 T5 |
| 多文档，长文本 | 任何具有 32k+ 上下文的 LLM，通过提示 |
| 对话摘要 | `philschmid/bart-large-cnn-samsum` |
| 抽取式，低幻觉风险 | TextRank 或 `sumy` 的 LSA / LexRank |

当计算不受限时，拥有长上下文的 LLM 在 2026 年通常优于专用模型。权衡是成本和可复现性；专用模型给出更一致的输出。

## 交付

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

Refuse abstractive summarization for medical, legal, financial, or regulated content without a factuality gate. Flag input over the model context window as needing chunked map-reduce summarization (not just truncation).
```

## 练习

1. **简单。** 在 5 篇新闻文章上运行 TextRank。将前 3 个句子与参考摘要进行比较。测量 ROUGE-L。在 CNN/DailyMail 风格的文章上，你应该看到 30-45 ROUGE-L。
2. **中等。** 实现实体级事实性：从源和摘要中提取命名实体（spaCy），计算源实体在摘要中的召回率和摘要实体相对于源的精确率。高精确率和低召回率意味着安全但简洁；低精确率意味着幻觉实体。
3. **困难。** 在 50 篇 CNN/DailyMail 文章上比较 BART-large-CNN 与 LLM（Claude 或 GPT-4）。报告 ROUGE-L、事实性（通过实体 F1）和每个摘要的成本。记录各自胜出的地方。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Extractive | 选取句子 | 从源中逐字返回句子。永不幻觉。 |
| Abstractive | 重写 | 根据源条件生成新文本。可能幻觉。 |
| ROUGE | 摘要指标 | 系统输出与参考之间的 n-gram / LCS 重叠。 |
| TextRank | 基于图的抽取式 | 句子相似度图上的 PageRank。 |
| Factuality | 是否正确 | 摘要中的声明是否被源支持。 |
| Hallucination | 捏造内容 | 摘要中源不支持的内容。 |

## 延伸阅读

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) —— 抽取式经典论文。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) —— BART 论文。
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) —— Pegasus 和 gap-sentence 目标。
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) —— ROUGE 论文。
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) —— 事实性全景论文。
