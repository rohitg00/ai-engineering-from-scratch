# 问答系统

> 三种系统塑造了现代 QA。抽取式找到答案跨度。检索增强将其锚定在文档中。生成式产生答案。每个现代 AI 助手都是三者的混合。

**类型：** 构建
**语言：** Python
**前置知识：** 阶段 5 · 11（机器翻译），阶段 5 · 10（Attention 机制）
**时间：** ~75 分钟

## 问题

用户输入"第一款 iPhone 是什么时候发布的？"，期望回答"2007 年 6 月 29 日"。而不是"苹果的历史悠久而多样"。也不是孤零零的"2007"没有句子。一个直接、有依据、正确的答案。

过去十年，三种架构主导了 QA。

- **抽取式 QA。** 给定一个问题和一个已知包含答案的段落，找到答案跨度在段落中的起始和结束索引。SQuAD 是经典基准。
- **开放域 QA。** 没有给出段落。先检索相关段落，然后提取或生成答案。这是今天每个 RAG pipeline 的基础。
- **生成式/闭卷 QA。** 大语言模型从其参数记忆中回答。无需检索。推理最快，事实可靠性最低。

2026 年的趋势是混合型：检索最好的几个段落，然后提示一个生成模型以这些段落为基础进行回答。这就是 RAG，第 14 课深入介绍检索部分。本课构建 QA 部分。

## 概念

**抽取式。** 使用 transformer（BERT 家族）一起编码问题和段落。训练两个头来预测答案的起始和结束 token 索引。损失是有效位置上的交叉熵。输出是段落中的一个跨度。永不幻觉（按设计），永不处理段落无法回答的问题（按设计）。

**检索增强（RAG）。** 两个阶段。首先，检索器从语料库中找到 top-`k` 个段落。其次，阅读器（抽取式或生成式）使用这些段落产生答案。检索器-阅读器的分离使两者可以独立训练和评估。现代 RAG 通常会在它们之间添加一个重排序器。

**生成式。** 仅解码器 LLM（GPT、Claude、Llama）从学习到的权重中回答。无检索步骤。在通用知识上表现出色，在罕见或近期事实上灾难性。幻觉率与预训练数据中的事实频率成反比。

## 开始构建

### 第 1 步：使用预训练模型的抽取式 QA

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

```
{'score': 0.98, 'start': 57, 'end': 70, 'answer': 'June 29, 2007'}
```

`deepset/roberta-base-squad2` 在 SQuAD 2.0 上训练，其中包含无法回答的问题。默认情况下，`question-answering` pipeline 即使模型的 null 分数胜出也会返回最高分的跨度——它*不会*自动返回空答案。要获得显式的"无答案"行为，在 pipeline 调用中传递 `handle_impossible_answer=True`：此时只有当 null 分数超过每个跨度分数时，pipeline 才返回空答案。无论哪种方式，始终检查 `score` 字段。

### 第 2 步：检索增强 pipeline（草图）

```python
from sentence_transformers import SentenceTransformer
import numpy as np

encoder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

corpus = [
    "Apple Inc. released the first iPhone on June 29, 2007.",
    "Macworld 2007 featured the iPhone announcement by Steve Jobs.",
    "Android launched in 2008 as Google mobile operating system.",
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

两阶段 pipeline。密集检索器（Sentence-BERT）通过语义相似度找到相关段落。抽取式阅读器（RoBERTa-SQuAD）从合并的 top 段落中提取答案跨度。适用于小型语料库。对于百万文档语料库，使用 FAISS 或向量数据库。

### 第 3 步：带 RAG 的生成式 QA

```python
def rag_generate(question, llm):
    passages = retrieve(question, top_k=3)
    prompt = f"""Context:
{chr(10).join('- ' + p for p in passages)}

Question: {question}

Answer using only the context above. If the context does not contain the answer, say "I don't know."
"""
    return llm(prompt)
