# 文本总结

> 抽象系统告诉你文件中所说的东西,抽象系统告诉你作者是什么意思.不同的任务,不同的陷.

**Type:** Build
**Languages:** Python, TypeScript
**Prerequisites:** Phase 5 · 02 (BoW + TF-IDF), Phase 5 · 11 (Machine Translation)
**Time:** ~75 minutes

## 问题

您需要120个词来捕捉到的新闻文章.您可以从文章中选出三个最重要的句子 (摘要) 或用您自己的词 (抽象) 重写内容.这两个称为总结.它们是完全不同的问题.

提取总结是一个排名问题.`k`输出总是语法性的,因为它被字面上提升.

抽象总结是一个生成问题.一个变压器产生了新的文本,根据输入条件.输出流动和压缩,但可能会幻觉到未在源头中的事实.风险是自信的制造.

这一课是建立了两者,每个人都有失败模式.

## 概念

![Extractive TextRank vs abstractive transformer](../assets/summarization.svg)

**Extractive.**按照文章的相关性,将文章视为一个图,其中节点是句子,边缘是相似之处. 运行页面排行 (或类似的东西) 在图上,以根据它们与其他一切的联系来评分句子.最高分的句子是总结.**TextRank**尔塞亚和塔拉乌 (2004年).

**Abstractive.**在文件-总结对上进行变压器编码器-解码器 (BART,T5,Pegasus) 的细调.在推断时,模型会读取文件并通过交叉注意力生成总结代币-代币.Pegasus特别使用一个空隙句子预训目标,使其在没有太多细调的情况下进行总结.

评估与**ROUGE**红色-1和红色-2分数重叠单格和大格.红色-L分数是最长的常见次数.更高是更好,但40红色-L是"好"和50是"特殊".每篇报道都报告了三个.使用`rouge-score`包装.

```figure
summarize-collapse
```

## 建立它

### 步骤1:文字排行 (摘取)

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

值得命名的两个东西.类似性函数使用日志正常化的词重叠,这是原始的 TextRank 变体. TF-IDF 矢量的可西因也可以运行.缓解因子 0.85 和反复数是 PageRank 默认.

### 步骤2:使用BART抽象

```python
from transformers import pipeline

summarizer = pipeline("summarization", model="facebook/bart-large-cnn")

article = """(long news article text)"""

summary = summarizer(article, max_length=120, min_length=60, do_sample=False)
print(summary[0]["summary_text"])
```

对于其他领域 (科学论文,对话,法律),使用相应的Pegasus检查点或对目标数据进行细节调整.

### 步骤3:红色评估

```python
from rouge_score import rouge_scorer

scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)
scores = scorer.score(reference_summary, generated_summary)
print({k: round(v.fmeasure, 3) for k, v in scores.items()})
```

没有它,"跑"和"跑"都算是不同的词,而Rouge算是不足的.

### 超越红色 (2026年总结评估)

红色已经成为主导的总结指标二十年,但在2026年本身不足.

- **BERTScore**据报道,目前,在大多数总结论文中,与ROUGE一起报告.
- **BARTScore**评估是生成的:根据预先训练的BART将总结分配给来源的可能性,评分总结.
- **MoverScore**(Earth Mover's Distance over contextual embeddings) 在2025年总结基准中达到顶点,因为它比ROUGE更好地捕捉了语义重叠.
- **FactCC**其他**QA-based faithfulness**现在经常被替换为**G-Eval**(一个GPT-4提示链,该链的结合性,一致性,流利性,与链思维推理相关性).
- **G-Eval**类似的LLM法官方法与人判断相匹配.

产品推:报告 ROUGE-L用于传统的比较,BERTScore用于语义重叠,G-Eval用于一致性和事实性. 根据50-100个标记的人类的总结进行校准.

### 步骤4:事实性问题

抽象摘要容易产生幻觉.抽象摘要带来了较低的幻觉风险,因为输出从源头上字面上取出,尽管如果源句子脱文,过时或引用过后,它们仍然可以误导.这是生产系统仍然更喜欢抽取方法的原因.

幻类型:

- **Entity swap.**来源说"约翰·史密斯".总结说"约翰·布朗".
- **Number drift.**来源说25,000. 总结说2500万.
- **Polarity flip.**消息来源说"拒绝了这份报价".总结说"接受了这份报价".
- **Fact invention.**消息来源没有提到首席执行官. 总结说首席执行官批准了.

评估方法:

- **FactCC.**基于源句和总结句之间的关系训练的二进制分类器. 预测事实/非事实.
- **QA-based factuality.**问一个质量评估模型的问题,其答案在源头.如果总结支持不同的答案,请标记.
- **Entity-level F1.**根据本文的内容, 总结中仅有所存在的实体是可疑的.

对于任何事实性 (新闻,医疗,法律,金融) 的用户面向,抽取是安全的默认.抽象需要循环检查事实性.

## 用它

现在,我们要做什么?

| Use case | Recommended |
|---------|-------------|
| News, 3-5 sentence summary, English | `facebook/bart-large-cnn` |
| Scientific papers | `google/pegasus-pubmed` or a tuned T5 |
| Multi-document, long-form | Any LLM with 32k+ context, prompted |
| Dialog summarization | `philschmid/bart-large-cnn-samsum` |
| Extractive, low hallucination risk by construction | TextRank or `sumy`'s LSA / LexRank |

长文本的LLM通常在2026年超过专业模型,当计算不是一个限制时. 折衷是成本和可复制性;专业模型提供更一致的输出.

## 运送它

保存如`outputs/skill-summary-picker.md`其他:

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

## 运动

1. **Easy.**运行5个新闻文章的文字排名.将前3句子与参考摘要进行比较.测量ROUGE-L.你应该在CNN/DailyMail类型的文章中看到30-45 ROUGE-L.
2. **Medium.**实体级实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实实
3. **Hard.**根据CNN/DailyMail的50篇文章,比较BART-大CNN与LLM (Claude或GPT-4) 的情况.报告ROUGE-L,事实性 (按实体F1),每次总结的成本.每个获胜的文件.

## 关键词

| Term | What people say | What it actually means |
|------|-----------------|-----------------------|
| Extractive | Pick sentences | Return sentences verbatim from the source. Never hallucinates. |
| Abstractive | Rewrite | Generate new text conditioned on source. Can hallucinate. |
| ROUGE | Summary metric | N-gram / LCS overlap between system output and reference. |
| TextRank | Graph-based extractive | PageRank over sentence similarity graph. |
| Factuality | Is it right | Whether summary claims are supported by the source. |
| Hallucination | Made-up content | Content in the summary that the source does not support. |

## 进一步阅读

- [Mihalcea and Tarau (2004). TextRank: Bringing Order into Texts](https://aclanthology.org/W04-3252/)提取法典论文.
- [Lewis et al. (2019). BART: Denoising Sequence-to-Sequence Pre-training](https://arxiv.org/abs/1910.13461)BART纸.
- [Zhang et al. (2019). PEGASUS: Pre-training with Extracted Gap-sentences](https://arxiv.org/abs/1912.08777)佩加索和空白句子目标.
- [Lin (2004). ROUGE: A Package for Automatic Evaluation of Summaries](https://aclanthology.org/W04-1013/)红色纸.
- [Maynez et al. (2020). On Faithfulness and Factuality in Abstractive Summarization](https://arxiv.org/abs/2005.00661)实况景观论文.
