# 文本摘要

> 抽取式系统告诉你文档说了什么。生成式系统告诉你作者想表达什么。不同的任务，不同的陷阱。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 02（词袋 + TF-IDF），阶段 5 · 11（机器翻译）
**时间：** 约75分钟

## 问题

一篇2000词的新闻文章出现在你的信息流中。你需要用120个词来概括它。你可以从文章中挑选最重要的三个句子（抽取式），或者用自己的话重写内容（生成式）。两者都称为摘要，但它们是完全不同的问题。

**抽取式摘要**是一个排序问题。对每个句子打分，返回前`k`个。输出总是语法正确的，因为它逐字取自原文。风险在于可能遗漏分布在文章各处的信息。

**生成式摘要**是一个生成问题。Transformer根据输入生成新的文本。输出流畅且压缩，但可能产生源文中不存在的事实的幻觉。风险在于自信地编造内容。

本节课将构建两者，并揭示各自特有的失败模式。

## 概念

![抽取式TextRank vs 生成式Transformer](../assets/summarization.svg)

**抽取式。** 将文章视为一个图，节点是句子，边是相似度。在图上运行PageRank（或类似算法）来根据句子与其他所有句子的连接程度进行评分。得分最高的句子构成摘要。经典的实现是**TextRank**（Mihalcea和Tarau，2004）。

**生成式。** 在文档-摘要对上微调一个Transformer编码器-解码器（BART，T5，Pegasus）。推理时，模型读取文档并通过交叉注意力逐token生成摘要。特别是Pegasus，它使用了间隔句子预训练目标，使它在无需大量微调的情况下就能出色地完成摘要任务。

使用**ROUGE**（面向召回率的摘要评估辅助工具）进行评估。ROUGE-1和ROUGE-2对一元组和二元组重叠进行评分。ROUGE-L对最长公共子序列进行评分。分数越高越好，但40的ROUGE-L算"好"，50算"优秀"。每篇论文都会报告这三项。使用`rouge-score`包。

## 构建

### 步骤1：TextRank（抽取式）

```python
import math
import re
from collections import Counter


def sentence_split(text):
    """将文本按句号、感叹号、问号拆分为句子"""
    return re.split(r"(?<=[.!?])\s+", text.strip())


def similarity(s1, s2):
    """计算两个句子的对数归一化词重叠相似度"""
    w1 = Counter(s1.lower().split())
    w2 = Counter(s2.lower().split())
    intersection = sum((w1 & w2).values())
    denom = math.log(len(w1) + 1) + math.log(len(w2) + 1)
    if denom == 0:
        return 0.0
    return intersection / denom


def textrank(text, top_k=3, damping=0.85, iterations=50, epsilon=1e-4):
    """使用TextRank算法进行抽取式摘要"""
    sentences = sentence_split(text)
    n = len(sentences)
    if n <= top_k:
        return sentences

    # 构建相似度矩阵
    sim = [[0.0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                sim[i][j] = similarity(sentences[i], sentences[j])

    # PageRank迭代
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

    # 选择得分最高的top_k个句子
    ranked = sorted(range(n), key=lambda k: scores[k], reverse=True)[:top_k]
    ranked.sort()
    return [sentences[i] for i in ranked]
```

有两件事值得说明。相似度函数使用了对数归一化的词重叠，这是原始的TextRank变体。使用TF-IDF向量的余弦相似度也可以。阻尼因子0.85和迭代次数是PageRank的默认值。

### 步骤2：使用BART进行生成式摘要

```python
from transformers import pipeline

# 加载预训练的BART摘要模型
summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(长新闻文章文本)"""

# 生成摘要，设置长度范围，关闭采样以获得确定性输出
summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

BART-large-CNN在CNN/DailyMail语料库上进行了微调。它可以直接生成新闻风格的摘要。对于其他领域（科学论文、对话、法律），请使用相应的Pegasus检查点或在目标数据上进行微调。

### 步骤3：ROUGE评估

```python
from rouge_score import rouge_scorer

# 创建评估器，使用词干提取
scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

始终使用词干提取。否则，"running"和"run"会被视为不同的词，ROUGE会低估。

### 超越ROUGE（2026年摘要评估）

ROUGE作为主要的摘要评估指标已经使用了二十年，但在2026年它本身已不足以胜任。一项大规模的自然语言生成论文元分析显示：

- **BERTScore**（上下文嵌入相似度）在2023年前后获得了广泛认可，现在大多数摘要论文中都与ROUGE一起报告。
- **BARTScore** 将评估视为生成：根据源文本，通过预训练的BART模型对摘要的似然度进行评分。
- **MoverScore**（上下文嵌入上的推土机距离）在2025年的摘要基准测试中达到了最高位置，因为它比ROUGE更好地捕捉了语义重叠。
- **FactCC** 和 **基于QA的忠实度** 在2021-2023年很常见，现在通常被 **G-Eval**（一个GPT-4提示链，通过思维链推理对连贯性、一致性、流畅性、相关性进行评分）所取代。
- **G-Eval** 和类似的LLM法官方法在评分标准设计良好时，与人类判断的一致性约为80%。

