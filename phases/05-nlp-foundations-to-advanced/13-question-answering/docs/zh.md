# 问答系统（Question Answering Systems）

> 三种架构塑造了现代问答系统：抽取式（Extractive）定位答案片段，检索增强式（Retrieval-Augmented）将答案锚定在文档中，生成式（Generative）直接产出答案。每个现代AI助手都是这三者的混合体。

**类型：** 构建（Build）
**语言：** Python
**先修知识：** 阶段5·11（机器翻译 Machine Translation），阶段5·10（注意力机制 Attention Mechanism）
**预计时间：** ~75分钟

## 问题描述

用户输入“第一代iPhone是何时发布的？”，期望得到“2007年6月29日”。而不是“苹果公司的历史漫长而多样”。也不是孤零零的“2007年”没有完整句子。一个直接、有依据、正确的答案。

过去十年，三种架构主导了问答系统。

- **抽取式问答（Extractive QA）。** 给定一个问题和一个已知包含答案的段落，找出答案片段在该段落中的起始和结束索引。SQuAD是典型的基准数据集。
- **开放域问答（Open-domain QA）。** 不给定段落。先检索相关段落，再抽取或生成答案。这是当今所有RAG管道的基石。
- **生成式/闭卷问答（Generative / Closed-book QA）。** 大语言模型从其参数化记忆中回答。无需检索。推理速度最快，在事实性方面最不可靠。

2026年的趋势是混合式：检索出最好的几个段落，然后提示一个生成式模型基于这些段落作答。这就是RAG，第14课将深入介绍检索部分。本课程构建问答部分。

## 概念

![问答架构：抽取式、检索增强式、生成式](../assets/qa.svg)

**抽取式（Extractive）。** 使用Transformer（BERT家族）共同编码问题和段落。训练两个头（head）分别预测答案片段的起始和结束token索引。损失函数是有效位置上的交叉熵。输出是段落中的一个片段。不会产生幻觉（由架构保证），也不会处理段落无法回答的问题（由架构保证）。

**检索增强式（RAG）。** 两个阶段。首先，检索器从语料库中找出top-`k`个段落。其次，阅读器（reader，抽取式或生成式）利用这些段落生成答案。检索器-阅读器分离使得两者可以独立训练和评估。现代RAG通常会在两者之间加入一个排序器（reranker）。

**生成式（Generative）。** 一个仅解码器（decoder-only）的大语言模型（GPT、Claude、Llama）从其学习到的权重中回答问题。无需检索步骤。在常识问题上表现出色，在罕见或最新事实上的表现糟糕。幻觉率与预训练数据中事实的出现频率成反比。

## 动手构建

### 第一步：使用预训练模型进行抽取式问答

```python
from transformers import pipeline

qa = pipeline("question-answering", model="deepset/roberta-base-squad2")

passage = (
    "Apple Inc. released the first iPhone on June 29, 2007. "
    "The device was announced by Steve Jobs at Macworld in January 2007."
)
question = "When was the first iPhone released?"

answer = qa(question=question, context=passage)
print(answer)
```

```python
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2` 在 SQuAD 2.0 上训练过，其中包括不可回答的问题。默认情况下，`question-answering` 管道返回得分最高的片段，即使模型的空回答（null score）得分更高——它*不会*自动返回空答案。要获得明确的“无答案”行为，请在管道调用中传递 `handle_impossible_answer=True`：此时管道仅在空回答得分超过所有片段得分时才返回空答案。无论哪种情况，始终检查 `score` 字段。

### 第二步：检索增强流水线（草图）

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google's mobile operating system.",
    "The first iPod was released in 2001.",
]
corpus_embeddings = encoder.encode(corpus, normalize_embeddings=True)


def retrieve(question, top_k=2):
    q_emb = encoder.encode([question], normalize_embeddings=True)
    sims = (corpus_embeddings @ q_emb.T).squeeze()
    order = np.argsort(-sims)[:top_k]
    return [corpus[i] for i in order]


def answer(question):
    passages = retrieve(question, top_k=2)
    combined = " ".join(passages)
    return qa(question=question, context=combined)


print(answer("When was the first iPhone released?"))
```

两阶段流水线。密集检索器（Sentence-BERT）通过语义相似度找到相关段落。抽取式阅读器（RoBERTa-SQuAD）从合并的top段落中抽取答案片段。适用于小规模语料库。对于百万级文档语料库，请使用FAISS或向量数据库。

### 第三步：基于RAG的生成式问答

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""上下文：
{chr(10).join('- ' + p for p in passages)}

问题：{question}

请仅使用上述上下文回答。如果上下文中没有包含答案，请说“我不知道”。
"""
    return llm(prompt)
```

提示模式很重要。明确告诉模型要基于上下文作答，并在上下文不足时返回“我不知道”，相比简单提示可将幻觉率降低40-60%。更复杂的模式会添加引用、置信度分数和结构化抽取。

### 第四步：反映真实世界的评估

SQuAD使用**精确匹配（Exact Match, EM）**和**token级别的F1**。EM在标准化后（小写、去除标点、去除冠词）进行严格匹配——要么预测完全匹配得1分，否则得0分。F1基于预测和参考答案的token重叠计算，给予部分分数。两者都会低估同义改写：例如“June 29, 2007”与“June 29th, 2007”通常EM为0（序数词破坏了标准化），但由于有重叠token，仍然能获得较高的F1。