```

提示模式很重要。显式告诉模型以上下文为基础并在上下文不足时返回"我不知道"，与朴素提示相比可将幻觉率降低 40-60%。更复杂的模式添加引用、置信度分数和结构化提取。

### 第 4 步：反映真实世界的评估

SQuAD 使用**精确匹配（EM）**和**token 级 F1**。EM 是归一化后（小写、去除标点、移除冠词）的严格匹配——要么预测完全匹配，要么得 0 分。F1 在预测和参考之间的 token 重叠上计算，给予部分分数。两者都低估了释义："June 29, 2007" vs "June 29th, 2007"通常得 0 EM（序数破坏了归一化）但仍然从重叠 token 中获得可观的 F1。

对于生产 QA：

- **答案准确率**（LLM 评判或人工评判，因为指标无法捕捉语义等价性）。
- **引用准确率。** 引用的段落是否真正支持答案？通过生成的引用与检索到的段落之间的字符串匹配，自动检查非常简单。
- **拒绝校准。** 当答案不在检索到的段落中时，系统是否正确地说"我不知道"？衡量错误自信率。
- **检索召回率。** 在评估阅读器之前，衡量检索器是否将正确的段落放入 top-`k`。阅读器无法修复缺失的段落。

### RAGAS：2026 年生产评估框架

`RAGAS` 是为 RAG 系统专门构建的，是 2026 年的交付默认选择。它无需黄金参考即可评分四个维度：

- **忠实度（Faithfulness）。** 答案中的每个声明是否都来自检索到的上下文？基于 NLI 的蕴涵关系测量。你的主要幻觉指标。
- **答案相关性（Answer relevance）。** 答案是否回答了问题？通过从答案生成假设性问题并与真实问题比较来测量。
- **上下文精确率（Context precision）。** 在检索到的块中，有多少实际相关？低精确率 = 提示中有噪声。
- **上下文召回率（Context recall）。** 检索到的集合是否包含所有必要信息？低召回率 = 阅读器无法成功。

无参考评分让你可以在没有精心策划的黄金答案的情况下对实时生产流量进行评估。对于精确匹配指标无用的开放性问题，在顶层加上 LLM 作为评委。

`pip install ragas`。插入你的检索器 + 阅读器。每次查询获得四个标量。对回归发出警报。

## 使用现成工具

2026 年技术栈。

| 用例 | 推荐 |
|---------|-------------|
| 给定段落，找到答案跨度 | `deepset/roberta-base-squad2` |
| 在固定语料库上，不接受闭卷 | RAG：密集检索器 + LLM 阅读器 |
| 在文档存储上的实时查询 | 使用混合（BM25 + 密集）检索器 + 重排序器的 RAG（第 14 课） |
| 对话 QA（追问） | 带对话历史的 LLM + 每次轮次的 RAG |
| 高度事实性、受监管领域 | 在权威语料库上使用抽取式；永远不要单独用生成式 |

抽取式 QA 在 2026 年已经不时髦了，因为带有 LLM 的 RAG 能处理更多情况。在需要逐字引用的场景中它仍然被交付：法律研究、法规合规、审计工具。

## 交付

保存为 `outputs/skill-qa-architect.md`：

```markdown
---
name: qa-architect
description: Choose QA architecture, retrieval strategy, and evaluation plan.
version: 1.0.0
phase: 5
lesson: 13
tags: [nlp, qa, rag]
---

Given requirements (corpus size, question type, factuality constraint, latency budget), output:

1. Architecture. Extractive, RAG with extractive reader, RAG with generative reader, or closed-book LLM. One-sentence reason.
2. Retriever. None, BM25, dense (name the encoder), or hybrid.
3. Reader. SQuAD-tuned model, LLM by name, or "domain-fine-tuned DistilBERT."
4. Evaluation. EM + F1 for extractive benchmarks; answer accuracy + citation accuracy + refusal calibration for production. Name what you are measuring and how you are measuring it.

Refuse closed-book LLM answers for regulatory or compliance-sensitive questions. Refuse any QA system without a retrieval-recall baseline (you cannot evaluate the reader without knowing the retriever surfaced the right passage). Flag questions that require multi-hop reasoning as needing specialized multi-hop retrievers like HotpotQA-trained systems.
```

## 练习

1. **简单。** 在 10 个 Wikipedia 段落上设置上述 SQuAD 抽取式 pipeline。手工制作 10 个问题。测量答案正确的频率。如果段落和问题都清晰，你应该看到 7-9 个正确。
2. **中等。** 添加一个拒绝分类器。当最高检索分数低于阈值（比如 0.3 余弦值）时，返回"我不知道"而不是调用阅读器。在留出集上调整阈值。
3. **困难。** 在你选择的 10,000 文档语料库上构建 RAG pipeline。实现混合检索（BM25 + 密集），带 RRF 融合（见第 14 课）。在有和无混合步骤的情况下测量答案准确率。记录哪些问题类型受益最多。

## 关键术语

| 术语 | 人们说的意思 | 实际含义 |
|------|-----------------|-----------------------|
| Extractive QA | 找到答案跨度 | 预测答案在给定段落中的起始和结束索引。 |
| Open-domain QA | 在语料库上的 QA | 没有给定段落；必须先检索然后回答。 |
| RAG | 检索然后生成 | 检索增强生成。检索器 + 阅读器 pipeline。 |
| SQuAD | 经典基准 | Stanford Question Answering Dataset。EM + F1 指标。 |
| Hallucination | 捏造的答案 | 阅读器输出不被检索到的上下文支持。 |
| Refusal calibration | 知道何时闭嘴 | 系统在无法回答时正确地说"我不知道"。 |

## 延伸阅读

- [Rajpurkar et al. (2016). SQuAD: 100,000+ Questions for Machine Comprehension of Text](https://arxiv.org/abs/1606.05250) —— 基准论文。
- [Karpukhin et al. (2020). Dense Passage Retrieval for Open-Domain QA](https://arxiv.org/abs/2004.04906) —— DPR，QA 的经典密集检索器。
- [Lewis et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks](https://arxiv.org/abs/2005.11401) —— 命名 RAG 的论文。
- [Gao et al. (2023). Retrieval-Augmented Generation for Large Language Models: A Survey](https://arxiv.org/abs/2312.10997) —— 全面的 RAG 综述。