生产推荐：报告ROUGE-L用于传统比较，BERTScore用于语义重叠，G-Eval用于连贯性和事实性。使用50-100个人工标注的摘要进行校准。

### 步骤4：事实性问题

生成式摘要容易出现幻觉。抽取式摘要的幻觉风险要低得多，因为输出是从源文本逐字提取的，尽管如果源句子被去语境化、过时或顺序不当，仍然可能产生误导。这是生产系统在合规相关内容中仍然偏好抽取式方法的最大原因。

需指出的幻觉类型：

- **实体替换。** 源文本说"John Smith"，摘要说"John Brown"。
- **数字漂移。** 源文本说"25,000"，摘要说"25 million"。
- **极性翻转。** 源文本说"拒绝了报价"，摘要说"接受了报价"。
- **事实捏造。** 源文本未提及CEO，摘要说CEO批准了。

有效的评估方法：

- **FactCC。** 一个基于源句和摘要句之间蕴含关系的二分类器。预测事实/非事实。
- **基于QA的事实性。** 向一个问答模型提问，问题的答案在源文本中。如果摘要支持不同的答案，则标记。
- **实体级F1。** 比较源文本和摘要中的命名实体。仅出现在摘要中的实体值得怀疑。

对于任何面向用户且事实性重要的场景（新闻、医疗、法律、金融），抽取式是更安全的默认选择。生成式需要在循环中加入事实性检查。

## 使用

2026年技术栈：

| 用例 | 推荐方案 |
|---------|-------------|
| 英语新闻，3-5句摘要 | `facebook/bart-large-cnn` |
| 科学论文 | `google/pegasus-pubmed` 或微调的T5 |
| 多文档、长文本 | 任何拥有32k+上下文窗口的LLM，通过提示词引导 |
| 对话摘要 | `philschmid/bart-large-cnn-samsum` |
| 抽取式，结构上低幻觉风险 | TextRank 或 `sumy` 的 LSA / LexRank |

在计算资源不受限的情况下，具有长上下文的LLM在2026年通常胜过专门的模型。权衡在于成本和可复现性；专门的模型能提供更一致的输出。

## 交付

保存为 `outputs/skill-summary-picker.md`：

```markdown
---
name: summary-picker
description: 选择抽取式或生成式，指定库名称，进行事实性检查。
version: 1.0.0
phase: 5
lesson: 12
tags: [nlp, summarization]
---

给定一个任务（文档类型、合规要求、长度、计算预算），输出：

1. 方法。抽取式或生成式。用一句话解释原因。
2. 起始模型/库。指明名称。`sumy.TextRankSummarizer`，`facebook/bart-large-cnn`，`google/pegasus-pubmed`，或一个LLM提示词。
3. 评估计划。ROUGE-1，ROUGE-2，ROUGE-L（使用带词干提取的rouge-score）。如果是生成式，加上事实性检查。
4. 一个需要探究的失败模式。实体替换是生成式新闻摘要中最常见的；标记源实体未出现在摘要中的样本。

对于医疗、法律、金融或受监管的内容，除非有事实性门控，否则拒绝使用生成式摘要。如果输入超出模型的上下文窗口，标记为需要分块映射-规约摘要（而非简单截断）。
```

## 练习

1. **简单。** 在5篇新闻文章上运行TextRank。将排名前3的句子与参考摘要进行比较。测量ROUGE-L。对于CNN/DailyMail风格的文章，你应该看到30-45的ROUGE-L。
2. **中等。** 实现实体级事实性：从源文本和摘要中提取命名实体（使用spaCy），计算源实体在摘要中的召回率以及摘要实体在源文本中的精确率。高精确率和低召回率意味着安全但简洁；低精确率意味着存在幻觉实体。
3. **困难。** 在50篇CNN/DailyMail文章上比较BART-large-CNN和一个LLM（Claude或GPT-4）。报告ROUGE-L、事实性（通过实体F1）以及每条摘要的成本。记录各自获胜的情况。

## 关键术语

| 术语 | 常见说法 | 实际含义 |
|------|---------|-----------|
| 抽取式 | 挑选句子 | 从源文本逐字返回句子。从不产生幻觉。 |
| 生成式 | 重写 | 根据源文本生成新文本。可能产生幻觉。 |
| ROUGE | 摘要指标 | 系统输出与参考之间的n-gram / LCS重叠。 |
| TextRank | 基于图的抽取方法 | 在句子相似度图上运行的PageRank。 |
| 事实性 | 是否正确 | 摘要中的声明是否得到源文本的支持。 |
| 幻觉 | 编造的内容 | 摘要中源文本不支持的内容。 |

## 扩展阅读

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/) — 抽取式的经典论文。
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461) — BART论文。
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777) — Pegasus和间隔句子目标。
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/) — ROUGE论文。
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661) — 事实性概览论文。