对于生产环境的问答系统：

- **答案准确性**（由LLM或人工评判，因为指标无法捕获语义等价）。
- **引用准确性**。引用的段落是否真正支持答案？通过生成的引用与检索段落之间的字符串匹配即可自动检查，非常简单。
- **拒绝校准（Refusal calibration）**。当答案不在检索段落中时，系统是否正确地说“我不知道”？测量误信率（false confidence rate）。
- **检索召回率（Retrieval recall）**。在评估阅读器之前，先测量检索器是否将正确段落排进了top-`k`。阅读器无法补救缺失的段落。

### RAGAS：2026年的生产评估框架

`RAGAS` 是专门为RAG系统构建的评估框架，是2026年的默认选择。它无需真实参考答案即可对四个维度进行评分：

- **忠实度（Faithfulness）。** 答案中的每个主张是否都来自检索到的上下文？通过基于自然语言推理（NLI）的蕴含关系测量。这是主要的幻觉指标。
- **答案相关性（Answer relevance）。** 答案是否针对问题？通过从答案中生成假设性问题并与真实问题比较来测量。
- **上下文精确度（Context precision）。** 在检索到的chunks中，有多少比例是真正相关的？精确度低意味着提示中存在噪声。
- **上下文召回率（Context recall）。** 检索到的集合是否包含了所有必要的信息？召回率低意味着阅读器不可能成功。

无需参考的评分让你可以在没有精心整理的真实答案的情况下，对生产流量进行评估。对于开放式问题（精确匹配指标无效的场景），可以在此基础上叠加LLM作为评判（LLM-as-judge）。

`pip install ragas`。接入你的检索器 + 阅读器。每个查询获得四个标量。对性能退化进行预警。

## 使用场景

2026年的技术栈。

| 使用场景 | 推荐方案 |
|---------|-------------|
| 给定段落，找出答案片段 | `deepset/roberta-base-squad2` |
| 基于固定语料库，不适用闭卷回答 | RAG：密集检索器 + LLM阅读器 |
| 文档库实时问答 | 混合检索（BM25 + 密集） + 排序器的RAG（第14课） |
| 对话式问答（追问） | 带对话历史的LLM + 每轮RAG |
| 高度事实性、受监管的领域 | 基于权威语料库的抽取式问答；绝不单独使用生成式 |

抽取式问答在2026年已不时尚，因为基于LLM的RAG能处理更多情况。但在需要逐字引用的场景中仍在使用：法律研究、法规合规、审计工具。

## 交付

保存为 `outputs/skill-qa-architect.md`：

```markdown
---
name: qa-architect
description: 选择问答架构、检索策略和评估计划。
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

给定需求（语料库大小、问题类型、事实约束、延迟预算），输出：

1. 架构。抽取式、带抽取式阅读器的RAG、带生成式阅读器的RAG，或闭卷LLM。一句话理由。
2. 检索器。无、BM25、密集（命名编码器），或混合。
3. 阅读器。基于SQuAD微调的模型、按名称指定的LLM，或“领域微调的DistilBERT”。
4. 评估。对于抽取式基准：EM + F1；对于生产环境：答案准确性 + 引用准确性 + 拒绝校准。说明测量什么以及如何测量。

对于监管或合规敏感问题，拒绝使用闭卷LLM回答。拒绝任何没有检索召回率基线的问答系统（不知道检索器是否找到了正确段落，就无法评估阅读器）。将需要多跳推理的问题标记为需要使用专门的多跳检索器，例如基于HotpotQA训练的系统。
```

## 练习

1. **简单。** 在10篇维基百科段落上建立上述SQuAD抽取式流水线。手工设计10个问题。测量答案正确的次数。如果段落和问题都很干净，你应该能看到7-9次正确。
2. **中等。** 添加一个拒绝分类器。当最高检索得分低于某个阈值（例如余弦相似度0.3）时，返回“我不知道”而不是调用阅读器。在预留集上调整阈值。
3. **困难。** 在你选择的包含10,000个文档的语料库上构建一个RAG流水线。实现混合检索（BM25 + 密集），使用RRF融合（见第14课）。分别测量有无混合步骤时的答案准确性。记录哪个问题类型受益最多。

## 关键术语

| 术语 | 人们怎么说 | 实际含义 |
|------|-----------------|-----------------------|
| 抽取式问答（Extractive QA） | 找到答案片段 | 预测答案在给定段落中的起始和结束索引。 |
| 开放域问答（Open-domain QA） | 基于语料库的问答 | 没有给定段落；必须先检索再回答。 |
| RAG | 检索然后生成 | 检索增强生成。检索器 + 阅读器流水线。 |
| SQuAD | 典型基准 | 斯坦福问答数据集。EM + F1指标。 |
| 幻觉（Hallucination） | 编造答案 | 阅读器输出的内容不受检索到的上下文支持。 |
| 拒绝校准（Refusal calibration） | 知道何时闭嘴 | 系统在无法回答时正确地说“我不知道”。 |

## 延伸阅读

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) — 基准论文。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) — DPR，用于问答的经典密集检索器。
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) — 命名RAG的论文。
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) — 全面的RAG综述。